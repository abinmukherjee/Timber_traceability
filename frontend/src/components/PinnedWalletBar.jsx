import { useState } from "react";
import Button from "./Button.jsx";
import { shortenAddr } from "../lib/api.js";
import { getWalletLabel, setWalletLabel } from "../lib/pinnedWallets.js";

/**
 * Lets a write page (Auction House / Factory / Admin) pin one connected
 * wallet to itself. Once pinned, that page always signs with that address —
 * no manual account switching in MetaMask required (verified: MetaMask
 * signs/sends from any permitted address, not just the "active" one).
 */
export default function PinnedWalletBar({
  pageLabel,
  pinned,
  pin,
  connectedAccounts,
  connect,
  isConnected,
  isConnecting,
}) {
  const [picking, setPicking] = useState(!pinned);
  const [, forceUpdate] = useState(0);

  function label(addr) {
    return getWalletLabel(addr) || shortenAddr(addr);
  }

  function rename(addr) {
    const next = window.prompt("Label this wallet (e.g. \"Factory\"):", getWalletLabel(addr) || "");
    if (next !== null) {
      setWalletLabel(addr, next.trim());
      forceUpdate((n) => n + 1);
    }
  }

  if (pinned && !picking) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-apple border border-timber/20 bg-timber/5 px-5 py-3">
        <span className="text-sm">
          📌 <strong>{pageLabel}</strong> is pinned to{" "}
          <span className="font-mono font-medium text-timber" title={pinned}>
            {label(pinned)}
          </span>
        </span>
        <button onClick={() => setPicking(true)} className="text-sm font-medium text-ocean hover:underline">
          Change wallet
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-apple border border-hairline bg-mist/60 p-5">
      <h3 className="mb-3 text-sm font-semibold">
        {isConnected ? `Pin a wallet to ${pageLabel}` : `Connect a wallet to use ${pageLabel}`}
      </h3>

      {connectedAccounts.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {connectedAccounts.map((addr) => (
            <span
              key={addr}
              className={`inline-flex items-center gap-1 rounded-full border pl-3.5 pr-1 py-1 text-xs transition-colors ${
                addr === pinned ? "border-timber bg-timber/10 text-timber" : "border-hairline hover:border-ocean"
              }`}
            >
              <button onClick={() => { pin(addr); setPicking(false); }} className="font-mono" title={addr}>
                {label(addr)}
              </button>
              <button
                onClick={() => rename(addr)}
                className="rounded-full px-1.5 py-0.5 text-subtle hover:bg-white hover:text-ink"
                title="Rename this wallet"
              >
                ✎
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={connect} disabled={isConnecting}>
          {isConnecting
            ? "Opening MetaMask…"
            : connectedAccounts.length
            ? "Connect another wallet"
            : "Connect wallet(s)"}
        </Button>
        {pinned && (
          <button onClick={() => setPicking(false)} className="text-sm text-subtle hover:text-ink">
            Cancel
          </button>
        )}
      </div>

      {connectedAccounts.length > 0 && (
        <p className="mt-3 text-xs text-subtle">
          Click a wallet above to pin it to {pageLabel} — it'll always sign from that address here, with no need to
          switch accounts in MetaMask. Click ✎ to give it a friendly name.
        </p>
      )}
    </div>
  );
}
