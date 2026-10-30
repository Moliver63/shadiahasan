/**
 * linkDeAcesso.ts — entrar pelo link que chega no e-mail.
 *
 * Por quê: quem já tem conta criada pelo Google e compra a aula de R$ 19,90
 * sem estar logado (navegador do app do Facebook/Instagram) não entra sozinho
 * depois de pagar, por segurança. E no navegador do Facebook o próprio Google
 * bloqueia o login (403 disallowed_useragent). A pessoa pagava e ficava sem
 * conseguir abrir a aula.
 *
 * O link resolve sem abrir brecha: só quem recebe o e-mail tem o link, então
 * usá-lo prova que a caixa de entrada é da pessoa, igual a "esqueci a senha".
 *  - token aleatório de 32 bytes, guardado só como hash
 *  - vale uma vez e expira (padrão 7 dias)
 *  - destino só dentro do site (nada de redirecionar para fora)
 */
import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import * as db from "./db";
import { users } from "../drizzle/schema";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const DESTINO_PADRAO = "/minha-area";

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Só caminhos internos: "/lesson/12" sim; "https://x", "//x", "/\\x" não. */
export function destinoSeguro(destino: string | null | undefined): string {
  const d = String(destino || "");
  if (!d.startsWith("/") || d.startsWith("//") || d.startsWith("/\\") || /[\r\n]/.test(d) || d.length > 300) return DESTINO_PADRAO;
  return d;
}

let schemaPronto: Promise<boolean> | null = null;
export function ensureLinksSchema(): Promise<boolean> {
  if (!schemaPronto) {
    schemaPronto = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "linksDeAcesso" (
            "id" serial PRIMARY KEY,
            "tokenHash" varchar(64) NOT NULL UNIQUE,
            "userId" integer NOT NULL,
            "destino" varchar(300) NOT NULL,
            "expiresAt" timestamp NOT NULL,
            "usedAt" timestamp,
            "createdAt" timestamp NOT NULL DEFAULT now()
          )
        `);
        await d.execute(sql`CREATE INDEX IF NOT EXISTS "linksDeAcesso_user_idx" ON "linksDeAcesso" ("userId")`);
        return true;
      } catch (e) {
        console.error("[LinkDeAcesso] schema:", e instanceof Error ? e.message : e);
        schemaPronto = null;
        return false;
      }
    })();
  }
  return schemaPronto;
}

export async function criarLinkDeAcesso(userId: number, destino: string, validadeMs = SETE_DIAS_MS): Promise<{ token: string }> {
  if (!(await ensureLinksSchema())) throw new Error("links de acesso indisponíveis");
  const d = await db.getDb();
  if (!d) throw new Error("db indisponível");
  const token = randomBytes(32).toString("base64url");
  await d.execute(sql`
    INSERT INTO "linksDeAcesso" ("tokenHash", "userId", "destino", "expiresAt")
    VALUES (${hash(token)}, ${userId}, ${destinoSeguro(destino)}, ${new Date(Date.now() + validadeMs)})
  `);
  return { token };
}

/**
 * Consome o link (uso único, atômico) e devolve a conta e o destino.
 * Marca o e-mail como confirmado: chegar pelo link prova que a caixa é dela.
 */
export async function usarLinkDeAcesso(token: string): Promise<{ userId: number; email: string; destino: string } | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  if (!(await ensureLinksSchema())) return null;
  const d = await db.getDb();
  if (!d) return null;
  const r = await d.execute(sql`
    UPDATE "linksDeAcesso" SET "usedAt" = now()
    WHERE "tokenHash" = ${hash(token)} AND "usedAt" IS NULL AND "expiresAt" > now()
    RETURNING "userId", "destino"
  `);
  const linha = (r.rows as Array<{ userId: number; destino: string }>)[0];
  if (!linha) return null;
  const [user] = await d.select({ id: users.id, email: users.email, status: users.status }).from(users).where(eq(users.id, linha.userId)).limit(1);
  if (!user?.email || user.status === "suspended") return null;
  await d.update(users).set({ emailVerified: 1, lastSignedIn: new Date() }).where(eq(users.id, user.id));
  return { userId: user.id, email: user.email, destino: destinoSeguro(linha.destino) };
}

