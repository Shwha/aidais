import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    port: 5173,
    https: true,
    proxy: {
      "/ws": {
        target: "http://localhost:3002",
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      "/health": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
});
