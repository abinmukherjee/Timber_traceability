import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./useWallet.js";
import { getPinnedWallet, setPinnedWallet, clearPinnedWallet } from "../lib/pinnedWallets.js";

/**
 * Pins one connected wallet address to a given page (by path), so that page
 * always signs transactions with that address — regardless of whichever
 * account MetaMask currently shows as "active". Pairs with
 * WalletContext.getSignerForAddress, which does the actual per-address
 * signer construction.
 */
export function usePageWallet(pagePath) {
  const { connectedAccounts, connect, getSignerForAddress, isConnected, isConnecting } = useWallet();
  const [pinned, setPinned] = useState(() => getPinnedWallet(pagePath));

  // If the pinned address is no longer permitted (e.g. revoked in MetaMask),
  // drop the pin so the page prompts to re-pick instead of silently failing.
  useEffect(() => {
    if (pinned && connectedAccounts.length && !connectedAccounts.includes(pinned)) {
      clearPinnedWallet(pagePath);
      setPinned(null);
    }
  }, [pinned, connectedAccounts, pagePath]);

  const pin = useCallback(
    (address) => {
      setPinnedWallet(pagePath, address);
      setPinned(address);
    },
    [pagePath]
  );

  const unpin = useCallback(() => {
    clearPinnedWallet(pagePath);
    setPinned(null);
  }, [pagePath]);

  /** Signer bound to this page's pinned address — use for every write call. */
  const getPinnedSigner = useCallback(async () => {
    if (!pinned) throw new Error("No wallet pinned to this page yet.");
    return getSignerForAddress(pinned);
  }, [pinned, getSignerForAddress]);

  return {
    pinned,
    pin,
    unpin,
    getPinnedSigner,
    connectedAccounts,
    connect,
    isConnected,
    isConnecting,
  };
}
