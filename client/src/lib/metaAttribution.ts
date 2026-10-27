/**
 * metaAttribution.ts — dados de origem do visitante, para o evento do servidor
 * casar com o clique no anúncio.
 *
 * Por que existe. O pagamento do teste acontece na fatura do Asaas, fora do
 * site. Quem paga pode nunca voltar, então o `Purchase` tem que sair do
 * servidor (Conversions API). Só que o servidor não vê os cookies do navegador:
 * sem `_fbp` e `_fbc`, a Meta recebe uma compra que não consegue atribuir a
 * campanha nenhuma, e o relatório continua mostrando zero.
 *
 * Então o navegador captura esses dados na chegada e os manda junto do pedido.
 *
 * - `_fbp`: cookie que o próprio pixel escreve.
 * - `_fbc`: cookie que o pixel escreve quando a URL tem `fbclid`. Pode não
 *   existir ainda quando o visitante acabou de chegar, então montamos a partir
 *   do `fbclid` da URL no formato que a Meta especifica.
 * - UTMs: guardadas na sessão porque o clique cai numa página e a compra
 *   começa em outra; sem guardar, a origem se perde na primeira navegação.
 *
 * Nada aqui identifica a pessoa. São identificadores de clique e de navegador.
 */
import { idsGA4Atuais } from "@/lib/ga4Ids";

const CHAVE_SESSAO = "shadia:meta-attr";

export type AtribuicaoMeta = {
  fbp?: string;
  fbc?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  /** URL onde o visitante entrou, exigida pela Conversions API como event_source_url. */
  landingUrl?: string;
  /** GA4, só com consentimento (ver lib/ga4Ids.ts). Não é gravado na sessão. */
  ga4ClientId?: string;
  ga4SessionId?: string;
};

function lerCookie(nome: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const alvo = `${nome}=`;
  for (const parte of document.cookie.split(";")) {
    const limpo = parte.trim();
    if (limpo.startsWith(alvo)) return decodeURIComponent(limpo.slice(alvo.length)) || undefined;
  }
  return undefined;
}

/**
 * Formato do `_fbc` definido pela Meta: `fb.1.<timestamp em ms>.<fbclid>`.
 * O subdomain index é 1 para domínio com um nível (shadiahasan.com).
 */
function fbcDeFbclid(fbclid: string): string {
  return `fb.1.${Date.now()}.${fbclid}`;
}

function lerSessao(): AtribuicaoMeta {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    return bruto ? (JSON.parse(bruto) as AtribuicaoMeta) : {};
  } catch {
    // Navegação privada ou storage bloqueado: segue sem sessão.
    return {};
  }
}

function gravarSessao(dados: AtribuicaoMeta): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(dados));
  } catch {
    /* storage indisponível: a atribuição desta navegação se perde, o site não */
  }
}

/**
 * Chamada uma vez na subida do app. Lê a URL de entrada e guarda o que só
 * existe ali (fbclid e UTMs), antes da primeira navegação apagar os parâmetros.
 */
export function capturarAtribuicaoNaEntrada(): void {
  if (typeof window === "undefined") return;
  const guardado = lerSessao();
  const params = new URLSearchParams(window.location.search);

  const fbclid = params.get("fbclid") || undefined;
  const novo: AtribuicaoMeta = {
    ...guardado,
    // O primeiro clique da sessão é que manda: se o visitante já veio de um
    // anúncio, uma navegação interna sem UTM não pode apagar a origem.
    utmSource: guardado.utmSource ?? (params.get("utm_source") || undefined),
    utmMedium: guardado.utmMedium ?? (params.get("utm_medium") || undefined),
    utmCampaign: guardado.utmCampaign ?? (params.get("utm_campaign") || undefined),
    utmContent: guardado.utmContent ?? (params.get("utm_content") || undefined),
    utmTerm: guardado.utmTerm ?? (params.get("utm_term") || undefined),
    landingUrl: guardado.landingUrl ?? window.location.href,
  };
  if (!novo.fbc && fbclid) novo.fbc = fbcDeFbclid(fbclid);
  gravarSessao(novo);
}

/**
 * Atribuição atual, para mandar junto de um pedido. O `_fbp` é lido do cookie
 * na hora: o pixel pode tê-lo escrito depois da entrada.
 */
export function atribuicaoAtual(): AtribuicaoMeta {
  const guardado = lerSessao();
  const fbp = lerCookie("_fbp");
  const fbcDoCookie = lerCookie("_fbc");
  return {
    ...guardado,
    ...(fbp ? { fbp } : {}),
    // O cookie escrito pelo pixel vale mais que o nosso, montado do fbclid.
    ...(fbcDoCookie ? { fbc: fbcDoCookie } : {}),
    // Para o servidor mandar a compra ao GA4 quando o Pix cair
    ...idsGA4Atuais(),
  };
}

/**
 * Identificador do evento, compartilhado entre navegador e servidor para a
 * Meta não contar duas vezes o mesmo acontecimento.
 */
export function novoEventId(prefixo: string): string {
  const aleatorio =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefixo}.${aleatorio}`;
}
