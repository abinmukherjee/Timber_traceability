import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Nav from "./Nav.jsx";
import Footer from "./Footer.jsx";
import { useWallet } from "../hooks/useWallet.js";
import { rememberRoute, getRememberedRoute, routeLabel } from "../lib/lastRoute.js";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { address } = useWallet();
  const [suggestion, setSuggestion] = useState(null);
  const prevAddress = useRef(null);

  // Persist the current route for the connected wallet.
  useEffect(() => {
    if (address) rememberRoute(address, location.pathname);
  }, [address, location.pathname]);

  // When the wallet *changes* to a different account, suggest its last route.
  useEffect(() => {
    if (!address) {
      prevAddress.current = null;
      return;
    }
    if (prevAddress.current && prevAddress.current !== address) {
      const last = getRememberedRoute(address);
      if (last && last !== location.pathname) {
        setSuggestion(last);
      }
    }
    prevAddress.current = address;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      {suggestion && (
        <div className="glass border-b border-hairline">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2.5 text-sm">
            <span className="text-subtle">
              This wallet last used the{" "}
              <strong className="font-medium text-ink">{routeLabel(suggestion)}</strong> page.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigate(suggestion);
                  setSuggestion(null);
                }}
                className="rounded-full bg-ocean px-3.5 py-1 text-xs font-medium text-white hover:bg-[#0077ed]"
              >
                Go →
              </button>
              <button
                onClick={() => setSuggestion(null)}
                className="rounded-full px-2 py-1 text-xs text-subtle hover:text-ink"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      <div className="mx-auto w-full max-w-6xl px-5">
        <Footer />
      </div>
    </div>
  );
}
