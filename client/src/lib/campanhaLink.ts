/** Link de campanha com UTM e CSV seguro, usados no painel Analytics. */
const slug = (v: string) =>
  v.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9._{}-]+/g, "-").replace(/^-+|-+$/g, "");

export function montarLinkDeCampanha(p: { caminho: string; origem: string; meio: string; campanha: string; conteudo?: string }, base = "https://shadiahasan.com"): string | null {
  const origem = slug(p.origem);
  const campanha = slug(p.campanha);
  if (!origem || !campanha) return null;
  // Aceita o endereço completo colado, mas o link sempre aponta para o site.
  const digitado = p.caminho.trim().replace(/^https?:\/\/[^/]+/i, "");
  const url = new URL(base);
  const alvo = new URL(`/${digitado.replace(/^\/+/, "")}`, url);
  alvo.searchParams.set("utm_source", origem);
  if (slug(p.meio)) alvo.searchParams.set("utm_medium", slug(p.meio));
  alvo.searchParams.set("utm_campaign", campanha);
  if (p.conteudo && slug(p.conteudo)) alvo.searchParams.set("utm_content", slug(p.conteudo));
  return alvo.toString();
}

/** CSV com aspas; texto que a planilha leria como fórmula ganha um apóstrofo. */
export function montarCsv(linhas: string[][]): string {
  const celula = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  return linhas.map((l) => l.map(celula).join(",")).join("\r\n");
}
