import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { cascadeRuntime } from "cascade-runtime/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    react(),
    cascadeRuntime({ browser: mode === "browser", app: true }),
  ],
  // With the chat add-on, its window is already its own lazy chunk (583 kB: mostly assistant-ui and zod, the AI SDK is about 140 kB of it).
  build: { chunkSizeWarningLimit: 650 },
}));
