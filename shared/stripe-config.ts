/**
 * stripe-config.ts — Mapeamento de planos para Price IDs do Stripe
 * Localização: shared/stripe-config.ts
 *
 * Os Price IDs vêm do .env — não hardcoded — para facilitar
 * trocar entre ambientes (dev/prod) sem alterar código.
 */

export type PlanSlug = "basic" | "premium" | "vip";

/**
 * Retorna o Price ID do Stripe para um plano
 * Lê as variáveis de ambiente configuradas no .env
 */
export function getStripePriceId(planSlug: PlanSlug): string | null {
  const map: Record<PlanSlug, string | undefined> = {
    basic:   process.env.STRIPE_PRICE_BASICO,
    premium: process.env.STRIPE_PRICE_PREMIUM,
    vip:     process.env.STRIPE_PRICE_VIP,
  };

  return map[planSlug] || null;
}

/**
 * Retorna o Product ID do Stripe para um plano
 */
export function getStripeProductId(planSlug: PlanSlug): string | null {
  const map: Record<PlanSlug, string | undefined> = {
    basic:   process.env.STRIPE_PROD_BASICO,
    premium: process.env.STRIPE_PROD_PREMIUM,
    vip:     process.env.STRIPE_PROD_VIP,
  };

  return map[planSlug] || null;
}

/**
 * Verifica se um plano específico está configurado no Stripe
 */
export function isPlanStripeConfigured(planSlug: PlanSlug): boolean {
  const priceId = getStripePriceId(planSlug);
  return !!(priceId && priceId !== "" && !priceId.includes("SUBSTITUA"));
}

/**
 * Retorna o nome legível de um plano
 */
export function getPlanDisplayName(planSlug: PlanSlug | "free"): string {
  const names: Record<string, string> = {
    free:    "Gratuito",
    basic:   "Básico",
    premium: "Premium",
    vip:     "VIP",
  };
  return names[planSlug] || planSlug;
}

/**
 * Mapeia um Price ID do Stripe de volta para o slug do plano
 * Útil nos webhooks para identificar qual plano foi comprado
 */
export function getPlanSlugByPriceId(priceId: string): PlanSlug | null {
  if (priceId === process.env.STRIPE_PRICE_BASICO)  return "basic";
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) return "premium";
  if (priceId === process.env.STRIPE_PRICE_VIP)     return "vip";
  return null;
}
