import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // `client/` entrou em 24/10: a captura de atribuição do pixel é lógica
    // pura (cookie, querystring, sessionStorage) e dava para testar sem DOM
    // de verdade, mas o include só olhava `server/`, então o arquivo era
    // ignorado em silêncio. Teste que não roda não protege nada.
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "client/src/**/*.test.ts",
      "client/src/**/*.spec.ts",
    ],
  },
});
