/**
 * Remembers the last route each wallet address used, in localStorage.
 * Used to gently *suggest* (not force) navigation when the user switches
 * MetaMask accounts.
 */
const KEY = "timbertrace:lastRouteByWallet";

const LABELS = {
  "/": "Dashboard",
  "/auction": "Auction House",
  "/factory": "Factory",
  "/admin": "Admin",
  "/verify": "Verify",
};

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function rememberRoute(address, path) {
  if (!address || !path) return;
  const map = read();
  map[address.toLowerCase()] = path;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage full / disabled — non-critical */
  }
}

export function getRememberedRoute(address) {
  if (!address) return null;
  return read()[address.toLowerCase()] || null;
}

export function routeLabel(path) {
  return LABELS[path] || path;
}
