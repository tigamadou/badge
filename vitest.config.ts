import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // Tests partagent une base MySQL unique avec deleteMany() en beforeEach.
    // L'exécution séquentielle évite les collisions inter-fichiers.
    fileParallelism: false,
  },
});
