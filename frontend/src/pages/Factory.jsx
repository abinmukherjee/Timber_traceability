import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import PageHeader from "../components/PageHeader.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import Pill from "../components/Pill.jsx";
import Button from "../components/Button.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import { Label, Input, Select } from "../components/Field.jsx";
import FileDrop from "../components/FileDrop.jsx";
import PinnedWalletBar from "../components/PinnedWalletBar.jsx";
import { usePageWallet } from "../hooks/usePageWallet.js";
import { useBatchesByFactory } from "../hooks/useQueries.js";
import { getWriteContract } from "../lib/contract.js";
import { apiGetLot, apiGetBatch, uploadToPinata, ipfsUrl, etherscanTx } from "../lib/api.js";

export default function Factory() {
  const pageWallet = usePageWallet("/factory");
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("buy");
  const batches = useBatchesByFactory(pageWallet.pinned);

  return (
    <>
      <PageHeader
        eyebrow="Factory"
        title="Buy wood & build furniture"
        subtitle="Purchase from registered lots or manufacture furniture from your batches. Requires the FACTORY_ROLE."
      />

      <section className="mx-auto max-w-6xl px-5">
        <PinnedWalletBar pageLabel="Factory" {...pageWallet} />

        <div className="mb-6 inline-flex rounded-full bg-mist p-1">
          {[["buy", "🪵 Buy Wood"], ["make", "🛏️ Create Furniture"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
                tab === key ? "bg-white text-ink shadow-sm" : "text-subtle hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "buy" ? (
          <BuyWood
            pageWallet={pageWallet}
            onDone={() => {
              queryClient.invalidateQueries({ queryKey: ["batches"] });
              queryClient.invalidateQueries({ queryKey: ["stats"] });
              queryClient.invalidateQueries({ queryKey: ["lots"] });
            }}
          />
        ) : (
          <CreateFurniture
            pageWallet={pageWallet}
            onDone={() => {
              queryClient.invalidateQueries({ queryKey: ["batches"] });
              queryClient.invalidateQueries({ queryKey: ["stats"] });
            }}
          />
        )}
      </section>

      {tab === "make" && (
        <section className="mx-auto max-w-6xl px-5">
          <SectionHeader
            title="My batches"
            action={<Button variant="secondary" size="sm" onClick={() => batches.refetch()}>↻ Refresh</Button>}
          />
          <DataTable
            isLoading={batches.isLoading}
            isError={batches.isError}
            rows={batches.data || []}
            rowKey={(b) => b.batchId}
            emptyMessage={pageWallet.pinned ? "No batches for this wallet yet." : "Pin a wallet to this page to see your batches."}
            columns={[
              { key: "batchId", header: "Batch #", render: (b) => <Pill tone="ocean">#{b.batchId}</Pill> },
              { key: "parentLotId", header: "Parent Lot", render: (b) => `#${b.parentLotId}` },
              { key: "qty", header: "Qty (cft)", render: (b) => b.qty },
              { key: "remainingQty", header: "Remaining (cft)", render: (b) => <strong className="text-amber">{b.remainingQty}</strong> },
            ]}
          />
        </section>
      )}
    </>
  );
}

// ── Buy Wood tab ─────────────────────────────────────────────────────────────
function BuyWood({ pageWallet, onDone }) {
  const [lotId, setLotId] = useState("");
  const [qty, setQty] = useState("");
  const [lotInfo, setLotInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  async function lookupLot(id) {
    if (!id) return setLotInfo(null);
    try {
      const lot = await apiGetLot(id);
      setLotInfo({ ok: true, lot });
    } catch {
      setLotInfo({ ok: false });
    }
  }

  async function buy() {
    if (!pageWallet.pinned) {
      return setStatus({ type: "error", node: "Pin a wallet to this page above before buying wood." });
    }
    const l = parseInt(lotId, 10), q = parseInt(qty, 10);
    if (!l || !q || q <= 0) return setStatus({ type: "error", node: "Enter a valid Lot ID and quantity > 0." });

    setSubmitting(true);
    setStatus({ type: "loading", node: "Confirm the transaction in MetaMask…" });
    try {
      const signer = await pageWallet.getPinnedSigner();
      const contract = await getWriteContract(signer);
      const tx = await contract.purchaseWood(BigInt(l), BigInt(q));
      setStatus({ type: "loading", node: `Tx ${tx.hash.slice(0, 12)}… waiting for confirmation…` });
      await tx.wait();
      setStatus({
        type: "success",
        node: <>Wood purchased — batch created! Tx: <a href={etherscanTx(tx.hash)} target="_blank" rel="noreferrer" className="underline">{tx.hash.slice(0, 14)}…</a></>,
      });
      setQty("");
      onDone();
    } catch (err) {
      setStatus({ type: "error", node: translateError(err, "FACTORY") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-7">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="lotId">Lot ID</Label>
          <Input id="lotId" type="number" min="1" value={lotId}
            onChange={(e) => { setLotId(e.target.value); lookupLot(e.target.value); }} placeholder="e.g. 1" />
        </div>
        <div>
          <Label htmlFor="buyQty">Quantity to Buy (cft)</Label>
          <Input id="buyQty" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 100" />
        </div>
      </div>
      <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${lotInfo?.ok ? "border-timber/25 bg-timber/8 text-[#15803d]" : "border-hairline bg-mist text-subtle"}`}>
        {lotInfo == null && "Enter a Lot ID to see its details."}
        {lotInfo?.ok === false && "⚠️ Lot not found or backend offline."}
        {lotInfo?.ok && (
          <>
            <strong>Species:</strong> {lotInfo.lot.species || "—"} &nbsp;·&nbsp;
            <strong>Grade:</strong> {lotInfo.lot.grade || "—"} &nbsp;·&nbsp;
            <strong>Remaining:</strong> <span className="font-semibold text-timber">{lotInfo.lot.remainingQty} cft</span>
          </>
        )}
      </div>
      <div className="mt-6">
        <Button size="lg" onClick={buy} disabled={submitting}>{submitting ? "Processing…" : "Buy Wood (MetaMask)"}</Button>
      </div>
      {status && <StatusMessage type={status.type}>{status.node}</StatusMessage>}
    </div>
  );
}

// ── Create Furniture tab ─────────────────────────────────────────────────────
function CreateFurniture({ pageWallet, onDone }) {
  const [batchId, setBatchId] = useState("");
  const [type, setType] = useState("Bed");
  const [qty, setQty] = useState("");
  const [batchInfo, setBatchInfo] = useState(null);
  const [file, setFile] = useState(null);
  const [jwt, setJwt] = useState("");
  const [cid, setCid] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  async function lookupBatch(id) {
    if (!id) return setBatchInfo(null);
    try {
      const b = await apiGetBatch(id);
      setBatchInfo({ ok: true, b });
    } catch {
      setBatchInfo({ ok: false });
    }
  }

  async function upload() {
    if (!file) return;
    if (!jwt.trim()) return setStatus({ type: "error", node: "Enter your Pinata JWT." });
    setUploading(true);
    setStatus({ type: "loading", node: "Uploading to IPFS…" });
    try {
      const c = await uploadToPinata(file, jwt.trim());
      setCid(c);
      setStatus({ type: "success", node: <>Uploaded · CID: <span className="font-mono">{c}</span></> });
    } catch (err) {
      setStatus({ type: "error", node: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function create() {
    if (!pageWallet.pinned) {
      return setStatus({ type: "error", node: "Pin a wallet to this page above before creating furniture." });
    }
    const b = parseInt(batchId, 10), q = parseInt(qty, 10);
    if (!b || !q || q <= 0) return setStatus({ type: "error", node: "Enter a valid Batch ID and quantity > 0." });
    if (file && !cid) return setStatus({ type: "error", node: "File selected but not uploaded to IPFS yet." });

    setSubmitting(true);
    setStatus({ type: "loading", node: "Confirm in MetaMask…" });
    try {
      const signer = await pageWallet.getPinnedSigner();
      const contract = await getWriteContract(signer);
      const tx = await contract.createFurniture(BigInt(b), type, BigInt(q), cid || "");
      setStatus({ type: "loading", node: `Tx ${tx.hash.slice(0, 12)}… waiting…` });
      await tx.wait();
      setStatus({
        type: "success",
        node: <>Furniture created! Tx: <a href={etherscanTx(tx.hash)} target="_blank" rel="noreferrer" className="underline">{tx.hash.slice(0, 14)}…</a><br />Its QR code appears on the Verify page once the listener processes the event.</>,
      });
      setQty(""); setFile(null); setCid(""); setJwt("");
      onDone();
    } catch (err) {
      setStatus({ type: "error", node: translateError(err, "FACTORY") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-7">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="batchId">Batch ID</Label>
          <Input id="batchId" type="number" min="1" value={batchId}
            onChange={(e) => { setBatchId(e.target.value); lookupBatch(e.target.value); }} placeholder="e.g. 1" />
        </div>
        <div>
          <Label htmlFor="ftype">Furniture Type</Label>
          <Select id="ftype" value={type} onChange={(e) => setType(e.target.value)}>
            {["Bed", "Chair", "Table", "Sofa", "Cabinet", "Wardrobe", "Desk", "Bookshelf", "Other"].map((t) => <option key={t}>{t}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="fqty">Wood Used (cft)</Label>
          <Input id="fqty" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 40" />
        </div>
        <div className="flex items-end">
          <div className={`w-full rounded-2xl border px-4 py-3 text-sm ${batchInfo?.ok ? "border-timber/25 bg-timber/8 text-[#15803d]" : "border-hairline bg-mist text-subtle"}`}>
            {batchInfo == null && "Enter a Batch ID to see details."}
            {batchInfo?.ok === false && "⚠️ Batch not found."}
            {batchInfo?.ok && (
              <><strong>Lot:</strong> #{batchInfo.b.parentLotId} · <strong>Remaining:</strong> <span className="font-semibold text-amber">{batchInfo.b.remainingQty} cft</span></>
            )}
          </div>
        </div>

        <div className="sm:col-span-2">
          <Label>Product Certificate / Image — stored on IPFS</Label>
          <FileDrop file={file} onSelect={(f) => { setFile(f); setCid(""); }} accent="ocean" hint="Select a product certificate or image" />
          {file && !cid && (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="fjwt">Pinata JWT</Label>
                <Input id="fjwt" type="password" value={jwt} onChange={(e) => setJwt(e.target.value)} placeholder="eyJhbGciOi…" />
              </div>
              <Button variant="secondary" onClick={upload} disabled={uploading}>{uploading ? "Uploading…" : "Upload to IPFS"}</Button>
            </div>
          )}
          {cid && <p className="mt-2 text-sm text-timber">✓ Uploaded · <a href={ipfsUrl(cid)} target="_blank" rel="noreferrer" className="font-mono underline">{cid}</a></p>}
        </div>
      </div>

      <div className="mt-6">
        <Button size="lg" onClick={create} disabled={submitting}>{submitting ? "Processing…" : "Create Furniture (MetaMask)"}</Button>
      </div>
      {status && <StatusMessage type={status.type}>{status.node}</StatusMessage>}
    </div>
  );
}

function translateError(err, role) {
  if (err?.code === 4001 || err?.code === "ACTION_REJECTED") return "Transaction rejected in MetaMask.";
  const msg = err?.reason || err?.shortMessage || err?.message || "Transaction failed.";
  if (msg.includes("missing role") || msg.includes("AccessControlUnauthorized")) return `This wallet does not have ${role}_ROLE.`;
  if (msg.includes("Insufficient lot")) return "Not enough remaining quantity in that lot.";
  if (msg.includes("Insufficient batch")) return "Not enough remaining quantity in this batch.";
  if (msg.includes("Not batch owner")) return "You are not the owner of this batch.";
  return msg;
}
