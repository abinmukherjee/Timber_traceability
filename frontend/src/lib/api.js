/**
 * api.js — fetch wrappers for the Spring Boot backend REST API.
 * Ported from the legacy frontend/js/api.js. Base URL is configurable via
 * VITE_API_BASE (defaults to http://localhost:8080).
 */

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
  return res.json();
}

export function apiGetStats() {
  return getJson(`${API_BASE}/api/stats`);
}

export function apiGetLots() {
  return getJson(`${API_BASE}/api/lots`);
}

export function apiGetLot(id) {
  return getJson(`${API_BASE}/api/lots/${id}`);
}

export function apiGetBatch(id) {
  return getJson(`${API_BASE}/api/batches/${id}`);
}

export function apiGetBatchesByFactory(factory) {
  const url = factory
    ? `${API_BASE}/api/batches?factory=${factory}`
    : `${API_BASE}/api/batches`;
  return getJson(url);
}

export function apiGetFurniture(id) {
  return getJson(`${API_BASE}/api/furnitures/${id}`);
}

export function apiGetFurnitures() {
  return getJson(`${API_BASE}/api/furnitures`);
}

export function apiVerify(furnitureId) {
  return getJson(`${API_BASE}/api/verify/${furnitureId}`);
}

export function apiGetRoles() {
  return getJson(`${API_BASE}/api/roles?activeOnly=false`);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.error || detail;
    } catch {
      /* ignore parse failure */
    }
    throw new Error(detail);
  }
  return res.json();
}

export function apiPrepareGrant(wallet, role) {
  return postJson(`${API_BASE}/api/admin/roles/prepare-grant`, { wallet, role });
}

export function apiPrepareRevoke(wallet, role) {
  return postJson(`${API_BASE}/api/admin/roles/prepare-revoke`, { wallet, role });
}

/**
 * Uploads a file to Pinata IPFS and returns the CID.
 * MUST complete before the on-chain transaction — the CID is a tx argument.
 */
export async function uploadToPinata(file, pinataJwt) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("pinataMetadata", JSON.stringify({ name: file.name }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${pinataJwt}` },
    body: formData,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.error?.details || detail;
    } catch {
      /* ignore */
    }
    throw new Error("Pinata upload failed: " + detail);
  }
  const data = await res.json();
  return data.IpfsHash;
}

export function ipfsUrl(cid) {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

export function qrImageUrl(furnitureId) {
  return `${API_BASE}/api/qr/${furnitureId}`;
}

// ── display helpers ─────────────────────────────────────────────────────────

export function shortenAddr(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export function formatTimestamp(ts) {
  if (!ts) return "—";
  // Accepts a unix-seconds number/string or an ISO date string.
  const d =
    typeof ts === "number" || /^\d+$/.test(String(ts))
      ? new Date(Number(ts) * 1000)
      : new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export const etherscanTx = (hash) => `https://sepolia.etherscan.io/tx/${hash}`;
