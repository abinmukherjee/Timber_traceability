import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useVerify } from "../hooks/useQueries.js";
import Spinner from "../components/Spinner.jsx";
import Button from "../components/Button.jsx";
import { Input } from "../components/Field.jsx";
import { shortenAddr, ipfsUrl, qrImageUrl, etherscanTx, formatDate } from "../lib/api.js";

export default function Verify() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlId = searchParams.get("id") || "";
  const [input, setInput] = useState(urlId);
  const [activeId, setActiveId] = useState(urlId);

  // If the URL already has ?id= (QR-scan flow), verify immediately.
  useEffect(() => {
    if (urlId) {
      setInput(urlId);
      setActiveId(urlId);
    }
  }, [urlId]);

  const { data, isLoading, isError, error } = useVerify(activeId);

  function submit() {
    const id = input.trim();
    if (!id || isNaN(id) || parseInt(id, 10) < 1) return;
    setActiveId(id);
    setSearchParams({ id });
  }

  return (
    <>
      <section className="mx-auto max-w-3xl px-5 pt-16 pb-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Verify <span className="bg-gradient-to-r from-ocean to-grape bg-clip-text text-transparent">provenance</span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-lg text-subtle">
          Enter a furniture ID or scan its QR code to trace the complete blockchain supply chain.
        </p>
        <div className="mx-auto mt-8 flex max-w-md gap-2">
          <Input
            type="number" min="1" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Furniture ID (e.g. 1)"
          />
          <Button onClick={submit}>Verify →</Button>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-8">
        {isLoading && activeId && (
          <div className="py-16 text-center"><Spinner className="mx-auto" /></div>
        )}
        {isError && (
          <div className="rounded-apple border border-danger/20 bg-danger/5 p-8 text-center text-danger">
            <h3 className="mb-1 text-lg font-semibold">Not found</h3>
            <p className="text-sm">Furniture #{activeId} doesn't exist yet, or the backend is offline.</p>
            <p className="mt-1 text-xs opacity-70">{error?.message}</p>
          </div>
        )}
        {data && <Provenance data={data} id={activeId} />}
      </section>
    </>
  );
}

function Provenance({ data, id }) {
  const { furniture, batch, lot } = data;
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">
          Furniture #{furniture.id} — {furniture.type || "—"}
        </h2>
        <span className="inline-flex items-center gap-2 rounded-full border border-timber/25 bg-timber/10 px-4 py-1.5 text-sm font-semibold text-timber">
          ✓ Verified on Sepolia
        </span>
      </div>

      {/* QR */}
      <div className="card mb-8 p-8 text-center">
        <h3 className="mb-4 text-sm font-semibold text-subtle">Scan to re-verify</h3>
        <img
          src={qrImageUrl(id)} alt={`QR for furniture #${id}`}
          className="mx-auto w-44 rounded-xl border-4 border-white shadow-card"
          onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling.style.display = "block"; }}
        />
        <p style={{ display: "none" }} className="text-sm text-subtle">
          QR code appears once the listener processes the FurnitureCreated event.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          <a href={`?id=${furniture.id}`} className="rounded-full border border-hairline px-3.5 py-1.5 text-ocean hover:border-ocean">🔗 Permalink</a>
          {furniture.ipfsHash && <a href={ipfsUrl(furniture.ipfsHash)} target="_blank" rel="noreferrer" className="rounded-full border border-hairline px-3.5 py-1.5 text-ocean hover:border-ocean">📄 Certificate</a>}
          {furniture.txHash && <a href={etherscanTx(furniture.txHash)} target="_blank" rel="noreferrer" className="rounded-full border border-hairline px-3.5 py-1.5 text-ocean hover:border-ocean">⬡ Etherscan</a>}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <Node icon="🌳" tone="timber" step="Step 1 — Forest Origin" title="Timber Source"
          fields={[["Species", lot.species || "—"], ["Grade", lot.grade || "—"], ["Coupe ID", lot.originCoupeId || "—"]]} />
        <Node icon="📦" tone="timber" step="Step 2 — Auction Lot" title={`Lot #${lot.id}`}
          fields={[
            ["Registered by", shortenAddr(lot.auctionHouse)],
            ["Initial Qty", `${lot.initialQty ?? "—"} cft`],
            ["Remaining", `${lot.remainingQty ?? "—"} cft`],
            ["Registered", formatDate(lot.createdAt)],
          ]} />
        <Node icon="🪵" tone="ocean" step="Step 3 — Factory Purchase" title={`Batch #${batch.id}`}
          fields={[
            ["Purchased by", shortenAddr(batch.factory)],
            ["Qty Bought", `${batch.qty ?? "—"} cft`],
            ["Remaining", `${batch.remainingQty ?? "—"} cft`],
            ["Parent Lot", `#${batch.parentLotId}`],
          ]} />
        <Node icon="🛏️" tone="amber" step="Step 4 — Furniture Manufactured" title={`Furniture #${furniture.id} — ${furniture.type || "—"}`}
          fields={[
            ["Manufactured by", shortenAddr(furniture.manufacturer)],
            ["Wood Used", `${furniture.qtyUsed ?? "—"} cft`],
            ["Source Batch", `#${furniture.sourceBatchId ?? batch.id}`],
            ["Created", formatDate(furniture.createdAt)],
          ]} />
      </div>

      <p className="mt-8 text-center text-sm text-subtle">
        Provenance sourced from <strong className="text-ink">Ethereum Sepolia</strong>. The off-chain database is a read mirror — on-chain is the source of truth.
      </p>
    </div>
  );
}

const TONE = {
  timber: "bg-timber/10 border-timber/20 text-timber",
  ocean: "bg-ocean/10 border-ocean/20 text-ocean",
  amber: "bg-amber/10 border-amber/20 text-amber",
};

function Node({ icon, tone, step, title, fields }) {
  return (
    <div className="flex gap-4">
      <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border-2 text-2xl ${TONE[tone]}`}>{icon}</div>
      <div className="card flex-1 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{step}</p>
        <h3 className={`mb-3 text-lg font-semibold ${tone === "timber" ? "text-timber" : tone === "ocean" ? "text-ocean" : "text-amber"}`}>{title}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {fields.map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <span className="text-xs uppercase text-subtle">{label}</span>
              <span className="text-sm font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
