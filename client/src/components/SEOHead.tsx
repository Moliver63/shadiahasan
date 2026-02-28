import { Helmet } from "react-helmet-async";

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
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
  ogImage = "https://shadiahasan.club/og-image.jpg",
  ogType = "website",
  canonicalUrl,
}: SEOHeadProps) {
  const fullTitle = `${title} | Shadia Hasan`;
  const siteUrl = "https://shadiahasan.club";
  const canonical = canonicalUrl || siteUrl;

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
      <meta property="og:site_name" content="Shadia Hasan" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Additional SEO */}
      <meta name="robots" content="index, follow" />
      <meta name="language" content="Portuguese" />
      <meta name="author" content="Shadia Hasan" />
    </Helmet>
  );
}
