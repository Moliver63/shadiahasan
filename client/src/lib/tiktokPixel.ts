/**
 * tiktokPixel.ts — TikTok Pixel no navegador.
 *
 * O navegador cuida só do que acontece na tela: PageView, ViewContent e
 * InitiateCheckout. O `Purchase` NÃO sai daqui: ele vem do servidor (Events API,
 * server/tiktokEvents.ts) quando o Asaas confirma o pagamento. Assim a mesma
 * compra nunca chega ao TikTok por duas fontes, e quem paga por Pix ou boleto
 * sem voltar ao site também é contado.
 *
 * Só carrega com consentimento de cookies de análise (LGPD) e só existe se
 * VITE_TIKTOK_PIXEL_ID estiver definido no build: medir com ID inventado é
 * pior que não medir.
 */

declare global {
  interface Window {
    ttq?: any;
    TiktokAnalyticsObject?: string;
    __tiktokPixelBooted?: boolean;
  }
}

export const TIKTOK_PIXEL_ID = (import.meta.env.VITE_TIKTOK_PIXEL_ID as string | undefined) || "";

/** Código oficial do snippet do Pixel, em função, sem a chamada `ttq.page()` (quem chama decide). */
export function iniciarTikTokPixel(id: string): void {
  if (typeof window === "undefined" || !id) return;
  // O snippet do <head> (index.html) já pode ter iniciado o Pixel: iniciar de novo contaria a visita duas vezes.
  if (window.__tiktokPixelBooted || window.ttq?.__shadiaLoaded) return;
  const w: any = window;
  const t = "ttq";
  w.TiktokAnalyticsObject = t;
  const ttq: any = (w[t] = w[t] || []);
  if (ttq.__shadiaLoaded) return;
  ttq.methods = [
    "page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group",
    "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent",
  ];
  ttq.setAndDefer = (o: any, m: string) => {
    o[m] = (...args: unknown[]) => { o.push([m].concat(args as any)); };
  };
  for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
  ttq.instance = (n: string) => {
    const inst = (ttq._i && ttq._i[n]) || [];
    for (const m of ttq.methods) ttq.setAndDefer(inst, m);
    return inst;
  };
  ttq.load = (e: string, opts?: any) => {
    const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {};
    ttq._i[e] = [];
    ttq._i[e]._u = url;
    ttq._t = ttq._t || {};
    ttq._t[e] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[e] = opts || {};
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.src = `${url}?sdkid=${encodeURIComponent(e)}&lib=${t}`;
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(s, first);
  };
  ttq.__shadiaLoaded = true;
  ttq.load(id);
  ttq.page();
  w.__tiktokPixelBooted = true;
}

/** Evento padrão do TikTok com `event_id` (deduplicação com a Events API). */
export function tiktokTrack(evento: "ViewContent" | "InitiateCheckout", params: Record<string, unknown>, eventId?: string): void {
  if (typeof window === "undefined" || !window.ttq) return;
  window.ttq.track(evento, params, eventId ? { event_id: eventId } : undefined);
}

export function tiktokPageView(): void {
  if (typeof window !== "undefined") window.ttq?.page?.();
}
