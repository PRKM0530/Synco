import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:5000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  // PERFORMANCE: Split vendor & heavy libraries into separate cached chunks.
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — rarely changes, cached long-term by browser
          vendor: ["react", "react-dom", "react-router-dom"],
          // Heavy mapping libraries — only loaded when map page is visited
          maps: [
            "@react-google-maps/api",
            "leaflet",
            "react-leaflet",
          ],
        },
      },
    },
    // Raise the warning limit slightly for the maps chunk
    chunkSizeWarningLimit: 600,
  },
});
