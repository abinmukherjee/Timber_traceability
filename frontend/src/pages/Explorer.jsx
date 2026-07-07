import { useMemo, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import Pill from "../components/Pill.jsx";
import Button from "../components/Button.jsx";
import { Input } from "../components/Field.jsx";
import { useLots, useAllBatches, useFurnitures, useRoles } from "../hooks/useQueries.js";
import { shortenAddr, etherscanTx, formatTimestamp, ipfsUrl } from "../lib/api.js";

const roleTone = (name) =>
  name === "AUCTION_HOUSE" ? "ocean" : name === "FACTORY" ? "amber" : "grape";

const txLink = (hash) =>
  hash ? (
    <a href={etherscanTx(hash)} target="_blank" rel="noreferrer" className="text-ocean hover:underline">
      {hash.slice(0, 10)}…
    </a>
  ) : (
    "—"
  );

const addr = (a) => <span title={a} className="font-mono text-xs">{shortenAddr(a)}</span>;
const ipfs = (cid) =>
  cid ? (
    <a href={ipfsUrl(cid)} target="_blank" rel="noreferrer" className="text-ocean hover:underline">
      View ↗
    </a>
  ) : (
    "—"
  );

// Column definitions per table.
const TABLES = {
  lots: {
    label: "Lots",
    rowKey: (r) => r.lotId,
    columns: [
      { key: "lotId", header: "Lot #", render: (r) => <Pill tone="timber">#{r.lotId}</Pill> },
      { key: "species", header: "Species", render: (r) => r.species || "—" },
      { key: "grade", header: "Grade", render: (r) => r.grade || "—" },
      { key: "originCoupeId", header: "Coupe ID", render: (r) => r.originCoupeId || "—" },
      { key: "initialQty", header: "Initial", render: (r) => r.initialQty ?? "—" },
      { key: "remainingQty", header: "Remaining", render: (r) => <strong>{r.remainingQty ?? "—"}</strong> },
      { key: "auctionHouse", header: "Auction House", render: (r) => addr(r.auctionHouse) },
      { key: "ipfsHash", header: "IPFS", render: (r) => ipfs(r.ipfsHash) },
      { key: "createdAt", header: "Created", render: (r) => formatTimestamp(r.createdAt) },
      { key: "txHash", header: "Tx", render: (r) => txLink(r.txHash) },
    ],
  },
  batches: {
    label: "Batches",
    rowKey: (r) => r.batchId,
    columns: [
      { key: "batchId", header: "Batch #", render: (r) => <Pill tone="ocean">#{r.batchId}</Pill> },
      { key: "parentLotId", header: "Parent Lot", render: (r) => `#${r.parentLotId}` },
      { key: "factory", header: "Factory", render: (r) => addr(r.factory) },
      { key: "qty", header: "Qty", render: (r) => r.qty ?? "—" },
      { key: "remainingQty", header: "Remaining", render: (r) => <strong>{r.remainingQty ?? "—"}</strong> },
      { key: "createdAt", header: "Created", render: (r) => formatTimestamp(r.createdAt) },
      { key: "txHash", header: "Tx", render: (r) => txLink(r.txHash) },
    ],
  },
  furnitures: {
    label: "Furnitures",
    rowKey: (r) => r.furnitureId,
    columns: [
      { key: "furnitureId", header: "Furn #", render: (r) => <Pill tone="amber">#{r.furnitureId}</Pill> },
      { key: "furnitureType", header: "Type", render: (r) => r.furnitureType || "—" },
      { key: "sourceBatchId", header: "Source Batch", render: (r) => `#${r.sourceBatchId}` },
      { key: "qtyUsed", header: "Qty Used", render: (r) => r.qtyUsed ?? "—" },
      { key: "manufacturer", header: "Manufacturer", render: (r) => addr(r.manufacturer) },
      { key: "ipfsHash", header: "IPFS", render: (r) => ipfs(r.ipfsHash) },
      { key: "createdAt", header: "Created", render: (r) => formatTimestamp(r.createdAt) },
      { key: "txHash", header: "Tx", render: (r) => txLink(r.txHash) },
    ],
  },
  roles: {
    label: "Roles",
    rowKey: (r) => r.id,
    columns: [
      { key: "id", header: "ID", render: (r) => r.id },
      { key: "wallet", header: "Wallet", render: (r) => addr(r.wallet) },
      { key: "roleName", header: "Role", render: (r) => <Pill tone={roleTone(r.roleName)}>{r.roleName}</Pill> },
      { key: "grantedBy", header: "Granted By", render: (r) => addr(r.grantedBy) },
      { key: "active", header: "Status", render: (r) => <Pill tone={r.active ? "timber" : "danger"}>{r.active ? "Active" : "Revoked"}</Pill> },
      { key: "createdAt", header: "Recorded", render: (r) => formatTimestamp(r.createdAt) },
      { key: "txHash", header: "Tx", render: (r) => txLink(r.txHash) },
    ],
  },
};

const TAB_KEYS = ["lots", "batches", "furnitures", "roles"];

export default function Explorer() {
  const [tab, setTab] = useState("lots");
  const [query, setQuery] = useState("");

  // Call all four hooks (Rules of Hooks — can't call conditionally).
  const data = {
    lots: useLots(),
    batches: useAllBatches(),
    furnitures: useFurnitures(),
    roles: useRoles(),
  };

  const active = TABLES[tab];
  const result = data[tab];

  const filtered = useMemo(() => {
    const rows = result.data || [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q))
    );
  }, [result.data, query]);

  return (
    <>
      <PageHeader
        eyebrow="Database Explorer"
        title="All mirrored records"
        subtitle="Every row the event listener has mirrored from Sepolia into PostgreSQL. Read-only, auto-refreshing every 5 seconds. The blockchain remains the source of truth."
      />

      <section className="mx-auto max-w-6xl px-5">
        {/* Tabs with live counts */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap rounded-full bg-mist p-1">
            {TAB_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
                  tab === key ? "bg-white text-ink shadow-sm" : "text-subtle hover:text-ink"
                }`}
              >
                {TABLES[key].label}
                <span className="ml-1.5 text-xs text-subtle">
                  {data[key].data?.length ?? "…"}
                </span>
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => result.refetch()}>
            ↻ Refresh
          </Button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${active.label.toLowerCase()} — any field (address, tx hash, species, …)`}
          />
        </div>

        <div className="mb-2 text-sm text-subtle">
          Showing <strong className="text-ink">{filtered.length}</strong>
          {query && <> of {result.data?.length ?? 0}</>} {active.label.toLowerCase()}
        </div>

        <DataTable
          columns={active.columns}
          rows={filtered}
          rowKey={active.rowKey}
          isLoading={result.isLoading}
          isError={result.isError}
          emptyMessage={query ? "No rows match your search." : `No ${active.label.toLowerCase()} yet.`}
          errorMessage="Backend offline — can't read the database."
        />
      </section>
    </>
  );
}
