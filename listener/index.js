/**
 * listener/index.js
 *
 * ethers.js v6 WebSocket event listener for the TimberSupplyChain contract.
 * Relays confirmed on-chain events to the Spring Boot backend REST API.
 *
 * Events handled:
 *   LotRegistered     → POST /api/internal/lots
 *   WoodPurchased     → POST /api/internal/batches
 *   FurnitureCreated  → POST /api/internal/furnitures
 *   RoleGranted       → POST /api/internal/roles/grant
 *   RoleRevoked       → POST /api/internal/roles/revoke
 *
 * Critical design notes:
 *   - Only fires on MINED events — no pending tx processing
 *   - This process is an observer only; it never sends transactions
 *   - Auto-reconnects on WebSocket disconnect
 */

require("dotenv").config();
const { ethers } = require("ethers");
const axios      = require("axios");
const fs         = require("fs");
const path       = require("path");

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const SEPOLIA_WS_URL     = process.env.SEPOLIA_WS_URL;
const CONTRACT_ADDRESS   = process.env.CONTRACT_ADDRESS;
const BACKEND_URL        = process.env.BACKEND_URL || "http://localhost:8080";
const RECONNECT_DELAY_MS = 5000; // 5s before reconnect attempt

if (!SEPOLIA_WS_URL || !CONTRACT_ADDRESS) {
  console.error("❌ Missing required env vars: SEPOLIA_WS_URL, CONTRACT_ADDRESS");
  process.exit(1);
}

// Load ABI from contract-config.json (project root)
const configPath = path.join(__dirname, "../contract-config.json");
if (!fs.existsSync(configPath)) {
  console.error("❌ contract-config.json not found at:", configPath);
  console.error("   Run: cd contracts && npx hardhat run scripts/deploy.js --network sepolia");
  process.exit(1);
}
const { abi: ABI } = JSON.parse(fs.readFileSync(configPath, "utf8"));

// ─────────────────────────────────────────────────────────────────────────────
// Role hash → human-readable name mapping
// (same keccak256 values as in TimberSupplyChain.sol and RoleConstants.java)
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_NAMES = {
  [ethers.id("AUCTION_HOUSE_ROLE")]: "AUCTION_HOUSE",
  [ethers.id("FACTORY_ROLE")]:       "FACTORY",
  [ethers.ZeroHash]:                 "ADMIN", // DEFAULT_ADMIN_ROLE = bytes32(0)
};

function resolveRoleName(roleBytes32) {
  return ROLE_NAMES[roleBytes32.toLowerCase()] || roleBytes32;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helper — POST to backend with logging
// ─────────────────────────────────────────────────────────────────────────────

async function postToBackend(endpoint, payload, txHash) {
  const url = `${BACKEND_URL}${endpoint}`;
  try {
    const res = await axios.post(url, payload, {
      headers:  { "Content-Type": "application/json" },
      timeout:  10_000,
    });
    console.log(`✅ [${txHash?.slice(0, 10)}...] POST ${endpoint} → ${res.status}`);
  } catch (err) {
    const status = err.response?.status;
    const data   = err.response?.data;
    console.error(`❌ [${txHash?.slice(0, 10)}...] POST ${endpoint} failed — HTTP ${status}`, data ?? err.message);
    // Do not re-throw — a backend error must not crash the listener
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main listener setup — called on start and on reconnect
// ─────────────────────────────────────────────────────────────────────────────

function startListener() {
  console.log("\n🔌 Connecting to Sepolia WebSocket...");
  console.log("   WS URL:   ", SEPOLIA_WS_URL.replace(/\/v2\/.*/, "/v2/[REDACTED]"));
  console.log("   Contract: ", CONTRACT_ADDRESS);
  console.log("   Backend:  ", BACKEND_URL);

  const provider = new ethers.WebSocketProvider(SEPOLIA_WS_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  // ── LotRegistered ──────────────────────────────────────────────────────────
  contract.on("LotRegistered", async (lotId, auctionHouse, qty, timestamp, event) => {
    const txHash = event.log.transactionHash;
    console.log(`\n📦 LotRegistered  lotId=${lotId} auctionHouse=${auctionHouse} qty=${qty} tx=${txHash}`);

    // The LotRegistered event does NOT carry the string fields (species, grade,
    // originCoupeId, ipfsHash) — they live only in the on-chain struct. Read
    // them back with getLot(), a free read-only eth_call (no tx, no gas, no
    // signer). Failure here must not block the mirror, so fall back to empties.
    let species = "", grade = "", originCoupeId = "", ipfsHash = "";
    try {
      const lot = await contract.getLot(lotId);
      species       = lot.species;
      grade         = lot.grade;
      originCoupeId = lot.originCoupeId;
      ipfsHash      = lot.ipfsHash;
    } catch (err) {
      console.error(`⚠️  Could not read lot ${lotId} struct for enrichment:`, err.message);
    }

    await postToBackend("/api/internal/lots", {
      lotId:         lotId.toString(),
      auctionHouse:  auctionHouse,
      qty:           qty.toString(),
      timestamp:     timestamp.toString(),
      txHash:        txHash,
      species:       species,
      grade:         grade,
      originCoupeId: originCoupeId,
      ipfsHash:      ipfsHash,
    }, txHash);
  });

  // ── WoodPurchased ──────────────────────────────────────────────────────────
  contract.on("WoodPurchased", async (lotId, batchId, factory, qty, timestamp, event) => {
    const txHash = event.log.transactionHash;
    console.log(`\n🪵 WoodPurchased  lotId=${lotId} batchId=${batchId} factory=${factory} qty=${qty} tx=${txHash}`);

    await postToBackend("/api/internal/batches", {
      batchId:      batchId.toString(),
      parentLotId:  lotId.toString(),
      factory:      factory,
      qty:          qty.toString(),
      timestamp:    timestamp.toString(),
      txHash:       txHash,
    }, txHash);
  });

  // ── FurnitureCreated ───────────────────────────────────────────────────────
  contract.on("FurnitureCreated", async (furnitureId, batchId, manufacturer, furnitureType, qty, timestamp, event) => {
    const txHash = event.log.transactionHash;
    console.log(`\n🛏️  FurnitureCreated  furnitureId=${furnitureId} batchId=${batchId} type=${furnitureType} qty=${qty} tx=${txHash}`);

    await postToBackend("/api/internal/furnitures", {
      furnitureId:   furnitureId.toString(),
      sourceBatchId: batchId.toString(),
      manufacturer:  manufacturer,
      furnitureType: furnitureType,
      qtyUsed:       qty.toString(),
      timestamp:     timestamp.toString(),
      txHash:        txHash,
    }, txHash);
  });

  // ── RoleGranted (emitted by OpenZeppelin AccessControl) ───────────────────
  contract.on("RoleGranted", async (role, account, sender, event) => {
    const txHash   = event.log.transactionHash;
    const roleName = resolveRoleName(role);
    console.log(`\n🔑 RoleGranted  role=${roleName} account=${account} sender=${sender} tx=${txHash}`);

    await postToBackend("/api/internal/roles/grant", {
      wallet:    account,
      roleName:  roleName,
      roleBytes: role,
      grantedBy: sender,
      txHash:    txHash,
    }, txHash);
  });

  // ── RoleRevoked (emitted by OpenZeppelin AccessControl) ───────────────────
  contract.on("RoleRevoked", async (role, account, sender, event) => {
    const txHash   = event.log.transactionHash;
    const roleName = resolveRoleName(role);
    console.log(`\n🔒 RoleRevoked  role=${roleName} account=${account} sender=${sender} tx=${txHash}`);

    await postToBackend("/api/internal/roles/revoke", {
      wallet:    account,
      roleName:  roleName,
      roleBytes: role,
      revokedBy: sender,
      txHash:    txHash,
    }, txHash);
  });

  // ── WebSocket lifecycle ────────────────────────────────────────────────────
  provider.websocket.on("open", () => {
    console.log("✅ WebSocket connected — listening for events...");
  });

  provider.websocket.on("close", (code) => {
    console.warn(`⚠️  WebSocket closed (code ${code}). Reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
    provider.removeAllListeners();
    setTimeout(startListener, RECONNECT_DELAY_MS);
  });

  provider.websocket.on("error", (err) => {
    console.error("❌ WebSocket error:", err.message);
  });

  // Graceful shutdown
  process.on("SIGINT",  () => { console.log("\n🛑 Shutting down listener..."); provider.destroy(); process.exit(0); });
  process.on("SIGTERM", () => { console.log("\n🛑 Shutting down listener..."); provider.destroy(); process.exit(0); });
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

console.log("🌲 Timber Supply Chain Event Listener — starting...");
startListener();
