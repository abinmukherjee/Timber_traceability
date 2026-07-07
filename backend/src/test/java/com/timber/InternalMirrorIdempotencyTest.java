package com.timber;

import com.timber.controller.InternalController;
import com.timber.entity.BatchEntity;
import com.timber.entity.LotEntity;
import com.timber.repository.BatchRepository;
import com.timber.repository.FurnitureRepository;
import com.timber.repository.LotRepository;
import com.timber.service.BatchService;
import com.timber.service.LotService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the three event-mirroring fixes end to end against a real (in-memory
 * H2) database, driving the actual InternalController → services → repositories:
 *
 *   Bug 1 — species/grade/originCoupeId/ipfsHash are persisted for a lot.
 *   Bug 2 — a lot's remainingQty is decremented on WoodPurchased.
 *   Bug 3 — a batch's remainingQty is decremented on FurnitureCreated.
 *
 * Crucially, each event is sent TWICE to assert idempotency: a replayed event
 * (e.g. after a listener restart) must not create duplicates nor decrement a
 * second time. Also exercises the clamp / not-found safety guards directly.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:timbertest;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        // keep generated QR PNGs out of the source tree during tests
        "qr.output.dir=target/test-qr"
})
class InternalMirrorIdempotencyTest {

    @Autowired InternalController controller;
    @Autowired LotService lotService;
    @Autowired BatchService batchService;
    @Autowired LotRepository lotRepository;
    @Autowired BatchRepository batchRepository;
    @Autowired FurnitureRepository furnitureRepository;

    @BeforeEach
    void clean() {
        furnitureRepository.deleteAll();
        batchRepository.deleteAll();
        lotRepository.deleteAll();
    }

    // ── payload builders (mirror the listener's POST bodies) ─────────────────

    private Map<String, String> lotEvent(long lotId, long qty) {
        Map<String, String> m = new HashMap<>();
        m.put("lotId", String.valueOf(lotId));
        m.put("auctionHouse", "0xauctionhouse");
        m.put("qty", String.valueOf(qty));
        m.put("timestamp", "1700000000");
        m.put("txHash", "0xlot" + lotId);
        m.put("species", "Teak");
        m.put("grade", "Grade A");
        m.put("originCoupeId", "KA-2024-001");
        m.put("ipfsHash", "QmLotCid");
        return m;
    }

    private Map<String, String> batchEvent(long batchId, long parentLotId, long qty) {
        Map<String, String> m = new HashMap<>();
        m.put("batchId", String.valueOf(batchId));
        m.put("parentLotId", String.valueOf(parentLotId));
        m.put("factory", "0xfactory");
        m.put("qty", String.valueOf(qty));
        m.put("timestamp", "1700000100");
        m.put("txHash", "0xbatch" + batchId);
        return m;
    }

    private Map<String, String> furnitureEvent(long furnitureId, long sourceBatchId, long qtyUsed) {
        Map<String, String> m = new HashMap<>();
        m.put("furnitureId", String.valueOf(furnitureId));
        m.put("sourceBatchId", String.valueOf(sourceBatchId));
        m.put("manufacturer", "0xfactory");
        m.put("furnitureType", "Bed");
        m.put("qtyUsed", String.valueOf(qtyUsed));
        m.put("timestamp", "1700000200");
        m.put("txHash", "0xfurn" + furnitureId);
        m.put("ipfsHash", "QmFurnCid");
        return m;
    }

    private void ok(ResponseEntity<?> res) {
        assertThat(res.getStatusCode().is2xxSuccessful()).isTrue();
    }

    // ── Bug 1: string fields persisted ───────────────────────────────────────

    @Test
    void lotStringFieldsArePersisted() {
        ok(controller.receiveLot(lotEvent(1, 2000)));

        LotEntity lot = lotRepository.findById(1L).orElseThrow();
        assertThat(lot.getSpecies()).isEqualTo("Teak");
        assertThat(lot.getGrade()).isEqualTo("Grade A");
        assertThat(lot.getOriginCoupeId()).isEqualTo("KA-2024-001");
        assertThat(lot.getIpfsHash()).isEqualTo("QmLotCid");
        assertThat(lot.getRemainingQty()).isEqualTo(2000L);
    }

    // ── Bug 2: lot decremented on purchase, idempotent on replay ─────────────

    @Test
    void purchaseDecrementsLot_andIsIdempotent() {
        ok(controller.receiveLot(lotEvent(1, 2000)));

        ok(controller.receiveBatch(batchEvent(1, 1, 100)));
        assertThat(lotRepository.findById(1L).orElseThrow().getRemainingQty()).isEqualTo(1900L);
        assertThat(batchRepository.findById(1L).orElseThrow().getRemainingQty()).isEqualTo(100L);
        assertThat(batchRepository.count()).isEqualTo(1);

        // Replay the SAME WoodPurchased event — must NOT decrement again.
        ok(controller.receiveBatch(batchEvent(1, 1, 100)));
        assertThat(lotRepository.findById(1L).orElseThrow().getRemainingQty()).isEqualTo(1900L);
        assertThat(batchRepository.count()).isEqualTo(1);

        // A second, distinct purchase against the same lot decrements further.
        ok(controller.receiveBatch(batchEvent(2, 1, 250)));
        assertThat(lotRepository.findById(1L).orElseThrow().getRemainingQty()).isEqualTo(1650L);
        assertThat(batchRepository.count()).isEqualTo(2);
    }

    // ── Bug 3: batch decremented on manufacture, idempotent on replay ────────

    @Test
    void manufactureDecrementsBatch_andIsIdempotent() {
        ok(controller.receiveLot(lotEvent(1, 2000)));
        ok(controller.receiveBatch(batchEvent(1, 1, 100)));

        ok(controller.receiveFurniture(furnitureEvent(1, 1, 40)));
        assertThat(batchRepository.findById(1L).orElseThrow().getRemainingQty()).isEqualTo(60L);
        assertThat(furnitureRepository.count()).isEqualTo(1);

        // Replay the SAME FurnitureCreated event — must NOT decrement again.
        ok(controller.receiveFurniture(furnitureEvent(1, 1, 40)));
        assertThat(batchRepository.findById(1L).orElseThrow().getRemainingQty()).isEqualTo(60L);
        assertThat(furnitureRepository.count()).isEqualTo(1);

        // A second, distinct furniture from the same batch decrements further.
        ok(controller.receiveFurniture(furnitureEvent(2, 1, 25)));
        assertThat(batchRepository.findById(1L).orElseThrow().getRemainingQty()).isEqualTo(35L);
        assertThat(furnitureRepository.count()).isEqualTo(2);
    }

    // ── Safety guards on the decrement methods themselves ────────────────────

    @Test
    void lotDecrementClampsAtZeroAndIgnoresMissing() {
        ok(controller.receiveLot(lotEvent(1, 100)));

        // Over-decrement clamps to 0 rather than going negative.
        lotService.decrementRemainingQty(1L, 100_000L);
        assertThat(lotRepository.findById(1L).orElseThrow().getRemainingQty()).isEqualTo(0L);

        // Missing lot is a no-op (no exception thrown).
        lotService.decrementRemainingQty(999L, 10L);
    }

    @Test
    void batchDecrementClampsAtZeroAndIgnoresMissing() {
        ok(controller.receiveLot(lotEvent(1, 2000)));
        ok(controller.receiveBatch(batchEvent(1, 1, 100)));

        batchService.decrementRemainingQty(1L, 100_000L);
        assertThat(batchRepository.findById(1L).orElseThrow().getRemainingQty()).isEqualTo(0L);

        batchService.decrementRemainingQty(999L, 10L);
    }
}
