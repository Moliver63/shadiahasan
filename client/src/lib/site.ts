/**
 * Endereço público do site. Era "https://shadiahasan.club" (domínio antigo) em
 * SEOHead e Breadcrumbs, então canonical, og:url e trilha de navegação apontavam
 * para outro domínio. O domínio canônico é shadiahasan.com.
 */
export const SITE_URL = "https://shadiahasan.com";
export const SITE_NOME = "Shadia Hasan";
export const OG_IMAGE = `${SITE_URL}/og-image.jpg`;
export const LOGO_URL = `${SITE_URL}/logo.png`;
export const INSTAGRAM_URL = "https://www.instagram.com/shadia_hasan";

/** "/courses/x?y=1#z" → "https://shadiahasan.com/courses/x" (sem query nem âncora; "/" vira só o domínio com barra). */
export function urlAbsoluta(caminho: string): string {
  const limpo = (caminho || "/").split(/[?#]/)[0] || "/";
  return `${SITE_URL}${limpo.startsWith("/") ? limpo : `/${limpo}`}`;
}
