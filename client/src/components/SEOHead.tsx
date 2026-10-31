import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import { OG_IMAGE, SITE_NOME, urlAbsoluta } from "@/lib/site";

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
  /** Páginas que não devem aparecer no Google (ex.: resultado de busca interna). */
  noindex?: boolean;
}

/**
 * SEOHead - Componente para meta tags dinâmicas otimizadas para SEO
 * 
 * Implementa:
 * - Title tags otimizados
 * - Meta descriptions
 * - Open Graph tags para redes sociais
 * - Twitter Cards
 * - Canonical URLs
 */
export function SEOHead({
  title,
  description,
  keywords,
  ogImage = OG_IMAGE,
  ogType = "website",
  canonicalUrl,
  noindex = false,
}: SEOHeadProps) {
  const [caminho] = useLocation();
  const fullTitle = title.includes(SITE_NOME) ? title : `${title} | ${SITE_NOME}`;
  // Cada página aponta para o próprio endereço no domínio canônico (antes todas apontavam para a home).
  const canonical = canonicalUrl || urlAbsoluta(caminho);

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonical} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE_NOME} />
      <meta property="og:locale" content="pt_BR" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Additional SEO */}
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />
      <meta name="language" content="Portuguese" />
      <meta name="author" content="Shadia Hasan" />
    </Helmet>
  );
}
