/**
 * WalletContext — a single persistent MetaMask connection shared across all
 * routes. Because this is an SPA, navigation no longer reloads the page, so the
 * connection survives route changes (fixing the "reconnect on every page" bug).
 *
 * Key behaviours:
 *  - On mount: silently restore an already-approved session via eth_accounts
 *    (NO popup). A popup only happens when the user clicks Connect (connect()).
 *  - accountsChanged / chainChanged update context state instead of reloading.
 *  - Enforces the Sepolia testnet (chainId 11155111).
 *  - Guards against multiple injected wallet providers.
 */
import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";

export const WalletContext = createContext(null);

const SEPOLIA_CHAIN_ID = 11155111n;
const SEPOLIA_HEX = "0xaa36a7";

/** Prefer the MetaMask provider if several wallets are injected. */
function getInjectedProvider() {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const eth = window.ethereum;
  if (Array.isArray(eth.providers) && eth.providers.length) {
    return eth.providers.find((p) => p.isMetaMask) || eth.providers[0];
  }
  return eth;
}

export function WalletProvider({ children }) {
  const [injected] = useState(getInjectedProvider);
  const [address, setAddress] = useState(null);
  const [signer, setSigner] = useState(null);
  const [provider, setProvider] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  // All accounts currently permitted to this site (not just the one MetaMask
  // shows as "active"). Verified: MetaMask will sign/send from any of these
  // when given an explicit address, letting each page pin a different one.
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  // Gate first render on the silent-restore attempt to avoid a connect flash.
  const [restoring, setRestoring] = useState(true);

  const hasMetaMask = Boolean(injected);

  /** Build provider/signer/state from a connected account address. */
  const hydrate = useCallback(
    async (account) => {
      if (!account) {
        setAddress(null);
        setSigner(null);
        setProvider(null);
        return;
      }
      const browserProvider = new BrowserProvider(injected);
      const network = await browserProvider.getNetwork();
      const nextSigner = await browserProvider.getSigner();
      setProvider(browserProvider);
      setSigner(nextSigner);
      setAddress(account);
      setChainId(network.chainId);
    },
    [injected]
  );

  /** Ask MetaMask to switch to Sepolia. Returns true on success. */
  const ensureSepolia = useCallback(async () => {
    try {
      await injected.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_HEX }],
      });
      return true;
    } catch {
      setError("Please switch MetaMask to the Sepolia testnet.");
      return false;
    }
  }, [injected]);

  /**
   * Explicit connect (button) — requests permission for one or more accounts.
   * Using wallet_requestPermissions (rather than plain eth_requestAccounts)
   * opens MetaMask's multi-select screen, so a user can grant several
   * accounts at once; each page can then pin a different one (see
   * usePageWallet / getSignerForAddress) with no manual switching needed.
   */
  const connect = useCallback(async () => {
    setError(null);
    if (!injected) {
      setError("MetaMask is not installed.");
      return null;
    }
    setIsConnecting(true);
    try {
      await injected.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      const accounts = await injected.request({ method: "eth_accounts" });
      setConnectedAccounts(accounts);
      const browserProvider = new BrowserProvider(injected);
      const network = await browserProvider.getNetwork();
      if (network.chainId !== SEPOLIA_CHAIN_ID) {
        const ok = await ensureSepolia();
        if (!ok) return null;
      }
      await hydrate(accounts[0]);
      return accounts[0];
    } catch (err) {
      if (err?.code === 4001) setError("Wallet connection rejected.");
      else setError(err?.message || "Failed to connect wallet.");
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [injected, ensureSepolia, hydrate]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setProvider(null);
    setConnectedAccounts([]);
    setError(null);
  }, []);

  /**
   * Returns a signer bound to a specific connected address, regardless of
   * which account MetaMask currently shows as "active". This is the
   * mechanism that lets each page (Auction/Factory/Admin) sign with its own
   * pinned wallet without the user switching accounts in the extension.
   */
  const getSignerForAddress = useCallback(
    async (targetAddress) => {
      if (!provider) throw new Error("Wallet not connected.");
      return provider.getSigner(targetAddress);
    },
    [provider]
  );

  // Silent restore on mount + wallet event subscriptions.
  useEffect(() => {
    if (!injected) {
      setRestoring(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        // eth_accounts is silent (no popup) and already returns every account
        // permitted to this site, not just the active one.
        const accounts = await injected.request({ method: "eth_accounts" });
        if (!cancelled && accounts && accounts.length) {
          setConnectedAccounts(accounts);
          await hydrate(accounts[0]);
        }
      } catch {
        /* ignore — user simply isn't connected yet */
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    const onAccountsChanged = (accounts) => {
      setConnectedAccounts(accounts || []);
      if (!accounts || accounts.length === 0) {
        disconnect();
      } else {
        hydrate(accounts[0]);
      }
    };
    const onChainChanged = () => {
      // Re-derive provider/signer/network without a full page reload.
      injected
        .request({ method: "eth_accounts" })
        .then((accs) => (accs?.length ? hydrate(accs[0]) : disconnect()))
        .catch(() => {});
    };

    injected.on?.("accountsChanged", onAccountsChanged);
    injected.on?.("chainChanged", onChainChanged);

    return () => {
      cancelled = true;
      injected.removeListener?.("accountsChanged", onAccountsChanged);
      injected.removeListener?.("chainChanged", onChainChanged);
    };
  }, [injected, hydrate, disconnect]);

  const value = useMemo(
    () => ({
      address,
      signer,
      provider,
      chainId,
      connectedAccounts,
      isConnected: Boolean(address),
      isCorrectChain: chainId === SEPOLIA_CHAIN_ID,
      isConnecting,
      restoring,
      hasMetaMask,
      error,
      connect,
      disconnect,
      ensureSepolia,
      getSignerForAddress,
    }),
    [
      address,
      signer,
      provider,
      chainId,
      connectedAccounts,
      isConnecting,
      restoring,
      hasMetaMask,
      error,
      connect,
      disconnect,
      ensureSepolia,
      getSignerForAddress,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
