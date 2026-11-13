import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/search":   { target: "http://localhost:8000", changeOrigin: true },
      "/cutout":   { target: "http://localhost:8000", changeOrigin: true },
      "/spectrum": { target: "http://localhost:8000", changeOrigin: true },
      "/quality":  { target: "http://localhost:8000", changeOrigin: true },
      "/compare":  { target: "http://localhost:8000", changeOrigin: true },
      "/tiles":    { target: "http://localhost:8000", changeOrigin: true },
      "/cube":     { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three") || id.includes("node_modules/@react-three")) {
            return "three";
          }
          if (id.includes("node_modules/@tanstack")) {
            return "query";
          }
        },
      },
    },
  },
});

