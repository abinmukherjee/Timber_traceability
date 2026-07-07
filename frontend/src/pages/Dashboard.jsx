import { Link } from "react-router-dom";
import { useStats, useLots, useRoles } from "../hooks/useQueries.js";
import StatCard from "../components/StatCard.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import DataTable from "../components/DataTable.jsx";
import Pill from "../components/Pill.jsx";
import { shortenAddr, etherscanTx } from "../lib/api.js";

const ACTIONS = [
  { to: "/auction", icon: "🌿", title: "Register Lot", desc: "Auction House — add a new wood lot" },
  { to: "/factory", icon: "🏭", title: "Buy / Manufacture", desc: "Factory — purchase or build furniture" },
  { to: "/verify", icon: "🔍", title: "Verify Provenance", desc: "Trace a piece's full chain" },
  { to: "/admin", icon: "⚙️", title: "Manage Roles", desc: "Admin — grant or revoke roles" },
];

const roleTone = (name) =>
  name === "AUCTION_HOUSE" ? "ocean" : name === "FACTORY" ? "amber" : "grape";

export default function Dashboard() {
  const stats = useStats();
  const lots = useLots();
  const roles = useRoles();

  const recentLots = (lots.data || []).slice().reverse().slice(0, 10);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-timber/8 to-transparent" />
        <div className="mx-auto max-w-6xl px-5 pt-20 pb-6 text-center">
          <h1 className="animate-fade-up text-5xl font-semibold tracking-tight sm:text-6xl">
            Timber, traced.
          </h1>
          <p className="mx-auto mt-4 max-w-xl animate-fade-up text-lg leading-relaxed text-subtle">
            Blockchain provenance for teakwood — from forest auction to finished
            furniture, verifiable on Ethereum Sepolia.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon="📦" value={stats.data?.lots} label="Lots Registered" accent="timber" delay={0} />
          <StatCard icon="🪵" value={stats.data?.batches} label="Wood Batches" accent="ocean" delay={60} />
          <StatCard icon="🛏️" value={stats.data?.furnitures} label="Furniture Items" accent="amber" delay={120} />
          <StatCard icon="🔑" value={stats.data?.roles} label="Active Roles" accent="grape" delay={180} />
        </div>
      </section>

      {/* Quick actions */}
      <section className="mx-auto max-w-6xl px-5">
        <SectionHeader title="Quick actions" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIONS.map((a) => (
            <Link key={a.to} to={a.to} className="card card-hover flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-mist text-2xl">
                {a.icon}
              </div>
              <div>
                <h3 className="text-[15px] font-semibold">{a.title}</h3>
                <p className="text-sm text-subtle">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent lots */}
      <section className="mx-auto max-w-6xl px-5">
        <SectionHeader
          title="Recent lots"
          action={<span className="text-sm text-subtle">{lots.data?.length ?? 0} total</span>}
        />
        <DataTable
          isLoading={lots.isLoading}
          isError={lots.isError}
          rows={recentLots}
          rowKey={(r) => r.lotId}
          emptyMessage="No lots registered yet."
          columns={[
            { key: "lotId", header: "Lot #", render: (l) => <Pill tone="timber">#{l.lotId}</Pill> },
            { key: "species", header: "Species", render: (l) => l.species || "—" },
            { key: "grade", header: "Grade", render: (l) => l.grade || "—" },
            { key: "originCoupeId", header: "Coupe ID", render: (l) => l.originCoupeId || "—" },
            { key: "initialQty", header: "Initial (cft)", render: (l) => l.initialQty ?? "—" },
            {
              key: "remainingQty",
              header: "Remaining (cft)",
              render: (l) => <strong>{l.remainingQty ?? "—"}</strong>,
            },
            {
              key: "auctionHouse",
              header: "Auction House",
              className: "font-mono text-xs",
              render: (l) => <span title={l.auctionHouse}>{shortenAddr(l.auctionHouse)}</span>,
            },
            {
              key: "txHash",
              header: "Tx",
              className: "font-mono text-xs",
              render: (l) =>
                l.txHash ? (
                  <a href={etherscanTx(l.txHash)} target="_blank" rel="noreferrer" className="text-ocean hover:underline">
                    {l.txHash.slice(0, 10)}…
                  </a>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-6xl px-5">
        <SectionHeader
          title="Active role assignments"
          action={<Link to="/admin" className="text-sm font-medium text-ocean hover:underline">Manage →</Link>}
        />
        <DataTable
          isLoading={roles.isLoading}
          isError={roles.isError}
          rows={roles.data || []}
          rowKey={(r) => r.id}
          emptyMessage="No roles assigned yet."
          columns={[
            {
              key: "wallet",
              header: "Wallet",
              className: "font-mono text-xs",
              render: (r) => <span title={r.wallet}>{shortenAddr(r.wallet)}</span>,
            },
            { key: "roleName", header: "Role", render: (r) => <Pill tone={roleTone(r.roleName)}>{r.roleName}</Pill> },
            {
              key: "grantedBy",
              header: "Granted By",
              className: "font-mono text-xs",
              render: (r) => <span title={r.grantedBy}>{shortenAddr(r.grantedBy)}</span>,
            },
            {
              key: "active",
              header: "Status",
              render: (r) => <Pill tone={r.active ? "timber" : "danger"}>{r.active ? "Active" : "Revoked"}</Pill>,
            },
            {
              key: "txHash",
              header: "Tx",
              className: "font-mono text-xs",
              render: (r) =>
                r.txHash ? (
                  <a href={etherscanTx(r.txHash)} target="_blank" rel="noreferrer" className="text-ocean hover:underline">
                    {r.txHash.slice(0, 10)}…
                  </a>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </section>
    </>
  );
}
