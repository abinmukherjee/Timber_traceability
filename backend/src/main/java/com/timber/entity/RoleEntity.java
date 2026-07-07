package com.timber.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.Instant;

/**
 * Mirrors on-chain role assignments from RoleGranted / RoleRevoked events.
 * active=true means the role is currently held; active=false means it was revoked.
 */
@Entity
@Table(name = "roles")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "wallet", nullable = false, length = 42)
    private String wallet;

    /** Human-readable role name: 'AUCTION_HOUSE', 'FACTORY', 'ADMIN' */
    @Column(name = "role_name", nullable = false, length = 50)
    private String roleName;

    /** The bytes32 keccak256 role hash from the contract */
    @Column(name = "role_bytes", nullable = false, length = 66)
    private String roleBytes;

    @Column(name = "granted_by", length = 42)
    private String grantedBy;

    @Column(name = "active")
    @Builder.Default
    private Boolean active = true;

    @Column(name = "tx_hash", length = 66)
    private String txHash;

    @Column(name = "created_at")
    private Instant createdAt;
}
