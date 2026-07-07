package com.timber.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.Instant;

/**
 * Mirrors the on-chain Furniture struct.
 * sourceBatchId is the provenance link back to the Batch.
 * qrCodeUrl is generated off-chain by QRCodeService after the furniture is recorded.
 */
@Entity
@Table(name = "furnitures")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FurnitureEntity {

    @Id
    @Column(name = "furniture_id")
    private Long furnitureId;

    @Column(name = "source_batch_id", nullable = false)
    private Long sourceBatchId;

    @Column(name = "furniture_type", length = 100)
    private String furnitureType;

    @Column(name = "qty_used", nullable = false)
    private Long qtyUsed;

    @Column(name = "manufacturer", nullable = false, length = 42)
    private String manufacturer;

    @Column(name = "ipfs_hash", length = 200)
    private String ipfsHash;

    @Column(name = "qr_code_url", length = 500)
    private String qrCodeUrl;

    @Column(name = "tx_hash", length = 66)
    private String txHash;

    @Column(name = "created_at")
    private Instant createdAt;
}
