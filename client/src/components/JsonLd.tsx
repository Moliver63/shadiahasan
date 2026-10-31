import { jsonLdSeguro } from "@/lib/jsonld";

/**
 * Bloco de dados estruturados no corpo da página. De propósito não usa o Helmet:
 * o Helmet gerencia as meta tags do <head> (e apaga as que ele controla quando não
 * há <SEOHead> na tela), e o Google lê JSON-LD em qualquer lugar do documento.
 */
export function JsonLd({ dados }: { dados: Record<string, unknown> | null | undefined }) {
  if (!dados) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro(dados) }} />;
}
