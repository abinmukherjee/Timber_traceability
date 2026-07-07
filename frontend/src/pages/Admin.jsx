import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import PageHeader from "../components/PageHeader.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import Pill from "../components/Pill.jsx";
import Button from "../components/Button.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import { Label, Input, Select } from "../components/Field.jsx";
import PinnedWalletBar from "../components/PinnedWalletBar.jsx";
import { usePageWallet } from "../hooks/usePageWallet.js";
import { useRoles } from "../hooks/useQueries.js";
import { getWriteContract } from "../lib/contract.js";
import { apiPrepareGrant, apiPrepareRevoke, etherscanTx, shortenAddr } from "../lib/api.js";

const roleTone = (name) => (name === "AUCTION_HOUSE" ? "ocean" : name === "FACTORY" ? "amber" : "grape");
const validAddr = (a) => /^0x[a-fA-F0-9]{40}$/.test(a);

export default function Admin() {
  const pageWallet = usePageWallet("/admin");
  const queryClient = useQueryClient();
  const roles = useRoles();

  const [grant, setGrant] = useState({ wallet: "", role: "AUCTION_HOUSE" });
  const [revoke, setRevoke] = useState({ wallet: "", role: "AUCTION_HOUSE" });
  const [grantStatus, setGrantStatus] = useState(null);
  const [revokeStatus, setRevokeStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const refreshRoles = () => queryClient.invalidateQueries({ queryKey: ["roles"] });

  /** On-chain pre-check: roles are mutually exclusive. Returns existing role or null. */
  async function existingRole(wallet, signer) {
    const contract = await getWriteContract(signer);
    const [aHash, fHash] = await Promise.all([contract.AUCTION_HOUSE_ROLE(), contract.FACTORY_ROLE()]);
    const [hasA, hasF] = await Promise.all([contract.hasRole(aHash, wallet), contract.hasRole(fHash, wallet)]);
    return hasA ? "AUCTION_HOUSE" : hasF ? "FACTORY" : null;
  }

  async function doGrant() {
    if (!pageWallet.pinned) {
      return setGrantStatus({ type: "error", node: "Pin a wallet to this page above before granting a role." });
    }
    if (!validAddr(grant.wallet.trim())) return setGrantStatus({ type: "error", node: "Enter a valid 42-character address (0x…)." });
    setBusy(true);
    setGrantStatus({ type: "loading", node: "Checking existing on-chain roles…" });
    try {
      const signer = await pageWallet.getPinnedSigner();
      const existing = await existingRole(grant.wallet.trim(), signer);
      if (existing) {
        setRevoke({ wallet: grant.wallet.trim(), role: existing });
        setGrantStatus({ type: "error", node: `This address already holds ${existing}. Revoke it first (the revoke form is pre-filled).` });
        setBusy(false);
        return;
      }
      setGrantStatus({ type: "loading", node: "Fetching role hash & awaiting MetaMask…" });
      const { roleHash } = await apiPrepareGrant(grant.wallet.trim(), grant.role);
      const contract = await getWriteContract(signer);
      const tx = await contract.grantRole(roleHash, grant.wallet.trim());
      setGrantStatus({ type: "loading", node: `Tx ${tx.hash.slice(0, 12)}… waiting…` });
      await tx.wait();
      setGrantStatus({ type: "success", node: <>{grant.role} granted! Tx: <a href={etherscanTx(tx.hash)} target="_blank" rel="noreferrer" className="underline">{tx.hash.slice(0, 16)}…</a></> });
      setGrant((g) => ({ ...g, wallet: "" }));
      refreshRoles();
    } catch (err) {
      setGrantStatus({ type: "error", node: translateAdminError(err) });
    } finally {
      setBusy(false);
    }
  }

  async function doRevoke() {
    if (!pageWallet.pinned) {
      return setRevokeStatus({ type: "error", node: "Pin a wallet to this page above before revoking a role." });
    }
    if (!validAddr(revoke.wallet.trim())) return setRevokeStatus({ type: "error", node: "Enter a valid 42-character address." });
    setBusy(true);
    setRevokeStatus({ type: "loading", node: "Fetching role hash & awaiting MetaMask…" });
    try {
      const { roleHash } = await apiPrepareRevoke(revoke.wallet.trim(), revoke.role);
      const signer = await pageWallet.getPinnedSigner();
      const contract = await getWriteContract(signer);
      const tx = await contract.revokeRole(roleHash, revoke.wallet.trim());
      setRevokeStatus({ type: "loading", node: `Tx ${tx.hash.slice(0, 12)}… waiting…` });
      await tx.wait();
      setRevokeStatus({ type: "success", node: <>{revoke.role} revoked! Tx: <a href={etherscanTx(tx.hash)} target="_blank" rel="noreferrer" className="underline">{tx.hash.slice(0, 16)}…</a></> });
      setRevoke((r) => ({ ...r, wallet: "" }));
      refreshRoles();
    } catch (err) {
      setRevokeStatus({ type: "error", node: translateAdminError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Role management"
        subtitle="Grant or revoke Auction House and Factory roles. Only the deployer (DEFAULT_ADMIN_ROLE) can do this."
      />

      <section className="mx-auto max-w-6xl px-5">
        <PinnedWalletBar pageLabel="Admin" {...pageWallet} />

        <div className="mb-6 flex items-start gap-3 rounded-apple border border-grape/20 bg-grape/5 px-5 py-4 text-sm text-subtle">
          <span className="text-lg">🔐</span>
          <p>
            The backend returns a role hash → you sign <code className="text-ink">grantRole()</code> / <code className="text-ink">revokeRole()</code> in MetaMask →
            the chain emits an event → the listener mirrors it to the database. <strong className="text-ink">No private key is ever stored server-side.</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Grant */}
          <div className="card p-7">
            <h2 className="mb-5 text-lg font-semibold">🔑 Grant Role</h2>
            <div className="mb-4">
              <Label htmlFor="gw">Target Wallet Address</Label>
              <Input id="gw" value={grant.wallet} onChange={(e) => setGrant((g) => ({ ...g, wallet: e.target.value }))} placeholder="0x…" />
            </div>
            <div className="mb-5">
              <Label htmlFor="gr">Role to Grant</Label>
              <Select id="gr" value={grant.role} onChange={(e) => setGrant((g) => ({ ...g, role: e.target.value }))}>
                <option value="AUCTION_HOUSE">Auction House</option>
                <option value="FACTORY">Factory</option>
              </Select>
            </div>
            <Button variant="timber" className="w-full" onClick={doGrant} disabled={busy}>Grant Role via MetaMask</Button>
            {grantStatus && <StatusMessage type={grantStatus.type}>{grantStatus.node}</StatusMessage>}
          </div>

          {/* Revoke */}
          <div className="card p-7">
            <h2 className="mb-5 text-lg font-semibold">🚫 Revoke Role</h2>
            <div className="mb-4">
              <Label htmlFor="rw">Target Wallet Address</Label>
              <Input id="rw" value={revoke.wallet} onChange={(e) => setRevoke((r) => ({ ...r, wallet: e.target.value }))} placeholder="0x…" />
            </div>
            <div className="mb-5">
              <Label htmlFor="rr">Role to Revoke</Label>
              <Select id="rr" value={revoke.role} onChange={(e) => setRevoke((r) => ({ ...r, role: e.target.value }))}>
                <option value="AUCTION_HOUSE">Auction House</option>
                <option value="FACTORY">Factory</option>
              </Select>
            </div>
            <Button variant="danger" className="w-full" onClick={doRevoke} disabled={busy}>Revoke Role via MetaMask</Button>
            {revokeStatus && <StatusMessage type={revokeStatus.type}>{revokeStatus.node}</StatusMessage>}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <SectionHeader
          title="Current role assignments"
          action={<Button variant="secondary" size="sm" onClick={() => roles.refetch()}>↻ Refresh</Button>}
        />
        <DataTable
          isLoading={roles.isLoading}
          isError={roles.isError}
          rows={roles.data || []}
          rowKey={(r) => r.id}
          emptyMessage="No roles assigned yet."
          columns={[
            { key: "wallet", header: "Wallet", className: "font-mono text-xs", render: (r) => <span title={r.wallet}>{shortenAddr(r.wallet)}</span> },
            { key: "roleName", header: "Role", render: (r) => <Pill tone={roleTone(r.roleName)}>{r.roleName}</Pill> },
            { key: "grantedBy", header: "Granted By", className: "font-mono text-xs", render: (r) => <span title={r.grantedBy}>{shortenAddr(r.grantedBy)}</span> },
            { key: "active", header: "Status", render: (r) => <Pill tone={r.active ? "timber" : "danger"}>{r.active ? "Active" : "Revoked"}</Pill> },
            {
              key: "action", header: "Quick Action",
              render: (r) => r.active ? (
                <button
                  onClick={() => setRevoke({ wallet: r.wallet, role: r.roleName })}
                  className="rounded-full border border-danger/20 bg-danger/10 px-3 py-1 text-xs font-medium text-danger hover:bg-danger/15"
                >Revoke</button>
              ) : "—",
            },
          ]}
        />
      </section>
    </>
  );
}

function translateAdminError(err) {
  if (err?.code === 4001 || err?.code === "ACTION_REJECTED") return "Transaction rejected in MetaMask.";
  const msg = err?.reason || err?.shortMessage || err?.message || "Transaction failed.";
  if (msg.includes("missing role") || msg.includes("AccessControlUnauthorized")) return "The connected wallet does not have DEFAULT_ADMIN_ROLE.";
  if (msg.includes("already holds a supply-chain role")) return "This address already holds a role. Revoke it first.";
  return msg;
}
