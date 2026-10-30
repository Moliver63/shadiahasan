/**
 * Conserta acentos "quebrados" (mojibake): texto UTF-8 que foi lido como Latin-1
 * e gravado de novo, virando "BÃ¡sico" no lugar de "Básico".
 *
 * Só mexe em sequências que são UTF-8 mal lido (um caractere Ã/Â/Ä... seguido de
 * bytes de continuação U+0080–U+00BF). Texto correto, inclusive em maiúsculas
 * como "COMUNICAÇÃO", passa intacto. Sem dependências: serve no servidor e no site.
 */
const SEQUENCIA_QUEBRADA = /[Â-ô][\u0080-¿]+/g;

export function temAcentoQuebrado(texto: string | null | undefined): boolean {
  if (!texto) return false;
  SEQUENCIA_QUEBRADA.lastIndex = 0;
  return SEQUENCIA_QUEBRADA.test(texto);
}

export function consertarAcentos<T extends string | null | undefined>(texto: T): T {
  if (!texto || !temAcentoQuebrado(texto)) return texto;
  return texto.replace(SEQUENCIA_QUEBRADA, (trecho) => {
    const decodificado = new TextDecoder("utf-8").decode(Uint8Array.from(trecho, (ch) => ch.charCodeAt(0)));
    // Se não virar UTF-8 válido, deixa como estava
    return decodificado.includes("�") ? trecho : decodificado;
  }) as T;
}

/** Aplica nos campos de texto de um plano (nome, descrição, lista de recursos). */
export function consertarPlano<P extends { name?: string | null; description?: string | null; features?: string | null }>(plano: P): P {
  if (!plano) return plano;
  return {
    ...plano,
    ...(plano.name !== undefined ? { name: consertarAcentos(plano.name) } : {}),
    ...(plano.description !== undefined ? { description: consertarAcentos(plano.description) } : {}),
    ...(plano.features !== undefined ? { features: consertarAcentos(plano.features) } : {}),
  };
}

