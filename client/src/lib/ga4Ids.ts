/**
 * Identificadores do GA4 lidos dos cookies, para o servidor mandar a compra
 * ao GA4 quando o Asaas confirmar o pagamento (ver server/ga4.ts).
 *
 * Só com consentimento: os cookies `_ga` só existem se a pessoa aceitou
 * cookies de análise, e ainda assim conferimos a escolha salva (quem aceitou e
 * depois recusou pode ter o cookie antigo no navegador).
 */
import { safeLocalStorageGet } from "@/lib/safeStorage";

export const GA4_MEASUREMENT_ID = (import.meta.env.VITE_GA4_ID as string | undefined) || "G-DGCPN51SD6";

function cookie(cookies: string, nome: string): string | undefined {
  for (const parte of cookies.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nome) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** "_ga=GA1.1.123456789.1730000000" → "123456789.1730000000" */
export function clientIdDoCookie(valor: string | undefined): string | undefined {
  const m = /^GA\d\.\d+\.(\d{1,20}\.\d{1,20})$/.exec(valor || "");
  return m?.[1];
}

/**
 * "_ga_XXXX" guarda a sessão: formato antigo "GS1.1.1730000000.3.1..." e o
 * novo "GS2.1.s1730000000$o3$g1$t...". Devolve o número da sessão.
 */
export function sessionIdDoCookie(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const novo = /^GS2\.\d+\.s(\d{6,20})/.exec(valor);
  if (novo) return novo[1];
  const antigo = /^GS1\.\d+\.(\d{6,20})\./.exec(valor);
  return antigo?.[1];
}

function consentiuAnalise(): boolean {
  try {
    return JSON.parse(safeLocalStorageGet("cookie-consent") || "null")?.analytics === true;
  } catch {
    return false;
  }
}

export function idsGA4Atuais(
  cookies: string = typeof document !== "undefined" ? document.cookie : "",
  consentiu: () => boolean = consentiuAnalise,
): { ga4ClientId?: string; ga4SessionId?: string } {
  if (!consentiu()) return {};
  const clientId = clientIdDoCookie(cookie(cookies, "_ga"));
  if (!clientId) return {};
  const sessionId = sessionIdDoCookie(cookie(cookies, `_ga_${GA4_MEASUREMENT_ID.replace(/^G-/, "")}`));
  return { ga4ClientId: clientId, ...(sessionId ? { ga4SessionId: sessionId } : {}) };
}
