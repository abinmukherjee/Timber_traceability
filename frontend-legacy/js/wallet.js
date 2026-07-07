/**
 * wallet.js — Shared MetaMask connection utility
 * Include this before any page-specific scripts.
 * Requires ethers.js v6 loaded via CDN.
 */

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

/**
 * Connect to MetaMask and return { provider, signer, address }.
 * Automatically prompts to switch to Sepolia if wrong network.
 * Returns null if MetaMask is not installed or user rejects.
 */
async function connectWallet() {
  if (!window.ethereum) {
    showWalletError("MetaMask is not installed. Please install MetaMask to use this application.");
    return null;
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);

    // Verify correct network
    const network = await provider.getNetwork();
    if (network.chainId !== 11155111n) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
      } catch (switchErr) {
        showWalletError("Please switch MetaMask to the Sepolia testnet.");
        return null;
      }
    }

    const signer  = await provider.getSigner();
    const address = await signer.getAddress();

    updateWalletUI(address);
    return { provider, signer, address };

  } catch (err) {
    if (err.code === 4001) {
      showWalletError("Wallet connection rejected by user.");
    } else {
      showWalletError("Failed to connect wallet: " + err.message);
    }
    return null;
  }
}

/**
 * Get an ethers.js Contract instance connected to the signer (for write txns)
 * or provider (for reads).
 */
function getContract(signer) {
  if (!CONTRACT_CONFIG || !CONTRACT_CONFIG.address || CONTRACT_CONFIG.address === "0x0000000000000000000000000000000000000000") {
    throw new Error("Contract not yet deployed. Run: cd contracts && npx hardhat run scripts/deploy.js --network sepolia");
  }
  return new ethers.Contract(CONTRACT_CONFIG.address, CONTRACT_CONFIG.abi, signer);
}

/**
 * Updates the wallet address display element if it exists on the page.
 */
function updateWalletUI(address) {
  const el = document.getElementById("wallet-address");
  if (el) {
    el.textContent = address ? shortenAddress(address) : "Not connected";
    el.title       = address || "";
  }
  const btn = document.getElementById("connect-btn");
  if (btn && address) {
    btn.textContent = "Connected ✓";
    btn.classList.add("connected");
    btn.disabled = true;
  }
}

/**
 * Shortens an Ethereum address for display: 0x1234...5678
 */
function shortenAddress(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

/**
 * Displays a wallet error message on the page.
 */
function showWalletError(msg) {
  console.error("[wallet]", msg);
  const el = document.getElementById("wallet-error");
  if (el) {
    el.textContent = msg;
    el.style.display = "block";
  } else {
    alert(msg);
  }
}

/**
 * Listen for account and network changes.
 */
if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => {
    window.location.reload();
  });
  window.ethereum.on("chainChanged", () => {
    window.location.reload();
  });
}
