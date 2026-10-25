/**
 * Token da compra sem conta (ver server/trialGuest.ts). Só este navegador o
 * tem: é ele que libera o login automático depois do Pix. Fica no
 * localStorage para sobreviver à ida até a fatura do Asaas e à volta.
 * Navegação privada ou armazenamento bloqueado: a página também aceita o
 * token no fragmento da URL (#t=...), que nunca vai para o servidor.
 */
const CHAVE = "shadia:compraSemConta";
const VALIDADE_MS = 3 * 24 * 60 * 60 * 1000;

export function guardarCompra(token: string, agora = Date.now()): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ token, em: agora }));
  } catch { /* sem armazenamento: vale o #t= da URL */ }
}

export function lerCompra(hash: string = typeof window !== "undefined" ? window.location.hash : "", agora = Date.now()): string | null {
  const daUrl = /(?:^#|&)t=([A-Za-z0-9_-]{20,128})/.exec(hash || "")?.[1];
  if (daUrl) return daUrl;
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const { token, em } = JSON.parse(bruto) as { token?: string; em?: number };
    if (!token || typeof em !== "number" || agora - em > VALIDADE_MS) return null;
    return token;
  } catch {
    return null;
  }
}

export function limparCompra(): void {
  try { localStorage.removeItem(CHAVE); } catch { /* nada a limpar */ }
}
