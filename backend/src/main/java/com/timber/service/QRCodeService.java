package com.timber.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

/**
 * Generates QR code PNG images encoding the provenance verification URL.
 * Uses ZXing (Google's barcode library) to produce 400x400 PNG files.
 */
@Slf4j
@Service
public class QRCodeService {

    @Value("${qr.output.dir:./qr-codes}")
    private String qrOutputDir;

    @Value("${app.base.url:http://localhost:5500}")
    private String appBaseUrl;

    private static final int QR_WIDTH  = 400;
    private static final int QR_HEIGHT = 400;

    /**
     * Generates a QR code PNG for the given furniture ID.
     * The QR content encodes: {appBaseUrl}/verify.html?id={furnitureId}
     *
     * @param furnitureId the furniture piece ID
     * @return the file path of the generated QR code PNG, or null on failure
     */
    public String generateQRCode(Long furnitureId) {
        String verifyUrl = appBaseUrl + "/verify.html?id=" + furnitureId;
        String fileName  = "furniture-qr-" + furnitureId + ".png";

        try {
            Path outputPath = Paths.get(qrOutputDir);
            Files.createDirectories(outputPath);

            Path filePath = outputPath.resolve(fileName);

            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
            hints.put(EncodeHintType.MARGIN, 2);

            QRCodeWriter writer    = new QRCodeWriter();
            BitMatrix    bitMatrix = writer.encode(verifyUrl, BarcodeFormat.QR_CODE, QR_WIDTH, QR_HEIGHT, hints);

            MatrixToImageWriter.writeToPath(bitMatrix, "PNG", filePath);

            String relativePath = qrOutputDir + "/" + fileName;
            log.info("QR code generated: {} → {}", verifyUrl, relativePath);
            return relativePath;

        } catch (WriterException | IOException e) {
            log.error("Failed to generate QR code for furniture {}: {}", furnitureId, e.getMessage());
            return null;
        }
    }

    /**
     * Returns the public URL for the QR code image (for API responses).
     */
    public String getQRCodeUrl(Long furnitureId) {
        return appBaseUrl + "/api/qr/" + furnitureId;
    }
}
