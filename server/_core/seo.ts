/**
 * SEO do servidor: sitemap.xml e robots.txt gerados na hora.
 *
 * Achado (31/10/2026): os dois arquivos eram estáticos, escritos para
 * shadiahasan.club (domínio antigo), e o sitemap tinha só 7 páginas fixas, sem os
 * cursos nem os programas. O Google recebia um mapa apontando para outro domínio.
 *
 * Agora o endereço vem do domínio canônico (CANONICAL_HOST, padrão shadiahasan.com),
 * o mesmo usado no redirecionamento do domínio técnico do Render, e a lista de
 * páginas inclui cursos publicados e programas ativos. Se o banco falhar, o sitemap
 * ainda sai com as páginas fixas.
 */
import type { Request, Response, Router } from "express";
import express from "express";
import { sql } from "drizzle-orm";
import { hostCanonico } from "./canonicalHost";

export type ItemSitemap = { path: string; lastmod?: Date | string | null; changefreq?: string; priority?: number };

/** https://shadiahasan.com (sem barra no fim). */
export function urlCanonica(env: NodeJS.ProcessEnv = process.env): string {
  return `https://${hostCanonico(env) ?? "shadiahasan.com"}`;
}

/** Páginas públicas fixas. Telas de login/cadastro ficam de fora: não têm valor de busca. */
export const PAGINAS_FIXAS: ItemSitemap[] = [
  { path: "/", changefreq: "weekly", priority: 1.0 },
  { path: "/courses", changefreq: "weekly", priority: 0.9 },
  { path: "/pricing", changefreq: "monthly", priority: 0.9 },
  { path: "/autoavaliacao", changefreq: "monthly", priority: 0.7 },
  { path: "/about", changefreq: "monthly", priority: 0.8 },
  { path: "/faq", changefreq: "monthly", priority: 0.6 },
  { path: "/contact", changefreq: "yearly", priority: 0.5 },
  { path: "/privacy", changefreq: "yearly", priority: 0.2 },
  { path: "/terms", changefreq: "yearly", priority: 0.2 },
];

export function escaparXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function dataIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString().slice(0, 10);
}

export function montarSitemap(base: string, itens: ItemSitemap[]): string {
  const vistos = new Set<string>();
  const linhas: string[] = [];
  for (const it of itens) {
    const loc = `${base}${it.path === "/" ? "/" : it.path}`;
    if (vistos.has(loc)) continue;
    vistos.add(loc);
    const lastmod = dataIso(it.lastmod);
    linhas.push(
      "  <url>\n" +
        `    <loc>${escaparXml(loc)}</loc>\n` +
        (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : "") +
        (it.changefreq ? `    <changefreq>${it.changefreq}</changefreq>\n` : "") +
        (it.priority != null ? `    <priority>${it.priority.toFixed(1)}</priority>\n` : "") +
        "  </url>",
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${linhas.join("\n")}\n</urlset>\n`;
}

/** Áreas que não devem aparecer no Google (logado, admin, API e rotas de pagamento). */
export const CAMINHOS_BLOQUEADOS = [
  "/admin",
  "/dashboard",
  "/minha-area",
  "/my-courses",
  "/my-subscription",
  "/edit-profile",
  "/messages",
  "/profile",
  "/certificates",
  "/community",
  "/lesson/",
  "/ebook/",
  "/checkout/",
  "/compra/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/",
];

export function montarRobots(base: string): string {
  return (
    "User-agent: *\n" +
    "Allow: /\n" +
    CAMINHOS_BLOQUEADOS.map((c) => `Disallow: ${c}`).join("\n") +
    `\n\nSitemap: ${base}/sitemap.xml\n`
  );
}

const linhasDe = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

/** Cursos publicados e programas ativos. Qualquer falha devolve só o que conseguiu ler. */
export async function paginasDinamicas(): Promise<ItemSitemap[]> {
  const itens: ItemSitemap[] = [];
  try {
    const db = await (await import("../db")).getDb();
    if (!db) return itens;
    try {
      const cursos = linhasDe(await db.execute(sql`SELECT "slug", "updatedAt" FROM "courses" WHERE "isPublished" = 1 ORDER BY "order", "id"`));
      for (const c of cursos) {
        if (c.slug) itens.push({ path: `/courses/${encodeURIComponent(String(c.slug))}`, lastmod: c.updatedAt, changefreq: "weekly", priority: 0.8 });
      }
    } catch (e) {
      console.warn("[SEO] cursos fora do sitemap:", e instanceof Error ? e.message : e);
    }
    try {
      const programas = linhasDe(await db.execute(sql`SELECT "id", "updatedAt" FROM "contentCollections" WHERE "isActive" = 1 ORDER BY "order", "id"`));
      for (const p of programas) {
        itens.push({ path: `/collections/${Number(p.id)}`, lastmod: p.updatedAt, changefreq: "weekly", priority: 0.7 });
      }
    } catch {
      // tabela de programas ainda não criada: tudo bem
    }
  } catch (e) {
    console.warn("[SEO] banco indisponível para o sitemap:", e instanceof Error ? e.message : e);
  }
  return itens;
}

/** Guarda o resultado por 10 min: o rastreador pode pedir o sitemap várias vezes seguidas. */
let cache: { em: number; xml: string; base: string } | null = null;
const VALIDADE_MS = 10 * 60 * 1000;

export function limparCacheSitemap() {
  cache = null;
}

export function rotasSeo(): Router {
  const r = express.Router();

  r.get("/robots.txt", (_req: Request, res: Response) => {
    res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(montarRobots(urlCanonica()));
  });

  r.get("/sitemap.xml", async (_req: Request, res: Response) => {
    const base = urlCanonica();
    if (!cache || cache.base !== base || Date.now() - cache.em > VALIDADE_MS) {
      const xml = montarSitemap(base, [...PAGINAS_FIXAS, ...(await paginasDinamicas())]);
      cache = { em: Date.now(), xml, base };
    }
    res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(cache.xml);
  });

  return r;
}
