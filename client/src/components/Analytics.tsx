import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { capturarAtribuicaoNaEntrada, novoEventId } from "@/lib/metaAttribution";
import { safeLocalStorageGet } from "@/lib/safeStorage";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Analytics — GA4 + Meta Pixel + Microsoft Clarity
 *
 * O GA4 usa VITE_GA4_ID (padrão G-DGCPN51SD6) e só carrega após consentimento.
 * Os demais scripts são opcionais e usam variáveis do Vite:
 *   VITE_META_PIXEL_ID  ex: 1234567890
 *   VITE_CLARITY_ID     ex: abcdefghij (padrão z3xy56e2y4)
 *
 * Sem IDs para Meta/Clarity, esses scripts não são injetados.
 *
 * ── PageView em SPA (corrigido em 24/10) ──────────────────────────────────
 *
 * Achado real: a campanha 804 mostrava 9 cliques e 0 visitas. O motivo estava
 * aqui. `loadMetaPixel` disparava `PageView` uma vez, e o `useEffect` rodava
 * com `[]`. Este site é uma SPA com wouter: trocar de página não recarrega o
 * documento, então nenhum PageView novo saía. O pixel só via a primeira tela.
 *
 * Agora o PageView acompanha a rota. O primeiro é disparado pelo `init` (é
 * assim que a Meta espera), e os seguintes vêm da troca de rota.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

const GA4_ID = (import.meta.env.VITE_GA4_ID as string | undefined) || "G-DGCPN51SD6";
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const CLARITY_ID = (import.meta.env.VITE_CLARITY_ID as string | undefined) || "z3xy56e2y4";

function loadGA4(id: string) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: unknown[]) { window.dataLayer!.push(args); };
  if (document.getElementById("ga4-script")) return;
  const s = document.createElement("script");
  s.id = "ga4-script";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  window.gtag("js", new Date());
  window.gtag("config", id);
}

function hasAnalyticsConsent(): boolean {
  const saved = safeLocalStorageGet("cookie-consent");
  if (!saved) return false;
  try {
    return JSON.parse(saved)?.analytics === true;
  } catch {
    return false;
  }
}

function sendGA4(...args: unknown[]) {
  if (hasAnalyticsConsent()) window.gtag?.(...args);
}

function sendMeta(...args: unknown[]) {
  if (hasAnalyticsConsent()) window.fbq?.(...args);
}

function loadMetaPixel(id: string) {
  // O pixel normalmente já nasceu no `<head>` do index.html, que é onde ele
  // precisa estar para disparar antes do bundle (ver o comentário lá). Então
  // este caminho é a rede de segurança: só roda se, por algum motivo, o
  // snippet do head não executou. `window.fbq` presente = já iniciado, e
  // chamar `init` de novo contaria a visita duas vezes.
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
  /**
   * user_id do GA4: o id interno do aluno logado (nunca e-mail ou nome). Faz o
   * mesmo aluno no celular e no computador contar como uma pessoa. Só com
   * consentimento; ao sair da conta, o GA4 volta a não saber quem é.
   */
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : null;
  useEffect(() => {
    const aplicar = () => {
      if (!hasAnalyticsConsent() || !GA4_ID || !window.gtag) return;
      window.gtag("set", { user_id: userId });
    };
    aplicar();
    window.addEventListener("cookie-consent-updated", aplicar);
    return () => window.removeEventListener("cookie-consent-updated", aplicar);
  }, [userId]);

  const [location] = useLocation();
  const primeiraRota = useRef(true);

  useEffect(() => {
    // Antes de qualquer script: guarda fbclid e UTMs da URL de entrada, que a
    // primeira navegação apaga.
    capturarAtribuicaoNaEntrada();
    const applyAnalyticsConsent = () => {
      const granted = hasAnalyticsConsent();
      window.gtag?.("consent", "update", {
        analytics_storage: granted ? "granted" : "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      if (granted && GA4_ID) loadGA4(GA4_ID);
      if (granted && META_PIXEL_ID) loadMetaPixel(META_PIXEL_ID);
      if (granted && CLARITY_ID) loadClarity(CLARITY_ID);
      if (window.clarity) {
        window.clarity("consentv2", {
          ad_Storage: "denied",
          analytics_Storage: granted ? "granted" : "denied",
        });
        if (!granted) window.clarity("consent", false);
      }
    };
    applyAnalyticsConsent();
    window.addEventListener("cookie-consent-updated", applyAnalyticsConsent);
    return () => window.removeEventListener("cookie-consent-updated", applyAnalyticsConsent);
  }, []);

  useEffect(() => {
    // O PageView da primeira tela já saiu junto do `init` — no `<head>` do
    // index.html, no caso normal, ou em `loadMetaPixel` na rede de segurança.
    // Repetir aqui contaria duas vezes a mesma visita, então a primeira rota
    // é sempre ignorada e este efeito cuida só das navegações seguintes.
    if (primeiraRota.current) {
      primeiraRota.current = false;
      return;
    }
    sendMeta("track", "PageView");
    // GA4: sem page_view manual. A "medição otimizada" do GA4 (ligada por
    // padrão no fluxo de dados) já registra a troca de tela pelo histórico do
    // navegador; mandar aqui também contava cada página duas vezes.
  }, [location]);

  return null;
}

/**
 * Evento customizado (nome fora da lista padrão da Meta).
 *
 * Usa `trackCustom` de propósito. Não passe por aqui nomes padrão como
 * Purchase, ViewContent ou InitiateCheckout: como evento customizado eles
 * não contam como conversão no Gerenciador de Anúncios. Para esses, use as
 * funções abaixo.
 */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  sendGA4("event", name, params);
  sendMeta("trackCustom", name, params);
}

export type ProdutoRastreado = {
  /** Identificador do produto no sistema, ex: "lesson:42". */
  contentId: string;
  contentName?: string;
  /** Valor em reais, não em centavos. */
  value: number;
  currency?: string;
};

/** Visualização da oferta. Página de produto, não a home genérica. */
export function trackViewContent({ contentId, contentName, value, currency = "BRL" }: ProdutoRastreado) {
  sendGA4("event", "view_item", {
    currency,
    value,
    items: [{ item_id: contentId, item_name: contentName }],
  });
  sendMeta("track", "ViewContent", {
    content_ids: [contentId],
    content_type: "product",
    ...(contentName ? { content_name: contentName } : {}),
    value,
    currency,
  });
}

/**
 * Início de pagamento. Dispare no clique que leva ao pagamento, nunca na
 * abertura da página de vendas.
 *
 * Devolve o `eventId` usado, para quem chamou mandar o mesmo identificador ao
 * servidor e a Meta não contar o evento duas vezes.
 */
export function trackInitiateCheckout({
  contentId,
  contentName,
  value,
  currency = "BRL",
}: ProdutoRastreado): string {
  const eventId = novoEventId("ic");
  sendGA4("event", "begin_checkout", {
    currency,
    value,
    items: [{ item_id: contentId, item_name: contentName }],
  });
  sendMeta(
    "track",
    "InitiateCheckout",
    {
      content_ids: [contentId],
      content_type: "product",
      ...(contentName ? { content_name: contentName } : {}),
      value,
      currency,
    },
    { eventID: eventId },
  );
  return eventId;
}

/**
 * Compatibilidade com as telas de assinatura.
 *
 * O `value` era passado como `0` fixo em `Pricing.tsx` (duas chamadas), e era
 * isso que fazia o InitiateCheckout aparecer com valor zero no relatório.
 * Agora o valor é obrigatório e vem do plano.
 */
export function trackCheckoutStart(planSlug: string, value: number) {
  return trackInitiateCheckout({ contentId: `plan:${planSlug}`, contentName: planSlug, value });
}

export function trackLead(source: string) {
  sendGA4("event", "generate_lead", { source });
  sendMeta("track", "Lead", { source });
}

/**
 * Compra confirmada, para o GA4. O pagamento acontece no Asaas e é confirmado
 * no servidor; a tela de "aguardando" é o único lugar onde o comprador ainda
 * está no site quando o dinheiro cai. `transaction_id` é o id da cobrança: o
 * GA4 descarta repetições com o mesmo id. A Meta já recebe o Purchase pelo
 * servidor (CAPI), então aqui não vai fbq para não duplicar.
 */
export function trackPurchaseGA4({ transactionId, value, contentId, contentName, currency = "BRL" }: {
  transactionId: string;
  value: number;
  contentId: string;
  contentName?: string;
  currency?: string;
}) {
  sendGA4("event", "purchase", {
    transaction_id: transactionId,
    currency,
    value,
    items: [{ item_id: contentId, item_name: contentName ?? "Teste de 1 aula", price: value, quantity: 1 }],
  });
}
