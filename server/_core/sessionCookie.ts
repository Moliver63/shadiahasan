/**
 * Cookie de sessão ASSINADO (login por e-mail/senha, Google e convite de admin).
 *
 * Falha corrigida em 24/10/2026: o cookie de sessão era um JSON puro
 * (`{"id":2,"email":"...","role":"admin"}`), sem assinatura. O servidor
 * aceitava qualquer cookie cujo id e e-mail batessem com um usuário do banco.
 * Quem soubesse o id e o e-mail de um administrador entrava como ele, sem
 * senha. Agora o cookie é um JWT HS256; sem a chave do servidor, não dá para
 * forjar. Cookies antigos (JSON) deixam de valer: todos fazem login de novo
 * uma vez.
 *
 * Chave: SESSION_SIGNING_SECRET (nova, criada para esta correção, porque a
 * JWT_SECRET antiga apareceu em arquivo do repositório público). Sem ela, cai
 * na JWT_SECRET. Chave curta (< 32 caracteres) é recusada: melhor ninguém
 * entrar do que entrar com sessão forjável.
 */
import { SignJWT, jwtVerify } from "jose";

const EMISSOR = "shadiahasan-session";
const VERSAO = 1;
const UM_ANO_S = 365 * 24 * 60 * 60;

export function chaveDeSessao(env: NodeJS.ProcessEnv = process.env): Uint8Array | null {
  const segredo = (env.SESSION_SIGNING_SECRET || env.JWT_SECRET || "").trim();
  if (segredo.length < 32) return null;
  return new TextEncoder().encode(segredo);
}

export type SessaoDoCookie = { userId: number; email: string };

export async function assinarSessao(
  usuario: { id: number; email: string },
  opts: { chave?: Uint8Array | null; agoraS?: number; validadeS?: number } = {},
): Promise<string> {
  const chave = opts.chave === undefined ? chaveDeSessao() : opts.chave;
  if (!chave) throw new Error("SESSION_SIGNING_SECRET ausente ou curta: login desativado por segurança.");
  const agora = opts.agoraS ?? Math.floor(Date.now() / 1000);
  return new SignJWT({ uid: usuario.id, email: usuario.email.toLowerCase(), v: VERSAO })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(EMISSOR)
    .setIssuedAt(agora)
    .setExpirationTime(agora + (opts.validadeS ?? UM_ANO_S))
    .sign(chave);
}

/** Devolve a sessão só se a assinatura e a validade conferem. Nunca lança. */
export async function lerSessao(
  valor: string | undefined | null,
  opts: { chave?: Uint8Array | null; agoraS?: number } = {},
): Promise<SessaoDoCookie | null> {
  if (!valor) return null;
  const chave = opts.chave === undefined ? chaveDeSessao() : opts.chave;
  if (!chave) return null;
  try {
    const { payload } = await jwtVerify(valor, chave, {
      algorithms: ["HS256"],
      issuer: EMISSOR,
      ...(opts.agoraS !== undefined ? { currentDate: new Date(opts.agoraS * 1000) } : {}),
    });
    const uid = Number(payload.uid);
    const email = typeof payload.email === "string" ? payload.email : "";
    if (payload.v !== VERSAO || !Number.isSafeInteger(uid) || uid <= 0 || !email) return null;
    return { userId: uid, email };
  } catch {
    return null;
  }
}
