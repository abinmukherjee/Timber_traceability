package com.timber.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.Instant;

/**
 * Mirrors the on-chain Batch struct.
 * parentLotId is the UTXO-inspired provenance link back to the original Lot.
 */
@Entity
@Table(name = "batches")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BatchEntity {

    @Id
    @Column(name = "batch_id")
    private Long batchId;

    @Column(name = "parent_lot_id", nullable = false)
    private Long parentLotId;

    @Column(name = "factory", nullable = false, length = 42)
    private String factory;

    @Column(name = "qty", nullable = false)
    private Long qty;

    @Column(name = "remaining_qty", nullable = false)
    private Long remainingQty;

    @Column(name = "tx_hash", length = 66)
    private String txHash;

    @Column(name = "created_at")
    private Instant createdAt;
}
