/**
 * Link de compra direta: `/?comprar=pensamentos-automaticos#experimente-uma-aula`.
 * A página /cursos usa isso para abrir o pagamento da aula de R$ 19,90 do curso certo,
 * sem o visitante ter que procurar a oferta na home.
 */
export function slugTitulo(titulo: string): string {
  return String(titulo || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Devolve a aula de entrada pedida em `?comprar=`, ou null (sem pedido, ou curso que não vende aula avulsa agora). */
export function acharEntrada<T extends { courseTitle: string; lessonId: number }>(entries: T[], search: string): T | null {
  const pedido = new URLSearchParams(search).get("comprar");
  if (!pedido) return null;
  const slug = slugTitulo(pedido);
  if (!slug) return null;
  return entries.find((e) => slugTitulo(e.courseTitle) === slug) ?? null;
}
