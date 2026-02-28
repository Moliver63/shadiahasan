import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // FIX: usar "/*" em vez de "*" para garantir compatibilidade com Express 5
  // e evitar que requests de assets JS caiam aqui antes do Vite interceptar.
  // O handler só deve ser alcançado para rotas de página (navegação SPA).
  app.use("/*", async (req, res, next) => {
    const url = req.originalUrl;

    // FIX: não interceptar requests de assets — deixar o Vite ou o next() tratar
    if (
      url.startsWith("/api/") ||
      url.startsWith("/@") ||
      url.startsWith("/node_modules/") ||
      url.includes(".")  // arquivos com extensão (js, ts, css, png, etc.)
    ) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // FIX: removida a condição errada que apontava para "dist/public" em dev.
  // Em produção, o path correto é sempre relativo ao build output.
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.error(
      `[serveStatic] Diretório de build não encontrado: ${distPath}\n` +
      `Execute "npm run build" antes de iniciar em produção.`
    );
  }

  app.use(express.static(distPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
