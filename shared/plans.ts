/**
 * Subscription Plans Configuration
 * Defines the 4-tier freemium model for Shadia Hasan platform
 */

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number; // in cents (BRL)
  priceDisplay: string;
  interval: "month" | "year";
  features: PlanFeature[];
  maxCourses: number | null; // null = unlimited
  hasVRAccess: boolean;
  hasLiveSupport: boolean;
  stripePriceId?: string;
  popular?: boolean;
  cta: string;
}

export const SUBSCRIPTION_PLANS: Plan[] = [
  {
    id: "free",
    name: "Gratuito",
    slug: "free",
    description: "Perfeito para começar sua jornada de autoconhecimento",
    price: 0,
    priceDisplay: "R$ 0",
    interval: "month",
    maxCourses: 1,
    hasVRAccess: false,
    hasLiveSupport: false,
    cta: "Começar Grátis",
    features: [
      { text: "1 curso gratuito completo", included: true },
      { text: "Acesso a conteúdos básicos", included: true },
      { text: "Certificado de conclusão", included: true },
      { text: "Acesso à comunidade", included: true },
      { text: "Experiência VR", included: false },
      { text: "Suporte prioritário", included: false },
      { text: "Lives exclusivas", included: false },
      { text: "Material complementar", included: false },
    ],
  },
  {
    id: "basic",
    name: "Básico",
    slug: "basic",
    description: "Ideal para quem quer aprofundar o aprendizado",
    price: 4990, // R$ 49,90
    priceDisplay: "R$ 49,90",
    interval: "month",
    maxCourses: 3,
    hasVRAccess: true,
    hasLiveSupport: false,
    cta: "Assinar Básico",
    features: [
      { text: "Até 3 cursos simultâneos", included: true },
      { text: "Todos os conteúdos da plataforma", included: true },
      { text: "Certificados de conclusão", included: true },
      { text: "Acesso à comunidade", included: true },
      { text: "Experiência VR completa", included: true },
      { text: "Material complementar em PDF", included: true },
      { text: "Suporte prioritário", included: false },
      { text: "Lives exclusivas", included: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    slug: "premium",
    description: "Para quem busca transformação completa",
    price: 9990, // R$ 99,90
    priceDisplay: "R$ 99,90",
    interval: "month",
    maxCourses: null, // unlimited
    hasVRAccess: true,
    hasLiveSupport: true,
    popular: true,
    cta: "Assinar Premium",
    features: [
      { text: "Acesso ilimitado a todos os cursos", included: true },
      { text: "Todos os conteúdos da plataforma", included: true },
      { text: "Certificados de conclusão", included: true },
      { text: "Acesso à comunidade exclusiva", included: true },
      { text: "Experiência VR completa", included: true },
      { text: "Material complementar completo", included: true },
      { text: "Suporte prioritário via WhatsApp", included: true },
      { text: "Lives mensais com Shadia", included: true },
    ],
  },
  {
    id: "vip",
    name: "VIP",
    slug: "vip",
    description: "Experiência personalizada e acompanhamento direto",
    price: 29990, // R$ 299,90
    priceDisplay: "R$ 299,90",
    interval: "month",
    maxCourses: null, // unlimited
    hasVRAccess: true,
    hasLiveSupport: true,
    cta: "Assinar VIP",
    features: [
      { text: "Tudo do plano Premium", included: true },
      { text: "Sessão individual mensal com Shadia", included: true },
      { text: "Grupo VIP exclusivo no WhatsApp", included: true },
      { text: "Acesso antecipado a novos cursos", included: true },
      { text: "Conteúdos exclusivos VIP", included: true },
      { text: "Plano de desenvolvimento personalizado", included: true },
      { text: "Certificado especial VIP", included: true },
      { text: "Desconto em mentorias individuais", included: true },
    ],
  },
];

/**
 * Get plan by slug
 */
export function getPlanBySlug(slug: string): Plan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.slug === slug);
}

/**
 * Get plan by ID
 */
export function getPlanById(id: string): Plan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === id);
}

/**
 * Check if user has access to a feature based on their plan
 */
export function hasFeatureAccess(
  userPlan: string,
  feature: "vr" | "live_support" | "unlimited_courses"
): boolean {
  const plan = getPlanBySlug(userPlan);
  if (!plan) return false;

  switch (feature) {
    case "vr":
      return plan.hasVRAccess;
    case "live_support":
      return plan.hasLiveSupport;
    case "unlimited_courses":
      return plan.maxCourses === null;
    default:
      return false;
  }
}
