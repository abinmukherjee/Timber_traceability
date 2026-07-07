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
import { useLots } from "../hooks/useQueries.js";
import { getWriteContract } from "../lib/contract.js";
import { uploadToPinata, ipfsUrl, etherscanTx, shortenAddr } from "../lib/api.js";

export default function Auction() {
  const pageWallet = usePageWallet("/auction");
  const queryClient = useQueryClient();
  const lots = useLots();

  const [form, setForm] = useState({ species: "", grade: "Grade A", coupeId: "", qty: "" });
  const [file, setFile] = useState(null);
  const [jwt, setJwt] = useState("");
  const [cid, setCid] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null); // { type, node }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleUpload() {
    if (!file) return;
    if (!jwt.trim()) return setStatus({ type: "error", node: "Enter your Pinata JWT to upload." });
    setUploading(true);
    setStatus({ type: "loading", node: "Uploading certificate to IPFS…" });
    try {
      const uploadedCid = await uploadToPinata(file, jwt.trim());
      setCid(uploadedCid);
      setStatus({ type: "success", node: <>Uploaded to IPFS · CID: <span className="font-mono">{uploadedCid}</span></> });
    } catch (err) {
      setStatus({ type: "error", node: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function handleRegister() {
    if (!pageWallet.pinned) {
      return setStatus({ type: "error", node: "Pin a wallet to this page above before registering a lot." });
    }
    const qty = parseInt(form.qty, 10);
    if (!form.species.trim() || !form.coupeId.trim() || !qty || qty <= 0) {
      return setStatus({ type: "error", node: "Fill in species, coupe ID, and a quantity > 0." });
    }
    if (file && !cid) {
      return setStatus({ type: "error", node: "You selected a file but haven't uploaded it to IPFS yet." });
    }

    setSubmitting(true);
    setStatus({ type: "loading", node: "Confirm the transaction in MetaMask…" });
    try {
      const signer = await pageWallet.getPinnedSigner();
      const contract = await getWriteContract(signer);
      const tx = await contract.registerLot(form.species.trim(), form.coupeId.trim(), form.grade, BigInt(qty), cid || "");
      setStatus({ type: "loading", node: `Transaction submitted (${tx.hash.slice(0, 10)}…). Waiting for confirmation…` });
      await tx.wait();
      setStatus({
        type: "success",
        node: (
          <>Lot registered! Tx:{" "}
            <a href={etherscanTx(tx.hash)} target="_blank" rel="noreferrer" className="underline">{tx.hash.slice(0, 14)}…</a>
            <br />The dashboard updates automatically once the listener mirrors the event.
          </>
        ),
      });
      setForm({ species: "", grade: form.grade, coupeId: "", qty: "" });
      setFile(null); setCid(""); setJwt("");
      queryClient.invalidateQueries({ queryKey: ["lots"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch (err) {
      setStatus({ type: "error", node: translateError(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Auction House"
        title="Register a timber lot"
        subtitle="Add a new wood lot to the chain. Requires the AUCTION_HOUSE_ROLE on the connected wallet."
      />

      <section className="mx-auto max-w-6xl px-5">
        <PinnedWalletBar pageLabel="Auction House" {...pageWallet} />

        <div className="card p-7">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="species">Species</Label>
              <Input id="species" value={form.species} onChange={set("species")} placeholder="e.g. Teak" />
            </div>
            <div>
              <Label htmlFor="grade">Grade</Label>
              <Select id="grade" value={form.grade} onChange={set("grade")}>
                <option>Grade A</option>
                <option>Grade B</option>
                <option>Grade C</option>
                <option value="Grade S">Grade S (Superior)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="coupe">Origin Coupe ID</Label>
              <Input id="coupe" value={form.coupeId} onChange={set("coupeId")} placeholder="e.g. KA-2024-001" />
            </div>
            <div>
              <Label htmlFor="qty">Quantity (cubic feet)</Label>
              <Input id="qty" type="number" min="1" value={form.qty} onChange={set("qty")} placeholder="e.g. 2000" />
            </div>

            <div className="sm:col-span-2">
              <Label>Auction Certificate — optional, stored on IPFS</Label>
              <FileDrop
                file={file}
                onSelect={(f) => { setFile(f); setCid(""); }}
                accent="timber"
                hint="Drag & drop or click to select a certificate (PDF, JPG, PNG)"
              />
              {file && !cid && (
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label htmlFor="jwt">Pinata JWT</Label>
                    <Input id="jwt" type="password" value={jwt} onChange={(e) => setJwt(e.target.value)} placeholder="eyJhbGciOi…" />
                  </div>
                  <Button variant="secondary" onClick={handleUpload} disabled={uploading}>
                    {uploading ? "Uploading…" : "Upload to IPFS"}
                  </Button>
                </div>
              )}
              {cid && (
                <p className="mt-2 text-sm text-timber">
                  ✓ Uploaded · <a href={ipfsUrl(cid)} target="_blank" rel="noreferrer" className="font-mono underline">{cid}</a>
                </p>
              )}
            </div>
          </div>

          <div className="mt-7">
            <Button variant="timber" size="lg" onClick={handleRegister} disabled={submitting}>
              {submitting ? "Processing…" : "Register Lot on Blockchain"}
            </Button>
          </div>
          {status && <StatusMessage type={status.type}>{status.node}</StatusMessage>}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <SectionHeader
          title="Registered lots"
          action={<Button variant="secondary" size="sm" onClick={() => lots.refetch()}>↻ Refresh</Button>}
        />
        <DataTable
          isLoading={lots.isLoading}
          isError={lots.isError}
          rows={(lots.data || []).slice().reverse()}
          rowKey={(r) => r.lotId}
          emptyMessage="No lots yet."
          columns={[
            { key: "lotId", header: "Lot #", render: (l) => <Pill tone="timber">#{l.lotId}</Pill> },
            { key: "species", header: "Species", render: (l) => l.species || "—" },
            { key: "grade", header: "Grade", render: (l) => l.grade || "—" },
            { key: "originCoupeId", header: "Coupe ID", render: (l) => l.originCoupeId || "—" },
            { key: "initialQty", header: "Initial", render: (l) => l.initialQty ?? "—" },
            { key: "remainingQty", header: "Remaining", render: (l) => <strong>{l.remainingQty ?? "—"}</strong> },
            {
              key: "ipfsHash", header: "IPFS",
              render: (l) => l.ipfsHash ? <a href={ipfsUrl(l.ipfsHash)} target="_blank" rel="noreferrer" className="text-ocean hover:underline">View ↗</a> : "—",
            },
            {
              key: "auctionHouse", header: "By", className: "font-mono text-xs",
              render: (l) => <span title={l.auctionHouse}>{shortenAddr(l.auctionHouse)}</span>,
            },
          ]}
        />
      </section>
    </>
  );
}

function translateError(err) {
  if (err?.code === 4001 || err?.code === "ACTION_REJECTED") return "Transaction rejected in MetaMask.";
  const msg = err?.reason || err?.shortMessage || err?.message || "Transaction failed.";
  if (msg.includes("missing role") || msg.includes("AccessControlUnauthorized"))
    return "This wallet does not have AUCTION_HOUSE_ROLE. Ask the admin to grant it.";
  return msg;
}
