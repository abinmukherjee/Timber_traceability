import { useWallet } from "../hooks/useWallet.js";
import { shortenAddr } from "../lib/api.js";
import Button from "./Button.jsx";

export default function ConnectButton() {
  const { isConnected, address, connect, disconnect, isConnecting, isCorrectChain, ensureSepolia } =
    useWallet();

  if (isConnected) {
    if (!isCorrectChain) {
      return (
        <Button variant="danger" size="sm" onClick={ensureSepolia}>
          Wrong network — switch to Sepolia
        </Button>
      );
    }
    return (
      <button
        onClick={disconnect}
        title={address}
        className="group inline-flex items-center gap-2 rounded-full border border-timber/25 bg-timber/10 px-4 py-1.5 text-sm font-medium text-timber transition-colors hover:bg-timber/15"
      >
        <span className="h-2 w-2 rounded-full bg-timber" />
        <span className="font-mono">{shortenAddr(address)}</span>
        <span className="text-timber/50 group-hover:text-timber">·  Disconnect</span>
      </button>
    );
  }

  return (
    <Button size="sm" onClick={connect} disabled={isConnecting}>
      {isConnecting ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
