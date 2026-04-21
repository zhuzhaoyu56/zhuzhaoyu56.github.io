import { defineConfig } from "vite";

const allowedHosts = [
  ".loca.lt",
  ".localtunnel.me",
  ".trycloudflare.com",
  ".ngrok-free.app",
  "localhost",
  "127.0.0.1",
];

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    allowedHosts,
  },
});
