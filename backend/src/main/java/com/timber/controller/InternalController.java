package com.timber.controller;

import com.timber.config.RoleConstants;
import com.timber.service.BatchService;
import com.timber.service.FurnitureService;
import com.timber.service.LotService;
import com.timber.service.RoleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Internal REST endpoints — called ONLY by the ethers.js event listener.
 * These are NOT exposed to the frontend or public internet.
 * No authentication for now (in production these would be on a private network).
 *
 * All endpoints are idempotent — re-sending the same event data is safe.
 */
@Slf4j
@RestController
@RequestMapping("/api/internal")
@RequiredArgsConstructor
public class InternalController {

    private final LotService       lotService;
    private final BatchService     batchService;
    private final FurnitureService furnitureService;
    private final RoleService      roleService;

    // ── POST /api/internal/lots ──────────────────────────────────────────────
    // Triggered by: LotRegistered event
    @PostMapping("/lots")
    public ResponseEntity<?> receiveLot(@RequestBody Map<String, String> body) {
        log.debug("Internal lot received: {}", body);
        try {
            Long   lotId         = Long.parseLong(body.get("lotId"));
            String auctionHouse  = body.get("auctionHouse");
            Long   qty           = Long.parseLong(body.get("qty"));
            Long   timestamp     = Long.parseLong(body.get("timestamp"));
            String txHash        = body.get("txHash");
            // Enriched fields the listener read back from the on-chain struct.
            String species       = body.getOrDefault("species", "");
            String grade         = body.getOrDefault("grade", "");
            String originCoupeId = body.getOrDefault("originCoupeId", "");
            String ipfsHash      = body.getOrDefault("ipfsHash", "");

            var saved = lotService.saveLotFromEvent(lotId, auctionHouse, qty, timestamp, txHash,
                    species, grade, originCoupeId, ipfsHash);
            return ResponseEntity.ok(Map.of("status", "ok", "lotId", saved.getLotId()));

        } catch (Exception e) {
            log.error("Failed to process lot event: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── POST /api/internal/batches ───────────────────────────────────────────
    // Triggered by: WoodPurchased event
    @PostMapping("/batches")
    public ResponseEntity<?> receiveBatch(@RequestBody Map<String, String> body) {
        log.debug("Internal batch received: {}", body);
        try {
            Long   batchId     = Long.parseLong(body.get("batchId"));
            Long   parentLotId = Long.parseLong(body.get("parentLotId"));
            String factory     = body.get("factory");
            Long   qty         = Long.parseLong(body.get("qty"));
            Long   timestamp   = Long.parseLong(body.get("timestamp"));
            String txHash      = body.get("txHash");

            // Idempotency guard: only decrement the parent lot when this batch
            // is genuinely new. A replayed WoodPurchased event finds the batch
            // already present, so we must not decrement the lot a second time.
            boolean isNewBatch = batchService.findById(batchId).isEmpty();
            var saved = batchService.saveBatchFromEvent(batchId, parentLotId, factory, qty, timestamp, txHash);
            if (isNewBatch) {
                lotService.decrementRemainingQty(parentLotId, qty);
            }
            return ResponseEntity.ok(Map.of("status", "ok", "batchId", saved.getBatchId()));

        } catch (Exception e) {
            log.error("Failed to process batch event: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── POST /api/internal/furnitures ────────────────────────────────────────
    // Triggered by: FurnitureCreated event
    @PostMapping("/furnitures")
    public ResponseEntity<?> receiveFurniture(@RequestBody Map<String, String> body) {
        log.debug("Internal furniture received: {}", body);
        try {
            Long   furnitureId   = Long.parseLong(body.get("furnitureId"));
            Long   sourceBatchId = Long.parseLong(body.get("sourceBatchId"));
            String manufacturer  = body.get("manufacturer");
            String furnitureType = body.get("furnitureType");
            Long   qtyUsed       = Long.parseLong(body.get("qtyUsed"));
            Long   timestamp     = Long.parseLong(body.get("timestamp"));
            String txHash        = body.get("txHash");
            String ipfsHash      = body.getOrDefault("ipfsHash", "");

            // Idempotency guard: only decrement the parent batch when this
            // furniture is genuinely new. A replayed FurnitureCreated event
            // finds the furniture already present, so we must not decrement twice.
            boolean isNewFurniture = furnitureService.findById(furnitureId).isEmpty();
            var saved = furnitureService.saveFurnitureFromEvent(
                    furnitureId, sourceBatchId, manufacturer, furnitureType,
                    qtyUsed, timestamp, txHash, ipfsHash);
            if (isNewFurniture) {
                batchService.decrementRemainingQty(sourceBatchId, qtyUsed);
            }

            return ResponseEntity.ok(Map.of(
                    "status",      "ok",
                    "furnitureId", saved.getFurnitureId(),
                    "qrCodeUrl",   saved.getQrCodeUrl() != null ? saved.getQrCodeUrl() : ""));

        } catch (Exception e) {
            log.error("Failed to process furniture event: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── POST /api/internal/roles/grant ───────────────────────────────────────
    // Triggered by: RoleGranted event (from OpenZeppelin AccessControl)
    @PostMapping("/roles/grant")
    public ResponseEntity<?> receiveRoleGrant(@RequestBody Map<String, String> body) {
        log.debug("Internal role grant received: {}", body);
        try {
            String wallet    = body.get("wallet");
            String roleBytes = body.get("roleBytes");
            String grantedBy = body.get("grantedBy");
            String txHash    = body.get("txHash");

            // Resolve roleName from roleBytes hash; fallback to provided roleName field
            String roleName = body.containsKey("roleName")
                    ? body.get("roleName")
                    : RoleConstants.resolve(roleBytes);

            var saved = roleService.grantRole(wallet, roleName, roleBytes, grantedBy, txHash);
            return ResponseEntity.ok(Map.of("status", "ok", "id", saved.getId()));

        } catch (Exception e) {
            log.error("Failed to process role grant event: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── POST /api/internal/roles/revoke ──────────────────────────────────────
    // Triggered by: RoleRevoked event (from OpenZeppelin AccessControl)
    @PostMapping("/roles/revoke")
    public ResponseEntity<?> receiveRoleRevoke(@RequestBody Map<String, String> body) {
        log.debug("Internal role revoke received: {}", body);
        try {
            String wallet    = body.get("wallet");
            String roleBytes = body.get("roleBytes");
            String txHash    = body.get("txHash");

            String roleName = body.containsKey("roleName")
                    ? body.get("roleName")
                    : RoleConstants.resolve(roleBytes);

            roleService.revokeRole(wallet, roleName, txHash);
            return ResponseEntity.ok(Map.of("status", "ok"));

        } catch (Exception e) {
            log.error("Failed to process role revoke event: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
