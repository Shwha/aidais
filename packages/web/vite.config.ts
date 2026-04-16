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
        target: "ws://localhost:3001",
        ws: true,
      },
      "/health": {
        target: "http://localhost:3001",
      },
    },
  },
});
