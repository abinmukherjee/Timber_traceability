/**
 * contract.js — loads the deployed contract address + ABI from
 * /contract-config.json (served from public/, swappable without a rebuild)
 * and builds ethers.js Contract instances.
 */
import { Contract } from "ethers";

let _configPromise = null;

/** Fetches and caches contract-config.json once per session. */
export function loadContractConfig() {
  if (!_configPromise) {
    _configPromise = fetch("/contract-config.json")
      .then((res) => {
        if (!res.ok) throw new Error("contract-config.json not found");
        return res.json();
      })
      .catch((err) => {
        _configPromise = null; // allow retry
        throw err;
      });
  }
  return _configPromise;
}

const ZERO = "0x0000000000000000000000000000000000000000";

export function isDeployed(config) {
  return config && config.address && config.address !== ZERO;
}

/** Read-only contract bound to a provider (for hasRole checks, etc.). */
export async function getReadContract(providerOrSigner) {
  const config = await loadContractConfig();
  if (!isDeployed(config)) {
    throw new Error(
      "Contract not deployed. Run: cd contracts && npx hardhat run scripts/deploy.js --network sepolia"
    );
  }
  return new Contract(config.address, config.abi, providerOrSigner);
}

/** Write contract bound to a signer (for state-changing txns). */
export async function getWriteContract(signer) {
  return getReadContract(signer);
}
