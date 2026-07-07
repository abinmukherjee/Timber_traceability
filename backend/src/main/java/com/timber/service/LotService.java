package com.timber.service;

import com.timber.entity.LotEntity;
import com.timber.repository.LotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class LotService {

    private final LotRepository lotRepository;

    /**
     * Saves (inserts) a new lot from a LotRegistered event.
     * Called by InternalController after receiving the event from the listener.
     */
    public LotEntity saveLot(Long lotId, String auctionHouse, Long qty, Long timestamp,
                              String txHash, String species, String originCoupeId,
                              String grade, String ipfsHash) {
        LotEntity entity = LotEntity.builder()
                .lotId(lotId)
                .auctionHouse(auctionHouse.toLowerCase())
                .species(species)
                .originCoupeId(originCoupeId)
                .grade(grade)
                .initialQty(qty)
                .remainingQty(qty)
                .ipfsHash(ipfsHash)
                .txHash(txHash)
                .createdAt(Instant.ofEpochSecond(timestamp))
                .build();

        LotEntity saved = lotRepository.save(entity);
        log.info("Lot saved: id={} species={} qty={} auctionHouse={}", lotId, species, qty, auctionHouse);
        return saved;
    }

    /**
     * Saves a lot from the internal endpoint (listener POST).
     * The LotRegistered event itself does not carry the string fields, so the
     * listener reads them back from the on-chain struct (getLot) and passes
     * species/grade/originCoupeId/ipfsHash here.
     * Idempotent — a duplicate lotId returns the existing row without overwriting.
     */
    public LotEntity saveLotFromEvent(Long lotId, String auctionHouse, Long qty,
                                       Long timestamp, String txHash,
                                       String species, String grade,
                                       String originCoupeId, String ipfsHash) {
        // Check for duplicate (idempotent)
        Optional<LotEntity> existing = lotRepository.findById(lotId);
        if (existing.isPresent()) {
            log.warn("Lot {} already exists — skipping duplicate insert", lotId);
            return existing.get();
        }

        LotEntity entity = LotEntity.builder()
                .lotId(lotId)
                .auctionHouse(auctionHouse.toLowerCase())
                .species(species)
                .grade(grade)
                .originCoupeId(originCoupeId)
                .ipfsHash(ipfsHash)
                .initialQty(qty)
                .remainingQty(qty)
                .txHash(txHash)
                .createdAt(Instant.ofEpochSecond(timestamp))
                .build();

        LotEntity saved = lotRepository.save(entity);
        log.info("Lot saved from event: id={} species={} grade={} qty={} auctionHouse={}",
                lotId, species, grade, qty, auctionHouse);
        return saved;
    }

    /**
     * Subtracts qty from a lot's remainingQty, mirroring the on-chain decrement
     * that purchaseWood() applies. Clamps at zero as a safety guard.
     *
     * NOTE ON IDEMPOTENCY: this method must be invoked exactly once per
     * WoodPurchased event. The caller (InternalController) gates it on a
     * genuinely new batch insert, so a replayed event (e.g. after a listener
     * restart) finds the batch already present and does NOT decrement again.
     */
    public void decrementRemainingQty(Long lotId, Long qty) {
        Optional<LotEntity> found = lotRepository.findById(lotId);
        if (found.isEmpty()) {
            log.warn("Cannot decrement — lot {} not found", lotId);
            return;
        }
        LotEntity lot = found.get();
        long current = lot.getRemainingQty() != null ? lot.getRemainingQty() : 0L;
        long next = current - qty;
        if (next < 0) {
            log.warn("Lot {} decrement would go negative ({} - {}); clamping to 0", lotId, current, qty);
            next = 0;
        }
        lot.setRemainingQty(next);
        lotRepository.save(lot);
        log.info("Lot {} remainingQty decremented by {} → {}", lotId, qty, next);
    }

    public Optional<LotEntity> findById(Long id) {
        return lotRepository.findById(id);
    }

    public List<LotEntity> findAll() {
        return lotRepository.findAll();
    }

    public long count() {
        return lotRepository.count();
    }
}
