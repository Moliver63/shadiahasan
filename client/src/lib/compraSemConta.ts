/**
 * Token da compra sem conta (ver server/trialGuest.ts). Só este navegador o
 * tem: é ele que libera o login automático depois do Pix. Fica no
 * localStorage para sobreviver à ida até a fatura do Asaas e à volta.
 * Navegação privada ou armazenamento bloqueado: a página também aceita o
 * token no fragmento da URL (#t=...), que nunca vai para o servidor.
 */
const CHAVE = "shadia:compraSemConta";
const VALIDADE_MS = 3 * 24 * 60 * 60 * 1000;

/** Compra de Programa sem conta usa outra chave: os dois tokens vivem em tabelas diferentes. */
export const CHAVE_PROGRAMA = "shadia:compraProgramaSemConta";

export function guardarCompra(token: string, agora = Date.now(), chave = CHAVE): void {
  try {
    localStorage.setItem(chave, JSON.stringify({ token, em: agora }));
  } catch { /* sem armazenamento: vale o #t= da URL */ }
}

export function lerCompra(hash: string = typeof window !== "undefined" ? window.location.hash : "", agora = Date.now(), chave = CHAVE): string | null {
  const daUrl = /(?:^#|&)t=([A-Za-z0-9_-]{20,128})/.exec(hash || "")?.[1];
  if (daUrl) return daUrl;
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return null;
    const { token, em } = JSON.parse(bruto) as { token?: string; em?: number };
    if (!token || typeof em !== "number" || agora - em > VALIDADE_MS) return null;
    return token;
  } catch {
    return null;
  }
}

export function limparCompra(chave = CHAVE): void {
  try { localStorage.removeItem(chave); } catch { /* nada a limpar */ }
}
