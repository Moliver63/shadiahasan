/**
 * Domínio canônico: o site é shadiahasan.com; shadiahasan-2ngl.onrender.com é
 * só o endereço técnico do Render.
 *
 * Achado real (24/10/2026, logs do Render): o login com Google começa em
 * shadiahasan.com, mas o Google devolve em shadiahasan-2ngl.onrender.com
 * (GOOGLE_CALLBACK_URL aponta para lá). O cookie de sessão ficava no domínio
 * do Render, então:
 *  - o aluno "logava" e ficava num site com outro endereço, e em
 *    shadiahasan.com continuava deslogado;
 *  - a compra começada antes do login (guardada no navegador por domínio) não
 *    era encontrada do outro lado;
 *  - no domínio do Render, o service worker antigo servia uma versão velha do
 *    site, sem a faixa da promoção ("sumiu o banner").
 *
 * Correção, sem depender de mudar nada no Google Cloud:
 *  1. o callback do Google, ainda no domínio do Render, não cria sessão lá:
 *     emite um passe de 2 minutos e manda para shadiahasan.com/api/auth/handoff,
 *     que cria a sessão no domínio certo;
 *  2. qualquer página pedida no domínio do Render é redirecionada (301) para
 *     o mesmo caminho em shadiahasan.com (API continua respondendo nos dois);
 *  3. no domínio do Render, /sw.js vira um service worker que se desinstala,
 *     para quem ficou preso na versão velha sair dela.
 */
import { SignJWT, jwtVerify } from "jose";
import type { NextFunction, Request, Response } from "express";
import { chaveDeSessao } from "./sessionCookie";

export function hostCanonico(env: NodeJS.ProcessEnv = process.env): string | null {
  const h = (env.CANONICAL_HOST ?? "shadiahasan.com").trim().toLowerCase();
  return h || null;
}

/** Host técnico do Render (ou outro que não seja o canônico) que deve ser redirecionado. */
export function ehHostTecnico(host: string | undefined, canonico: string | null): boolean {
  if (!host || !canonico) return false;
  const h = host.toLowerCase().split(":")[0];
  return h !== canonico && h !== `www.${canonico}` && h.endsWith(".onrender.com");
}

/** Service worker que se desinstala e recarrega as abas (só no domínio técnico). */
export const SW_DESINSTALADOR = `self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",(e)=>{e.waitUntil((async()=>{
  try{const ks=await caches.keys();await Promise.all(ks.map((k)=>caches.delete(k)));}catch(_){}
  await self.registration.unregister();
  const cs=await self.clients.matchAll({type:"window"});
  cs.forEach((c)=>{try{c.navigate(c.url)}catch(_){}});
})())});`;

export function middlewareDominioCanonico(env: NodeJS.ProcessEnv = process.env) {
  const canonico = hostCanonico(env);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!ehHostTecnico(req.headers.host, canonico)) return next();
    if (req.path === "/sw.js") {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.send(SW_DESINSTALADOR);
    }
    // API, webhooks e o callback do Google continuam no domínio técnico.
    if (req.path.startsWith("/api/") || (req.method !== "GET" && req.method !== "HEAD")) return next();
    return res.redirect(301, `https://${canonico}${req.originalUrl}`);
  };
}

// ── Passe de login entre domínios ───────────────────────────────────────────

const PROPOSITO = "handoff-login";

export async function emitirPasseDeLogin(userId: number, destino: string, opts: { chave?: Uint8Array | null; agoraS?: number } = {}): Promise<string> {
  const chave = opts.chave === undefined ? chaveDeSessao() : opts.chave;
  if (!chave) throw new Error("chave de sessão ausente");
  const agora = opts.agoraS ?? Math.floor(Date.now() / 1000);
  return new SignJWT({ uid: userId, p: PROPOSITO, d: destinoSeguro(destino) })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(agora)
    .setExpirationTime(agora + 120)
    .sign(chave);
}

export async function lerPasseDeLogin(token: string | undefined, opts: { chave?: Uint8Array | null; agoraS?: number } = {}): Promise<{ userId: number; destino: string } | null> {
  if (!token) return null;
  const chave = opts.chave === undefined ? chaveDeSessao() : opts.chave;
  if (!chave) return null;
  try {
    const { payload } = await jwtVerify(token, chave, {
      algorithms: ["HS256"],
      ...(opts.agoraS !== undefined ? { currentDate: new Date(opts.agoraS * 1000) } : {}),
    });
    const uid = Number(payload.uid);
    if (payload.p !== PROPOSITO || !Number.isSafeInteger(uid) || uid <= 0) return null;
    return { userId: uid, destino: destinoSeguro(String(payload.d || "/")) };
  } catch {
    return null;
  }
}

/** Só caminho interno: nada de redirecionar para outro site. */
export function destinoSeguro(d: string): string {
  return typeof d === "string" && d.startsWith("/") && !d.startsWith("//") && !d.includes("\\") ? d : "/";
}
