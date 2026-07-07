/**
 * api.js — Shared fetch wrappers for the Spring Boot backend REST API.
 */

const API_BASE = "http://localhost:8080";

/**
 * Fetches all lots with summary data.
 */
async function apiGetLots() {
  const res = await fetch(`${API_BASE}/api/lots`);
  if (!res.ok) throw new Error("Failed to fetch lots");
  return res.json();
}

/**
 * Fetches a single lot by ID.
 */
async function apiGetLot(id) {
  const res = await fetch(`${API_BASE}/api/lots/${id}`);
  if (!res.ok) throw new Error(`Lot ${id} not found`);
  return res.json();
}

/**
 * Fetches a single batch by ID.
 */
async function apiGetBatch(id) {
  const res = await fetch(`${API_BASE}/api/batches/${id}`);
  if (!res.ok) throw new Error(`Batch ${id} not found`);
  return res.json();
}

/**
 * Fetches batches by factory address (optional filter).
 */
async function apiGetBatchesByFactory(factory) {
  const url = factory ? `${API_BASE}/api/batches?factory=${factory}` : `${API_BASE}/api/batches`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch batches");
  return res.json();
}

/**
 * Fetches a single furniture piece by ID.
 */
async function apiGetFurniture(id) {
  const res = await fetch(`${API_BASE}/api/furnitures/${id}`);
  if (!res.ok) throw new Error(`Furniture ${id} not found`);
  return res.json();
}

/**
 * Fetches the full provenance chain for a furniture piece.
 * Returns { furniture, batch, lot }
 */
async function apiVerify(furnitureId) {
  const res = await fetch(`${API_BASE}/api/verify/${furnitureId}`);
  if (!res.ok) throw new Error(`Provenance not found for furniture ${furnitureId}`);
  return res.json();
}

/**
 * Fetches all active role assignments.
 */
async function apiGetRoles() {
  const res = await fetch(`${API_BASE}/api/roles?activeOnly=false`);
  if (!res.ok) throw new Error("Failed to fetch roles");
  return res.json();
}

/**
 * Fetches dashboard summary stats.
 */
async function apiGetStats() {
  const res = await fetch(`${API_BASE}/api/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

/**
 * Calls the backend to get the role hash bytes32 for a grant operation.
 * Returns { roleHash, roleName, targetWallet }
 */
async function apiPrepareGrant(wallet, role) {
  const res = await fetch(`${API_BASE}/api/admin/roles/prepare-grant`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ wallet, role }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to prepare grant");
  }
  return res.json();
}

/**
 * Calls the backend to get the role hash bytes32 for a revoke operation.
 * Returns { roleHash, roleName, targetWallet }
 */
async function apiPrepareRevoke(wallet, role) {
  const res = await fetch(`${API_BASE}/api/admin/roles/prepare-revoke`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ wallet, role }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to prepare revoke");
  }
  return res.json();
}

/**
 * Uploads a file to Pinata IPFS and returns the CID.
 * The JWT is stored in the page's PINATA_JWT constant (set per-page or from user input).
 * Upload must complete BEFORE the blockchain transaction is constructed.
 */
async function uploadToPinata(file, pinataJwt) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("pinataMetadata", JSON.stringify({ name: file.name }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method:  "POST",
    headers: { Authorization: `Bearer ${pinataJwt}` },
    body:    formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error("Pinata upload failed: " + (err.error?.details || res.statusText));
  }

  const data = await res.json();
  return data.IpfsHash; // The IPFS CID
}

/**
 * Returns a Pinata gateway URL for a CID.
 */
function ipfsUrl(cid) {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

/**
 * Formats a Unix timestamp (seconds) to a readable date string.
 */
function formatTimestamp(ts) {
  if (!ts) return "—";
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleString();
}

/**
 * Shortens an Ethereum address for display.
 */
function shortenAddr(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}
