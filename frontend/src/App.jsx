import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Auction from "./pages/Auction.jsx";
import Factory from "./pages/Factory.jsx";
import Admin from "./pages/Admin.jsx";
import Verify from "./pages/Verify.jsx";
import Explorer from "./pages/Explorer.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/auction" element={<Auction />} />
        <Route path="/factory" element={<Factory />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/explorer" element={<Explorer />} />
        <Route path="/verify" element={<Verify />} />
        {/* Alias so QR codes pointing at /verify.html?id= keep working */}
        <Route path="/verify.html" element={<Verify />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
