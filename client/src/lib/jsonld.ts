/**
 * Dados estruturados (schema.org) que o Google lê para entender quem é o site,
 * quais cursos existem e quais perguntas ele responde. Funções puras, sem React.
 */
import { INSTAGRAM_URL, LOGO_URL, SITE_NOME, SITE_URL, urlAbsoluta } from "./site";

type Json = Record<string, unknown>;

export function organizacaoSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organizacao`,
    name: SITE_NOME,
    url: SITE_URL,
    logo: LOGO_URL,
    description: "Psicologia e desenvolvimento humano: cursos online e experiências imersivas em realidade virtual com Shadia Hasan.",
    sameAs: [INSTAGRAM_URL],
    founder: { "@type": "Person", name: SITE_NOME, jobTitle: "Psicóloga" },
  };
}

export function siteSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#site`,
    name: SITE_NOME,
    url: SITE_URL,
    inLanguage: "pt-BR",
    publisher: { "@id": `${SITE_URL}/#organizacao` },
  };
}

/** Tira HTML e espaços repetidos de um texto vindo do admin e limita o tamanho. */
export function textoLimpo(t: string | null | undefined, max = 300): string {
  const s = (t ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function cursoSchema(c: { title: string; slug: string; description?: string | null; thumbnail?: string | null }): Json | null {
  const nome = textoLimpo(c.title, 120);
  const descricao = textoLimpo(c.description);
  // Google exige nome e descrição para o curso; sem descrição é melhor não emitir.
  if (!nome || !descricao) return null;
  const out: Json = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: nome,
    description: descricao,
    url: urlAbsoluta(`/courses/${encodeURIComponent(c.slug)}`),
    inLanguage: "pt-BR",
    provider: { "@type": "Organization", name: SITE_NOME, sameAs: SITE_URL },
  };
  if (c.thumbnail && /^https?:\/\//.test(c.thumbnail)) out.image = c.thumbnail;
  return out;
}

export function faqSchema(itens: { q: string; a: string }[]): Json | null {
  const validos = itens.filter((i) => i.q?.trim() && i.a?.trim());
  if (!validos.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: validos.map((i) => ({
      "@type": "Question",
      name: textoLimpo(i.q, 300),
      acceptedAnswer: { "@type": "Answer", text: textoLimpo(i.a, 1500) },
    })),
  };
}

/** Serializa para dentro de <script type="application/ld+json"> sem permitir fechar a tag. */
export function jsonLdSeguro(obj: Json): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
