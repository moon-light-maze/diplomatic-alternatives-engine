import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite serves the UI on 5173 and proxies /api to the Express server on 8787.
// Prod: `npm run build` emits to web/dist, which the server static-serves.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
