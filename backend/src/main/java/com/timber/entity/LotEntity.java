package com.timber.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.Instant;

/**
 * Mirrors the on-chain Lot struct.
 * Source of truth is the blockchain; this table is a read-optimisation mirror.
 */
@Entity
@Table(name = "lots")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LotEntity {

    @Id
    @Column(name = "lot_id")
    private Long lotId;

    @Column(name = "auction_house", nullable = false, length = 42)
    private String auctionHouse;

    @Column(name = "species", length = 100)
    private String species;

    @Column(name = "origin_coupe_id", length = 100)
    private String originCoupeId;

    @Column(name = "grade", length = 50)
    private String grade;

    @Column(name = "initial_qty", nullable = false)
    private Long initialQty;

    @Column(name = "remaining_qty", nullable = false)
    private Long remainingQty;

    @Column(name = "ipfs_hash", length = 200)
    private String ipfsHash;

    @Column(name = "tx_hash", length = 66)
    private String txHash;

    @Column(name = "created_at")
    private Instant createdAt;
}
