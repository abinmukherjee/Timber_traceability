package com.timber.service;

import com.timber.entity.BatchEntity;
import com.timber.repository.BatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class BatchService {

    private final BatchRepository batchRepository;

    /**
     * Saves a batch from a WoodPurchased event (called by InternalController).
     * Idempotent — silently skips if batchId already exists.
     */
    public BatchEntity saveBatchFromEvent(Long batchId, Long parentLotId, String factory,
                                           Long qty, Long timestamp, String txHash) {
        Optional<BatchEntity> existing = batchRepository.findById(batchId);
        if (existing.isPresent()) {
            log.warn("Batch {} already exists — skipping duplicate insert", batchId);
            return existing.get();
        }

        BatchEntity entity = BatchEntity.builder()
                .batchId(batchId)
                .parentLotId(parentLotId)
                .factory(factory.toLowerCase())
                .qty(qty)
                .remainingQty(qty)
                .txHash(txHash)
                .createdAt(Instant.ofEpochSecond(timestamp))
                .build();

        BatchEntity saved = batchRepository.save(entity);
        log.info("Batch saved: id={} parentLotId={} qty={} factory={}", batchId, parentLotId, qty, factory);
        return saved;
    }

    /**
     * Subtracts qty from a batch's remainingQty, mirroring the on-chain
     * decrement that createFurniture() applies. Clamps at zero.
     *
     * NOTE ON IDEMPOTENCY: must be invoked exactly once per FurnitureCreated
     * event. The caller (InternalController) gates it on a genuinely new
     * furniture insert, so a replayed event does NOT decrement again.
     */
    public void decrementRemainingQty(Long batchId, Long qty) {
        Optional<BatchEntity> found = batchRepository.findById(batchId);
        if (found.isEmpty()) {
            log.warn("Cannot decrement — batch {} not found", batchId);
            return;
        }
        BatchEntity batch = found.get();
        long current = batch.getRemainingQty() != null ? batch.getRemainingQty() : 0L;
        long next = current - qty;
        if (next < 0) {
            log.warn("Batch {} decrement would go negative ({} - {}); clamping to 0", batchId, current, qty);
            next = 0;
        }
        batch.setRemainingQty(next);
        batchRepository.save(batch);
        log.info("Batch {} remainingQty decremented by {} → {}", batchId, qty, next);
    }

    public Optional<BatchEntity> findById(Long id) {
        return batchRepository.findById(id);
    }

    public List<BatchEntity> findAll() {
        return batchRepository.findAll();
    }

    public List<BatchEntity> findByFactory(String factory) {
        return batchRepository.findByFactory(factory.toLowerCase());
    }

    public long count() {
        return batchRepository.count();
    }
}
