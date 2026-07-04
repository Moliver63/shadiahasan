import { useEffect } from "react";

/**
 * Analytics — GA4 + Meta Pixel + Microsoft Clarity
 *
 * Só carrega os scripts cujos IDs estiverem definidos nas variáveis de
 * ambiente do Vite (configurar no Render → Environment):
 *   VITE_GA4_ID         ex: G-XXXXXXXXXX
 *   VITE_META_PIXEL_ID  ex: 1234567890
 *   VITE_CLARITY_ID     ex: abcdefghij
 *
 * Sem os IDs definidos, o componente não injeta nada — zero overhead.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

const GA4_ID = import.meta.env.VITE_GA4_ID as string | undefined;
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID as string | undefined;

function loadGA4(id: string) {
  if (document.getElementById("ga4-script")) return;
  const s = document.createElement("script");
  s.id = "ga4-script";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", id);
}

function loadMetaPixel(id: string) {
  if (window.fbq) return;
  const fbq: any = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue.push(args);
    }
  };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);

  window.fbq("init", id);
  window.fbq("track", "PageView");
}

function loadClarity(id: string) {
  if (window.clarity) return;
  (function (c: any, l: Document, a: string, r: string, i: string) {
    c[a] =
      c[a] ||
      function (...args: unknown[]) {
        (c[a].q = c[a].q || []).push(args);
      };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = "https://www.clarity.ms/tag/" + i;
    const y = l.getElementsByTagName(r)[0];
    y.parentNode?.insertBefore(t, y);
  })(window, document, "clarity", "script", id);
}

export default function Analytics() {
  useEffect(() => {
    if (GA4_ID) loadGA4(GA4_ID);
    if (META_PIXEL_ID) loadMetaPixel(META_PIXEL_ID);
    if (CLARITY_ID) loadClarity(CLARITY_ID);
  }, []);

  return null;
}

/** Dispara evento de conversão em GA4 + Meta Pixel simultaneamente */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  window.gtag?.("event", name, params);
  window.fbq?.("trackCustom", name, params);
}

/** Eventos padrão de e-commerce */
export function trackCheckoutStart(planSlug: string, value: number) {
  window.gtag?.("event", "begin_checkout", {
    currency: "BRL",
    value,
    items: [{ item_id: planSlug }],
  });
  window.fbq?.("track", "InitiateCheckout", { currency: "BRL", value });
}

export function trackLead(source: string) {
  window.gtag?.("event", "generate_lead", { source });
  window.fbq?.("track", "Lead", { source });
}
