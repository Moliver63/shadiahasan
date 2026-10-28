/**
 * Gráfico de acessos do painel Analytics: junta GA4, Meta e Clarity por dia.
 *
 * Pedido do Michel (28/10/2026): "precisa ter um grafico de acesso mostrando a
 * quantidade de acesso, use meta, ga4 e clarity".
 *
 * As chaves que o site já tem (GA4_API_SECRET do Measurement Protocol e
 * META_CAPI_ACCESS_TOKEN da API de Conversões) só ENVIAM dados. Para LER
 * acessos cada fonte pede uma credencial própria, todas opcionais. Sem a
 * credencial a fonte aparece como "não conectada" e as outras seguem normais.
 *
 *   GA4      GA4_PROPERTY_ID            número da propriedade (Admin > Detalhes da propriedade)
 *            GA4_SERVICE_ACCOUNT_JSON   JSON da conta de serviço, com acesso de Leitor na propriedade
 *   Meta     META_ADS_ACCOUNT_ID        id da conta de anúncios (com ou sem "act_")
 *            META_ADS_ACCESS_TOKEN      token com permissão ads_read
 *   Clarity  CLARITY_API_TOKEN          Settings > Data Export > Generate new API token
 *
 * O que cada fonte entrega:
 *   GA4      usuários, sessões e visualizações por dia (a API devolve a série inteira).
 *   Meta     impressões, cliques no link e visitas à página (landing_page_view) por
 *            dia. Conta só quem veio pelos anúncios.
 *   Clarity  a API só devolve o agregado das últimas 24/48/72 h, sem série diária e
 *            com limite de 10 chamadas por dia. Por isso guardamos um instantâneo
 *            por dia (tabela analyticsClaritySnapshots) e a série começa a existir
 *            a partir da conexão.
 *
 * GA4 e Clarity só contam quem aceitou cookies de análise (LGPD), então os dois
 * ficam abaixo do tráfego real.
 */
import { createSign } from "node:crypto";
import { sql } from "drizzle-orm";
import * as db from "./db";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type PontoAcessos = {
  /** YYYY-MM-DD, horário de Brasília */
  data: string;
  ga4Usuarios?: number;
  ga4Sessoes?: number;
  ga4Visualizacoes?: number;
  metaImpressoes?: number;
  metaCliques?: number;
  metaVisitas?: number;
  claritySessoes?: number;
  clarityUsuarios?: number;
};

export type FonteId = "ga4" | "meta" | "clarity";

export type EstadoFonte = {
  /** todas as credenciais necessárias estão nas variáveis de ambiente */
  configurada: boolean;
  /** a última leitura funcionou */
  ok: boolean;
  /** variáveis que faltam, quando não configurada */
  faltando: string[];
  erro?: string;
  nota?: string;
};

export type Acessos = {
  dias: number;
  inicio: string;
  fim: string;
  serie: PontoAcessos[];
  fontes: Record<FonteId, EstadoFonte>;
  totais: {
    ga4Sessoes: number | null;
    ga4Visualizacoes: number | null;
    metaImpressoes: number | null;
    metaCliques: number | null;
    metaVisitas: number | null;
    claritySessoes: number | null;
  };
  geradoEm: string;
};

export type Http = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  text: () => Promise<string>;
}>;

const httpPadrao: Http = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20_000) }) as any;

// ─── Datas (horário de Brasília) ────────────────────────────────────────────

const FUSO = "America/Sao_Paulo";

/** "YYYY-MM-DD" da data no fuso de Brasília. */
export function diaDeBrasilia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Todos os dias de `dias` atrás até hoje, inclusive. dias=7 devolve 7 datas. */
export function intervaloDeDias(dias: number, agora = new Date()): string[] {
  const fim = diaDeBrasilia(agora);
  const n = Math.max(1, Math.min(365, Math.floor(dias)));
  return Array.from({ length: n }, (_, i) => somarDias(fim, i - (n - 1)));
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ─── GA4 ────────────────────────────────────────────────────────────────────

export type ContaDeServico = { client_email: string; private_key: string };

export function lerContaDeServico(bruto: string | undefined): ContaDeServico | null {
  const texto = (bruto || "").trim();
  if (!texto) return null;
  try {
    // aceita o JSON puro ou em base64 (mais fácil de colar numa variável do Render)
    const json = texto.startsWith("{") ? texto : Buffer.from(texto, "base64").toString("utf8");
    const c = JSON.parse(json);
    if (typeof c.client_email !== "string" || typeof c.private_key !== "string") return null;
    return { client_email: c.client_email, private_key: c.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function assinarJwtGoogle(conta: ContaDeServico, escopo: string, agoraS = Math.floor(Date.now() / 1000)): string {
  const cabecalho = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify({
    iss: conta.client_email,
    scope: escopo,
    aud: "https://oauth2.googleapis.com/token",
    iat: agoraS,
    exp: agoraS + 3600,
  }));
  const assinatura = createSign("RSA-SHA256").update(`${cabecalho}.${corpo}`).sign(conta.private_key);
  return `${cabecalho}.${corpo}.${b64url(assinatura)}`;
}

let tokenGoogle: { valor: string; expiraEm: number } | null = null;

async function tokenDoGoogle(conta: ContaDeServico, http: Http): Promise<string> {
  if (tokenGoogle && tokenGoogle.expiraEm > Date.now() + 60_000) return tokenGoogle.valor;
  const jwt = assinarJwtGoogle(conta, "https://www.googleapis.com/auth/analytics.readonly");
  const r = await http("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  if (!r.ok) throw new Error(`Google recusou a conta de serviço (HTTP ${r.status}).`);
  const j = await r.json();
  if (!j.access_token) throw new Error("Google não devolveu token.");
  tokenGoogle = { valor: j.access_token, expiraEm: Date.now() + num(j.expires_in || 3600) * 1000 };
  return j.access_token;
}

/** runReport do GA4 (dimensão date; métricas activeUsers, sessions, screenPageViews) → pontos por dia. */
export function lerRespostaGa4(resposta: any): Map<string, Partial<PontoAcessos>> {
  const mapa = new Map<string, Partial<PontoAcessos>>();
  for (const linha of resposta?.rows ?? []) {
    const bruto = String(linha?.dimensionValues?.[0]?.value ?? "");
    if (!/^\d{8}$/.test(bruto)) continue;
    const dia = `${bruto.slice(0, 4)}-${bruto.slice(4, 6)}-${bruto.slice(6, 8)}`;
    const m = linha.metricValues ?? [];
    mapa.set(dia, { ga4Usuarios: num(m[0]?.value), ga4Sessoes: num(m[1]?.value), ga4Visualizacoes: num(m[2]?.value) });
  }
  return mapa;
}

async function buscarGa4(dias: string[], env: NodeJS.ProcessEnv, http: Http): Promise<Map<string, Partial<PontoAcessos>>> {
  const conta = lerContaDeServico(env.GA4_SERVICE_ACCOUNT_JSON);
  if (!conta) throw new Error("GA4_SERVICE_ACCOUNT_JSON inválida (precisa do client_email e da private_key).");
  const propriedade = (env.GA4_PROPERTY_ID || "").replace(/\D/g, "");
  const token = await tokenDoGoogle(conta, http);
  const r = await http(`https://analyticsdata.googleapis.com/v1beta/properties/${propriedade}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: dias[0], endDate: dias[dias.length - 1] }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 400,
    }),
  });
  if (!r.ok) {
    if (r.status === 403) throw new Error("GA4 negou o acesso: adicione o e-mail da conta de serviço como Leitor na propriedade.");
    throw new Error(`GA4 respondeu HTTP ${r.status}.`);
  }
  return lerRespostaGa4(await r.json());
}

// ─── Meta ───────────────────────────────────────────────────────────────────

/** insights diários da conta de anúncios → pontos por dia. */
export function lerRespostaMeta(linhas: any[]): Map<string, Partial<PontoAcessos>> {
  const mapa = new Map<string, Partial<PontoAcessos>>();
  for (const l of linhas ?? []) {
    const dia = String(l?.date_start ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) continue;
    const visitas = (l.actions ?? []).find((a: any) => a?.action_type === "landing_page_view");
    mapa.set(dia, {
      metaImpressoes: num(l.impressions),
      metaCliques: num(l.inline_link_clicks),
      metaVisitas: num(visitas?.value),
    });
  }
  return mapa;
}

async function buscarMeta(dias: string[], env: NodeJS.ProcessEnv, http: Http): Promise<Map<string, Partial<PontoAcessos>>> {
  const conta = (env.META_ADS_ACCOUNT_ID || "").trim().replace(/^act_/, "").replace(/\D/g, "");
  const versao = env.META_ADS_API_VERSION || env.META_CAPI_API_VERSION || "v21.0";
  const params = new URLSearchParams({
    fields: "impressions,inline_link_clicks,actions",
    time_increment: "1",
    time_range: JSON.stringify({ since: dias[0], until: dias[dias.length - 1] }),
    limit: "100",
  });
  let url: string | undefined = `https://graph.facebook.com/${versao}/act_${conta}/insights?${params}`;
  const linhas: any[] = [];
  // token no cabeçalho, nunca na URL (URL vai para log)
  const cabecalhos = { Authorization: `Bearer ${(env.META_ADS_ACCESS_TOKEN || "").trim()}` };
  for (let pagina = 0; url && pagina < 6; pagina++) {
    const r = await http(url, { headers: cabecalhos });
    if (!r.ok) {
      let detalhe = "";
      try { detalhe = (await r.json())?.error?.message || ""; } catch { /* sem corpo */ }
      throw new Error(`Meta respondeu HTTP ${r.status}${detalhe ? `: ${String(detalhe).slice(0, 160)}` : ""}.`);
    }
    const j = await r.json();
    linhas.push(...(j.data ?? []));
    url = j.paging?.next;
  }
  return lerRespostaMeta(linhas);
}

// ─── Clarity ────────────────────────────────────────────────────────────────

export type LeituraClarity = { sessoes: number; bots: number; usuarios: number };

/** project-live-insights → métrica "Traffic". Valores podem vir como texto. */
export function lerRespostaClarity(resposta: any): LeituraClarity | null {
  const lista = Array.isArray(resposta) ? resposta : [];
  const trafego = lista.find((m: any) => String(m?.metricName).toLowerCase() === "traffic");
  const info = trafego?.information?.[0];
  if (!info) return null;
  const total = num(info.totalSessionCount);
  const bots = num(info.totalBotSessionCount);
  return { sessoes: Math.max(0, total - bots), bots, usuarios: num(info.distinctUserCount) };
}

let esquemaClarity: Promise<boolean> | null = null;

export function garantirTabelaClarity(): Promise<boolean> {
  if (!esquemaClarity) {
    esquemaClarity = (async () => {
      try {
        const d = await db.getDb();
        if (!d) return false;
        await d.execute(sql`
          CREATE TABLE IF NOT EXISTS "analyticsClaritySnapshots" (
            "dia" varchar(10) PRIMARY KEY,
            "sessoes" integer NOT NULL DEFAULT 0,
            "bots" integer NOT NULL DEFAULT 0,
            "usuarios" integer NOT NULL DEFAULT 0,
            "lidoEm" timestamp NOT NULL DEFAULT now()
          )
        `);
        return true;
      } catch (e) {
        console.warn("[Acessos] tabela do Clarity indisponível:", e instanceof Error ? e.message : e);
        esquemaClarity = null;
        return false;
      }
    })();
  }
  return esquemaClarity;
}

/** A API do Clarity aceita 10 chamadas por dia: no máximo uma a cada 3 h. */
const INTERVALO_CLARITY_MS = 3 * 60 * 60 * 1000;

/**
 * Lê as últimas 24 h no Clarity e grava como instantâneo do dia de hoje.
 * Devolve false quando não chamou (sem token, lido há pouco ou erro).
 */
export async function atualizarClarity(env: NodeJS.ProcessEnv = process.env, http: Http = httpPadrao, agora = new Date()): Promise<boolean> {
  const token = (env.CLARITY_API_TOKEN || "").trim();
  if (!token || !(await garantirTabelaClarity())) return false;
  const d = await db.getDb();
  if (!d) return false;
  const hoje = diaDeBrasilia(agora);

  const ultimo = await d.execute(sql`SELECT "lidoEm" FROM "analyticsClaritySnapshots" WHERE "dia" = ${hoje}`);
  const lidoEm = (ultimo as any).rows?.[0]?.lidoEm ?? (ultimo as any)[0]?.lidoEm;
  if (lidoEm && agora.getTime() - new Date(lidoEm).getTime() < INTERVALO_CLARITY_MS) return false;

  const r = await http("https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1", {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(r.status === 429 ? "Clarity: limite de 10 consultas por dia atingido." : `Clarity respondeu HTTP ${r.status}.`);
  const leitura = lerRespostaClarity(await r.json());
  if (!leitura) throw new Error("Clarity não devolveu a métrica de tráfego.");

  await d.execute(sql`
    INSERT INTO "analyticsClaritySnapshots" ("dia", "sessoes", "bots", "usuarios", "lidoEm")
    VALUES (${hoje}, ${leitura.sessoes}, ${leitura.bots}, ${leitura.usuarios}, now())
    ON CONFLICT ("dia") DO UPDATE SET "sessoes" = EXCLUDED."sessoes", "bots" = EXCLUDED."bots",
      "usuarios" = EXCLUDED."usuarios", "lidoEm" = now()
  `);
  return true;
}

async function lerSnapshotsClarity(dias: string[]): Promise<Map<string, Partial<PontoAcessos>>> {
  const mapa = new Map<string, Partial<PontoAcessos>>();
  if (!(await garantirTabelaClarity())) return mapa;
  const d = await db.getDb();
  if (!d) return mapa;
  const r = await d.execute(sql`
    SELECT "dia", "sessoes", "usuarios" FROM "analyticsClaritySnapshots"
    WHERE "dia" >= ${dias[0]} AND "dia" <= ${dias[dias.length - 1]}
  `);
  for (const l of ((r as any).rows ?? r) as any[]) {
    mapa.set(String(l.dia), { claritySessoes: num(l.sessoes), clarityUsuarios: num(l.usuarios) });
  }
  return mapa;
}

// ─── Montagem ───────────────────────────────────────────────────────────────

export function faltandoPorFonte(env: NodeJS.ProcessEnv = process.env): Record<FonteId, string[]> {
  const falta = (nomes: string[]) => nomes.filter((n) => !(env[n] || "").trim());
  return {
    ga4: falta(["GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_JSON"]),
    meta: falta(["META_ADS_ACCOUNT_ID", "META_ADS_ACCESS_TOKEN"]),
    clarity: falta(["CLARITY_API_TOKEN"]),
  };
}

const CAMPOS_TOTAIS: Array<[keyof Acessos["totais"], keyof PontoAcessos]> = [
  ["ga4Sessoes", "ga4Sessoes"], ["ga4Visualizacoes", "ga4Visualizacoes"],
  ["metaImpressoes", "metaImpressoes"], ["metaCliques", "metaCliques"], ["metaVisitas", "metaVisitas"],
  ["claritySessoes", "claritySessoes"],
];

export function montarAcessos(
  dias: string[],
  fontes: Record<FonteId, { estado: EstadoFonte; pontos: Map<string, Partial<PontoAcessos>> }>,
  geradoEm = new Date(),
): Acessos {
  const serie: PontoAcessos[] = dias.map((data) => ({
    data,
    ...fontes.ga4.pontos.get(data),
    ...fontes.meta.pontos.get(data),
    ...fontes.clarity.pontos.get(data),
  }));
  // Dia sem linha numa fonte que respondeu = zero acessos naquele dia (a API omite dias vazios)
  for (const p of serie) {
    if (fontes.ga4.estado.ok) { p.ga4Usuarios ??= 0; p.ga4Sessoes ??= 0; p.ga4Visualizacoes ??= 0; }
    if (fontes.meta.estado.ok) { p.metaImpressoes ??= 0; p.metaCliques ??= 0; p.metaVisitas ??= 0; }
  }
  const totais = {} as Acessos["totais"];
  for (const [chave, campo] of CAMPOS_TOTAIS) {
    const valores = serie.map((p) => p[campo]).filter((v): v is number => typeof v === "number");
    // Só métricas que podem ser somadas entre dias (usuários únicos não podem, ficam só na linha do gráfico)
    totais[chave] = valores.length ? valores.reduce((a, b) => a + b, 0) : null;
  }
  return {
    dias: dias.length,
    inicio: dias[0],
    fim: dias[dias.length - 1],
    serie,
    fontes: { ga4: fontes.ga4.estado, meta: fontes.meta.estado, clarity: fontes.clarity.estado },
    totais,
    geradoEm: geradoEm.toISOString(),
  };
}

async function lerFonte(
  id: FonteId,
  faltando: string[],
  ler: () => Promise<Map<string, Partial<PontoAcessos>>>,
): Promise<{ estado: EstadoFonte; pontos: Map<string, Partial<PontoAcessos>> }> {
  if (faltando.length) return { estado: { configurada: false, ok: false, faltando }, pontos: new Map() };
  try {
    return { estado: { configurada: true, ok: true, faltando: [] }, pontos: await ler() };
  } catch (e) {
    const erro = e instanceof Error ? e.message.slice(0, 300) : String(e);
    console.warn(`[Acessos] ${id}:`, erro);
    return { estado: { configurada: true, ok: false, faltando: [], erro }, pontos: new Map() };
  }
}

const cache = new Map<number, { em: number; valor: Acessos }>();
const VALIDADE_CACHE_MS = 5 * 60 * 1000;

export async function obterAcessos(
  quantosDias: number,
  opcoes: { forcar?: boolean; env?: NodeJS.ProcessEnv; http?: Http; agora?: Date } = {},
): Promise<Acessos> {
  const env = opcoes.env ?? process.env;
  const http = opcoes.http ?? httpPadrao;
  const agora = opcoes.agora ?? new Date();
  const dias = intervaloDeDias(quantosDias, agora);

  const usaCache = !opcoes.env && !opcoes.http;
  const guardado = cache.get(dias.length);
  if (usaCache && !opcoes.forcar && guardado && Date.now() - guardado.em < VALIDADE_CACHE_MS) return guardado.valor;

  const faltando = faltandoPorFonte(env);

  // Clarity: tenta renovar o instantâneo de hoje (respeita o intervalo de 3 h); falha não derruba o gráfico
  let erroClarity: string | undefined;
  if (!faltando.clarity.length) {
    try { await atualizarClarity(env, http, agora); } catch (e) { erroClarity = e instanceof Error ? e.message : String(e); }
  }

  const [ga4, meta, clarity] = await Promise.all([
    lerFonte("ga4", faltando.ga4, () => buscarGa4(dias, env, http)),
    lerFonte("meta", faltando.meta, () => buscarMeta(dias, env, http)),
    lerFonte("clarity", faltando.clarity, () => lerSnapshotsClarity(dias)),
  ]);
  if (clarity.estado.configurada) {
    if (erroClarity) { clarity.estado.erro = erroClarity; if (!clarity.pontos.size) clarity.estado.ok = false; }
    clarity.estado.nota = "O Clarity só informa as últimas 24 h. Gravamos um número por dia, então o histórico começa na data da conexão.";
  }
  if (meta.estado.configurada) meta.estado.nota = "Conta apenas quem chegou pelos anúncios.";
  if (ga4.estado.configurada) ga4.estado.nota = "Conta apenas quem aceitou os cookies de análise.";

  const resultado = montarAcessos(dias, { ga4, meta, clarity }, agora);
  if (usaCache) cache.set(dias.length, { em: Date.now(), valor: resultado });
  return resultado;
}

/** Chamado pelo agendador do servidor: mantém o instantâneo do Clarity em dia mesmo sem ninguém abrir o painel. */
export async function manterClarityEmDia(): Promise<void> {
  try {
    await atualizarClarity();
  } catch (e) {
    console.warn("[Acessos] Clarity:", e instanceof Error ? e.message : e);
  }
}
