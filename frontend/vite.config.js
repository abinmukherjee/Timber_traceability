import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server defaults to 5500 (matches app.base.url used in QR generation) but
// respects a PORT env var so tooling can assign a free port.
const port = process.env.PORT ? Number(process.env.PORT) : 5500;

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    strictPort: false,
  },
  preview: {
    port,
  },
});
