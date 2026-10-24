/**
 * Intenção de compra do teste de 1 aula, guardada antes do login.
 *
 * Achado real (24/10/2026, campanha 804): quem clicava em "Quero experimentar"
 * sem estar logado ia para /login e, depois de entrar (Google ou e-mail), caía
 * em /courses. A compra se perdia no meio. Resultado da campanha no primeiro
 * dia: dezenas de visitas vindas do anúncio, zero cobranças. Agora a aula
 * escolhida fica guardada e o pagamento reabre sozinho depois do login.
 */
const CHAVE = "shadia:trialIntent";
const VALIDADE_MS = 60 * 60 * 1000; // 1 h: tempo de sobra para criar conta e voltar

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storage(): Armazenamento | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

export function guardarIntencao(lessonId: number, agora = Date.now(), s: Armazenamento | null = storage()): void {
  try { s?.setItem(CHAVE, JSON.stringify({ lessonId, em: agora })); } catch { /* sem storage: segue sem retomar */ }
}

/** Lê sem apagar. Vencida ou inválida é descartada. */
export function lerIntencao(agora = Date.now(), s: Armazenamento | null = storage()): number | null {
  try {
    const raw = s?.getItem(CHAVE);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!Number.isInteger(v?.lessonId) || v.lessonId <= 0 || typeof v.em !== "number" || agora - v.em > VALIDADE_MS || v.em > agora + 60_000) {
      s?.removeItem(CHAVE);
      return null;
    }
    return v.lessonId;
  } catch {
    return null;
  }
}

export function limparIntencao(s: Armazenamento | null = storage()): void {
  try { s?.removeItem(CHAVE); } catch { /* nada */ }
}

/** Visitante veio do anúncio da aula de R$ 19,90 (ou de um link direto para a oferta). */
export function veioDaOferta(search: string, hash: string): boolean {
  if (hash === "#experimente-uma-aula") return true;
  const p = new URLSearchParams(search);
  return /aula-19-90/i.test(p.get("utm_campaign") || "") || p.has("oferta");
}
