/**
 * index.ts — Entry point do servidor Express
 * Localização: server/_core/index.ts
 */

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import passport from '../auth/passport.js';
import cookieParser from 'cookie-parser';
import oauthRoutes from '../auth/routes.js';
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { apiLimiter } from "./rateLimit";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
    console.log('[Express] Trust proxy enabled for production');
  }

  // Stripe webhook: precisa do corpo CRU para validar a assinatura, então
  // tem que ser montado ANTES do express.json() (a rota aplica express.raw sozinha).
  // Domínio técnico do Render → shadiahasan.com (páginas), e desinstala o
  // service worker velho que servia versão antiga lá. Ver canonicalHost.ts.
  const { middlewareDominioCanonico } = await import('./canonicalHost');
  app.use(middlewareDominioCanonico());

  const stripeWebhook = await import('../routes/stripe-webhook');
  app.use('/api', stripeWebhook.default);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());
  app.use(passport.initialize());

  // Rotas OAuth legadas (/api/oauth/callback)
  registerOAuthRoutes(app);

  // Rotas Google/Apple OAuth (/api/auth/google, /api/auth/apple)
  app.use('/api/auth', oauthRoutes);

  // Asaas webhook (PIX/boleto/cartão)
  const asaasWebhook = await import('../routes/asaas-webhook');
  app.use('/api', asaasWebhook.default);

  // tRPC API com rate limiting
  app.use(
    "/api/trpc",
    apiLimiter,
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Porta ${preferredPort} ocupada, usando porta ${port}`);
  }

  server.listen(port, () => {
    console.log(`\nServidor rodando em http://localhost:${port}/`);
    console.log(`Google OAuth: http://localhost:${port}/api/auth/google`);
    console.log(`Auth status:  http://localhost:${port}/api/auth/me\n`);

    // Reprocessa eventos do Asaas que ficaram pendentes (não bloqueia a subida)
    setTimeout(() => {
      import('../asaas').then((m) => m.recoverAsaasEvents()).catch(() => undefined);
    }, 20_000);

    // Rotina de cobrança: carência no atraso, fim do período cancelado e lembretes de pagamento
    setTimeout(() => {
      const run = () => { import('../asaas').then((m) => m.runBillingMaintenance()).catch(() => undefined); };
      run();
      setInterval(run, 10 * 60_000).unref();
    }, 60_000);
  });
}

startServer().catch((err) => {
  console.error("[FATAL] startServer failed:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] unhandledRejection at:", promise, "reason:", reason);
  process.exit(1);
});
