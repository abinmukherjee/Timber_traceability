import { useEffect, useState } from "react";
import { loadContractConfig, isDeployed } from "../lib/contract.js";
import { shortenAddr } from "../lib/api.js";

export default function Footer() {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    loadContractConfig().then(setConfig).catch(() => {});
  }, []);

  return (
    <footer className="mt-24 border-t border-hairline py-10 text-center text-sm text-subtle">
      <p>
        TimberTrace — Blockchain Supply Chain Traceability&nbsp;·&nbsp;Ethereum{" "}
        <strong className="font-medium text-ink">Sepolia</strong> Testnet
      </p>
      {config && (
        <p className="mt-1 font-mono text-xs">
          Contract:{" "}
          {isDeployed(config) ? (
            <a
              href={`https://sepolia.etherscan.io/address/${config.address}`}
              target="_blank"
              rel="noreferrer"
              className="text-ocean hover:underline"
            >
              {shortenAddr(config.address)}
            </a>
          ) : (
            "Not deployed"
          )}
        </p>
      )}
    </footer>
  );
}
