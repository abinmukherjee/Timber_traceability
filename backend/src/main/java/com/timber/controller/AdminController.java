package com.timber.controller;

import com.timber.config.RoleConstants;
import com.timber.service.RoleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Admin endpoints — called by the Admin UI to prepare role management transactions.
 *
 * CRITICAL: This controller NEVER holds or uses a private key.
 * It returns the role hash bytes32 values that the frontend passes to MetaMask,
 * which then calls grantRole() / revokeRole() on the contract directly.
 *
 * Flow: Admin UI → POST /api/admin/roles/prepare-grant
 *               → Returns roleHash
 *               → Frontend calls contract.grantRole(roleHash, wallet) via MetaMask
 *               → ethers.js listener picks up RoleGranted event
 *               → POST /api/internal/roles/grant → DB updated
 */
@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminController {

    private final RoleService roleService;

    /**
     * POST /api/admin/roles/prepare-grant
     *
     * Request body:
     * {
     *   "wallet": "0x...",
     *   "role":   "FACTORY" | "AUCTION_HOUSE"
     * }
     *
     * Response:
     * {
     *   "roleHash":     "0x...",
     *   "roleName":     "FACTORY",
     *   "targetWallet": "0x..."
     * }
     */
    @PostMapping("/roles/prepare-grant")
    public ResponseEntity<?> prepareGrant(@RequestBody Map<String, String> body) {
        String wallet   = body.get("wallet");
        String roleName = body.get("role");

        if (wallet == null || wallet.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "wallet is required"));
        }
        if (roleName == null || roleName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "role is required"));
        }

        String roleHash = roleService.getRoleHash(roleName.toUpperCase());
        if (roleHash == null) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "Unknown role: " + roleName + ". Valid values: FACTORY, AUCTION_HOUSE"));
        }

        log.info("Prepare grant: role={} hash={} wallet={}", roleName, roleHash, wallet);

        return ResponseEntity.ok(Map.of(
                "roleHash",     roleHash,
                "roleName",     roleName.toUpperCase(),
                "targetWallet", wallet
        ));
    }

    /**
     * POST /api/admin/roles/prepare-revoke
     *
     * Same contract as prepare-grant — returns the roleHash for MetaMask to call revokeRole().
     */
    @PostMapping("/roles/prepare-revoke")
    public ResponseEntity<?> prepareRevoke(@RequestBody Map<String, String> body) {
        String wallet   = body.get("wallet");
        String roleName = body.get("role");

        if (wallet == null || wallet.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "wallet is required"));
        }
        if (roleName == null || roleName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "role is required"));
        }

        String roleHash = roleService.getRoleHash(roleName.toUpperCase());
        if (roleHash == null) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "Unknown role: " + roleName + ". Valid values: FACTORY, AUCTION_HOUSE"));
        }

        log.info("Prepare revoke: role={} hash={} wallet={}", roleName, roleHash, wallet);

        return ResponseEntity.ok(Map.of(
                "roleHash",     roleHash,
                "roleName",     roleName.toUpperCase(),
                "targetWallet", wallet
        ));
    }

    /**
     * GET /api/admin/roles/hashes
     * Returns all known role hashes for reference.
     */
    @GetMapping("/roles/hashes")
    public ResponseEntity<?> getRoleHashes() {
        return ResponseEntity.ok(Map.of(
                "AUCTION_HOUSE", RoleConstants.AUCTION_HOUSE_ROLE_HASH,
                "FACTORY",       RoleConstants.FACTORY_ROLE_HASH,
                "ADMIN",         RoleConstants.DEFAULT_ADMIN_ROLE_HASH
        ));
    }
}
