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
    // Reset global de la BDD avant chaque test (ordre FK strict).
    setupFiles: ["./src/test-setup.ts"],
    // E2E Playwright vivent dans e2e/ et ne doivent pas etre executes par Vitest.
    exclude: ["node_modules", "dist", ".next", "e2e/**"],
  },
});
