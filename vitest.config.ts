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
    exclude: ["node_modules", "dist", ".next", "e2e/**", ".worktrees/**"],
    coverage: {
      provider: "v8",
      // Perimetre v4-02 : lib (unitaire) + routes API (integration).
      include: ["src/lib/**", "src/app/api/**"],
      exclude: [
        "src/lib/**/__tests__/**",
        // prisma.ts : singleton client Prisma trivial (instanciation), rien a tester.
        "src/lib/prisma.ts",
        // Assets binaires et fichiers type-only : aucune logique executable.
        "src/lib/**/*.png",
        "src/lib/badge-templates/**/types.ts",
        // Wrapper NextAuth trivial : delegue tout a NextAuth(authOptions). La logique
        // metier (authorize, callbacks) vit dans src/lib/auth.ts (couvert 100%) et le
        // flux login est couvert en E2E. Rien de testable en unitaire ici.
        "src/app/api/auth/\\[...nextauth\\]/route.ts",
      ],
      reporter: ["text-summary", "text", "json-summary", "json"],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
