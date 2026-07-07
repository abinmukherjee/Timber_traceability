/**
 * Pins a specific wallet address to each write page (Auction House, Factory,
 * Admin) so that page always signs with that address — independent of
 * whichever account is currently "active" in the MetaMask extension.
 *
 * Verified empirically: MetaMask honors an explicit target address for any
 * account connected/permitted to the site, not just the one highlighted as
 * active in the extension UI (see WalletContext.getSignerForAddress). This is
 * what makes per-page pinning possible without manual account switching.
 *
 * Also stores optional user-defined labels per address, since MetaMask
 * nicknames (e.g. "Admin", "Factory") aren't exposed to dApps.
 */
const PIN_KEY = "timbertrace:pinnedWalletByPage";
const LABEL_KEY = "timbertrace:walletLabels";

function readMap(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

function writeMap(key, map) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* storage full/disabled — non-critical */
  }
}

export function getPinnedWallet(pagePath) {
  return readMap(PIN_KEY)[pagePath] || null;
}

export function setPinnedWallet(pagePath, address) {
  const map = readMap(PIN_KEY);
  map[pagePath] = address;
  writeMap(PIN_KEY, map);
}

export function clearPinnedWallet(pagePath) {
  const map = readMap(PIN_KEY);
  delete map[pagePath];
  writeMap(PIN_KEY, map);
}

export function getWalletLabel(address) {
  if (!address) return null;
  return readMap(LABEL_KEY)[address.toLowerCase()] || null;
}

export function setWalletLabel(address, label) {
  const map = readMap(LABEL_KEY);
  map[address.toLowerCase()] = label;
  writeMap(LABEL_KEY, map);
}
