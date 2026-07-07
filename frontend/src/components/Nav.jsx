import { NavLink } from "react-router-dom";
import ConnectButton from "./ConnectButton.jsx";

const LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/auction", label: "Auction House" },
  { to: "/factory", label: "Factory" },
  { to: "/verify", label: "Verify" },
  { to: "/explorer", label: "Explorer" },
  { to: "/admin", label: "Admin" },
];

export default function Nav() {
  return (
    <header className="glass sticky top-0 z-50 border-b border-hairline/70">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <NavLink to="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
          <span>🌲</span>
          <span>TimberTrace</span>
        </NavLink>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-ink/5 text-ink" : "text-subtle hover:text-ink"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <ConnectButton />
      </nav>
    </header>
  );
}
