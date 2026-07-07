package com.timber.service;

import com.timber.entity.BatchEntity;
import com.timber.entity.FurnitureEntity;
import com.timber.entity.LotEntity;
import com.timber.repository.FurnitureRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class FurnitureService {

    private final FurnitureRepository furnitureRepository;
    private final BatchService        batchService;
    private final LotService          lotService;
    private final QRCodeService       qrCodeService;

    /**
     * Saves a furniture record from a FurnitureCreated event.
     * Also triggers QR code generation — the QR PNG is created and its path stored.
     * Idempotent — silently skips duplicate furnitureId.
     */
    public FurnitureEntity saveFurnitureFromEvent(Long furnitureId, Long sourceBatchId,
                                                   String manufacturer, String furnitureType,
                                                   Long qtyUsed, Long timestamp,
                                                   String txHash, String ipfsHash) {
        Optional<FurnitureEntity> existing = furnitureRepository.findById(furnitureId);
        if (existing.isPresent()) {
            log.warn("Furniture {} already exists — skipping duplicate insert", furnitureId);
            return existing.get();
        }

        // Generate QR code (produces a PNG file on disk)
        String qrPath = qrCodeService.generateQRCode(furnitureId);
        String qrUrl  = qrCodeService.getQRCodeUrl(furnitureId);

        FurnitureEntity entity = FurnitureEntity.builder()
                .furnitureId(furnitureId)
                .sourceBatchId(sourceBatchId)
                .furnitureType(furnitureType)
                .qtyUsed(qtyUsed)
                .manufacturer(manufacturer.toLowerCase())
                .ipfsHash(ipfsHash)
                .qrCodeUrl(qrUrl)
                .txHash(txHash)
                .createdAt(Instant.ofEpochSecond(timestamp))
                .build();

        FurnitureEntity saved = furnitureRepository.save(entity);
        log.info("Furniture saved: id={} type={} batchId={} qrPath={}", furnitureId, furnitureType, sourceBatchId, qrPath);
        return saved;
    }

    public Optional<FurnitureEntity> findById(Long id) {
        return furnitureRepository.findById(id);
    }

    public List<FurnitureEntity> findAll() {
        return furnitureRepository.findAll();
    }

    public long count() {
        return furnitureRepository.count();
    }

    /**
     * Resolves the full provenance chain for a furniture piece.
     * Returns a structured map: furniture → batch → lot.
     * Throws if any link in the chain is missing.
     */
    public Map<String, Object> getProvenanceChain(Long furnitureId) {
        FurnitureEntity furniture = furnitureRepository.findById(furnitureId)
                .orElseThrow(() -> new IllegalArgumentException("Furniture not found: " + furnitureId));

        BatchEntity batch = batchService.findById(furniture.getSourceBatchId())
                .orElseThrow(() -> new IllegalStateException("Batch not found: " + furniture.getSourceBatchId()));

        LotEntity lot = lotService.findById(batch.getParentLotId())
                .orElseThrow(() -> new IllegalStateException("Lot not found: " + batch.getParentLotId()));

        Map<String, Object> furnitureMap = new HashMap<>();
        furnitureMap.put("id",           furniture.getFurnitureId());
        furnitureMap.put("type",         furniture.getFurnitureType());
        furnitureMap.put("qtyUsed",      furniture.getQtyUsed());
        furnitureMap.put("manufacturer", furniture.getManufacturer());
        furnitureMap.put("ipfsHash",     furniture.getIpfsHash());
        furnitureMap.put("qrCodeUrl",    furniture.getQrCodeUrl());
        furnitureMap.put("txHash",       furniture.getTxHash());
        furnitureMap.put("createdAt",    furniture.getCreatedAt());

        Map<String, Object> batchMap = new HashMap<>();
        batchMap.put("id",           batch.getBatchId());
        batchMap.put("qty",          batch.getQty());
        batchMap.put("remainingQty", batch.getRemainingQty());
        batchMap.put("factory",      batch.getFactory());
        batchMap.put("parentLotId",  batch.getParentLotId());
        batchMap.put("txHash",       batch.getTxHash());
        batchMap.put("createdAt",    batch.getCreatedAt());

        Map<String, Object> lotMap = new HashMap<>();
        lotMap.put("id",            lot.getLotId());
        lotMap.put("species",       lot.getSpecies());
        lotMap.put("grade",         lot.getGrade());
        lotMap.put("originCoupeId", lot.getOriginCoupeId());
        lotMap.put("initialQty",    lot.getInitialQty());
        lotMap.put("remainingQty",  lot.getRemainingQty());
        lotMap.put("auctionHouse",  lot.getAuctionHouse());
        lotMap.put("ipfsHash",      lot.getIpfsHash());
        lotMap.put("txHash",        lot.getTxHash());
        lotMap.put("createdAt",     lot.getCreatedAt());

        Map<String, Object> result = new HashMap<>();
        result.put("furniture", furnitureMap);
        result.put("batch",     batchMap);
        result.put("lot",       lotMap);

        return result;
    }
}
