package com.timber.controller;

import com.timber.entity.BatchEntity;
import com.timber.entity.FurnitureEntity;
import com.timber.entity.LotEntity;
import com.timber.service.BatchService;
import com.timber.service.FurnitureService;
import com.timber.service.LotService;
import com.timber.service.RoleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

/**
 * Public REST endpoints called by the frontend.
 * Read-only — no state mutation occurs here.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PublicController {

    private final LotService       lotService;
    private final BatchService     batchService;
    private final FurnitureService furnitureService;
    private final RoleService      roleService;

    // ── GET /api/lots ────────────────────────────────────────────────────────
    @GetMapping("/api/lots")
    public ResponseEntity<List<LotEntity>> getAllLots() {
        return ResponseEntity.ok(lotService.findAll());
    }

    // ── GET /api/lots/{id} ───────────────────────────────────────────────────
    @GetMapping("/api/lots/{id}")
    public ResponseEntity<?> getLot(@PathVariable Long id) {
        return lotService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── GET /api/batches/{id} ────────────────────────────────────────────────
    @GetMapping("/api/batches/{id}")
    public ResponseEntity<?> getBatch(@PathVariable Long id) {
        return batchService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── GET /api/batches?factory=0x... ───────────────────────────────────────
    @GetMapping("/api/batches")
    public ResponseEntity<List<BatchEntity>> getBatchesByFactory(
            @RequestParam(required = false) String factory) {
        if (factory != null && !factory.isBlank()) {
            return ResponseEntity.ok(batchService.findByFactory(factory));
        }
        return ResponseEntity.ok(batchService.findAll());
    }

    // ── GET /api/furnitures ──────────────────────────────────────────────────
    // All furniture records (used by the Explorer page).
    @GetMapping("/api/furnitures")
    public ResponseEntity<List<FurnitureEntity>> getAllFurnitures() {
        return ResponseEntity.ok(furnitureService.findAll());
    }

    // ── GET /api/furnitures/{id} ─────────────────────────────────────────────
    @GetMapping("/api/furnitures/{id}")
    public ResponseEntity<?> getFurniture(@PathVariable Long id) {
        return furnitureService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── GET /api/furnitures/{id}/provenance ──────────────────────────────────
    @GetMapping("/api/furnitures/{id}/provenance")
    public ResponseEntity<?> getProvenance(@PathVariable Long id) {
        try {
            Map<String, Object> chain = furnitureService.getProvenanceChain(id);
            return ResponseEntity.ok(chain);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Broken provenance chain: " + e.getMessage()));
        }
    }

    // ── GET /api/verify/{furnitureId} ─────────────────────────────────────────
    // QR scan endpoint — identical to /provenance but at a clean verify URL
    @GetMapping("/api/verify/{furnitureId}")
    public ResponseEntity<?> verify(@PathVariable Long furnitureId) {
        try {
            Map<String, Object> chain = furnitureService.getProvenanceChain(furnitureId);
            return ResponseEntity.ok(chain);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Broken provenance chain: " + e.getMessage()));
        }
    }

    // ── GET /api/roles ───────────────────────────────────────────────────────
    @GetMapping("/api/roles")
    public ResponseEntity<?> getRoles(@RequestParam(defaultValue = "true") boolean activeOnly) {
        if (activeOnly) {
            return ResponseEntity.ok(roleService.findAllActive());
        }
        return ResponseEntity.ok(roleService.findAll());
    }

    // ── GET /api/stats ───────────────────────────────────────────────────────
    // Dashboard summary counts
    @GetMapping("/api/stats")
    public ResponseEntity<Map<String, Long>> getStats() {
        return ResponseEntity.ok(Map.of(
                "lots",       lotService.count(),
                "batches",    batchService.count(),
                "furnitures", furnitureService.count(),
                "roles",      (long) roleService.findAllActive().size()
        ));
    }

    // ── GET /api/qr/{furnitureId} ────────────────────────────────────────────
    // Serves the QR code PNG file
    @GetMapping("/api/qr/{furnitureId}")
    public ResponseEntity<Resource> getQRCode(@PathVariable Long furnitureId) {
        File qrFile = Paths.get("./qr-codes/furniture-qr-" + furnitureId + ".png").toFile();
        if (!qrFile.exists()) {
            return ResponseEntity.notFound().build();
        }
        Resource resource = new FileSystemResource(qrFile);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"furniture-qr-" + furnitureId + ".png\"")
                .contentType(MediaType.IMAGE_PNG)
                .body(resource);
    }
}
