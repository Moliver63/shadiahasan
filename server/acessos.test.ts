import { describe, expect, it } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import {
  assinarJwtGoogle, diaDeBrasilia, faltandoPorFonte, intervaloDeDias, lerContaDeServico,
  lerRespostaClarity, lerRespostaGa4, lerRespostaMeta, montarAcessos, obterAcessos, type EstadoFonte, type Http,
} from "./acessos";

const vazio = (): { estado: EstadoFonte; pontos: Map<string, any> } => ({ estado: { configurada: false, ok: false, faltando: ["X"] }, pontos: new Map() });
const ok = (pontos: Map<string, any>) => ({ estado: { configurada: true, ok: true, faltando: [] } as EstadoFonte, pontos });

describe("datas em horário de Brasília", () => {
  it("23h30 de Brasília ainda é o dia anterior em UTC+0", () => {
    expect(diaDeBrasilia(new Date("2026-10-29T02:30:00Z"))).toBe("2026-10-28");
  });
  it("intervalo tem N dias terminando hoje, sem pular dia na virada de mês", () => {
    const d = intervaloDeDias(7, new Date("2026-11-02T15:00:00Z"));
    expect(d).toHaveLength(7);
    expect(d[0]).toBe("2026-10-27");
    expect(d[6]).toBe("2026-11-02");
    expect(d).toContain("2026-10-31");
  });
});

describe("GA4", () => {
  it("lê linhas do runReport por dia", () => {
    const m = lerRespostaGa4({ rows: [
      { dimensionValues: [{ value: "20261027" }], metricValues: [{ value: "40" }, { value: "55" }, { value: "130" }] },
      { dimensionValues: [{ value: "lixo" }], metricValues: [] },
    ] });
    expect(m.size).toBe(1);
    expect(m.get("2026-10-27")).toEqual({ ga4Usuarios: 40, ga4Sessoes: 55, ga4Visualizacoes: 130 });
  });
  it("aceita conta de serviço em JSON puro e em base64, com \\n escapado na chave", () => {
    const json = JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: "-----BEGIN\\nXYZ" });
    expect(lerContaDeServico(json)?.private_key).toBe("-----BEGIN\nXYZ");
    expect(lerContaDeServico(Buffer.from(json).toString("base64"))?.client_email).toBe("a@b.iam.gserviceaccount.com");
    expect(lerContaDeServico("nao é json")).toBeNull();
    expect(lerContaDeServico(JSON.stringify({ client_email: "x" }))).toBeNull();
  });
  it("JWT do Google é RS256 válido com escopo de leitura", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const jwt = assinarJwtGoogle({ client_email: "sa@x.iam", private_key: pem }, "https://www.googleapis.com/auth/analytics.readonly", 1_000_000);
    const [h, c, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const corpo = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(corpo).toMatchObject({ iss: "sa@x.iam", scope: "https://www.googleapis.com/auth/analytics.readonly", iat: 1_000_000, exp: 1_003_600 });
    expect(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });
});

describe("Meta", () => {
  it("separa visitas à página (landing_page_view) dos outros eventos", () => {
    const m = lerRespostaMeta([
      { date_start: "2026-10-27", impressions: "1200", inline_link_clicks: "30", actions: [{ action_type: "link_click", value: "30" }, { action_type: "landing_page_view", value: "21" }] },
      { date_start: "2026-10-28", impressions: "10" },
    ]);
    expect(m.get("2026-10-27")).toEqual({ metaImpressoes: 1200, metaCliques: 30, metaVisitas: 21 });
    expect(m.get("2026-10-28")).toEqual({ metaImpressoes: 10, metaCliques: 0, metaVisitas: 0 });
  });
});

describe("Clarity", () => {
  it("lê o tráfego e tira os robôs das sessões", () => {
    const r = lerRespostaClarity([
      { metricName: "DeadClickCount", information: [{ sessionsCount: "3" }] },
      { metricName: "Traffic", information: [{ totalSessionCount: "120", totalBotSessionCount: "20", distinctUserCount: "90" }] },
    ]);
    expect(r).toEqual({ sessoes: 100, bots: 20, usuarios: 90 });
  });
  it("sem a métrica de tráfego devolve null", () => {
    expect(lerRespostaClarity([])).toBeNull();
    expect(lerRespostaClarity({ erro: 1 })).toBeNull();
  });
});

describe("montagem da série", () => {
  const dias = ["2026-10-26", "2026-10-27", "2026-10-28"];
  it("dia que a API omitiu vira zero quando a fonte respondeu, e fica sem valor quando a fonte não está conectada", () => {
    const r = montarAcessos(dias, {
      ga4: ok(new Map([["2026-10-27", { ga4Usuarios: 5, ga4Sessoes: 6, ga4Visualizacoes: 9 }]])),
      meta: vazio(),
      clarity: vazio(),
    });
    expect(r.serie[0]).toMatchObject({ data: "2026-10-26", ga4Sessoes: 0 });
    expect(r.serie[0].metaVisitas).toBeUndefined();
    expect(r.totais.ga4Sessoes).toBe(6);
    expect(r.totais.metaVisitas).toBeNull();
    expect(r.totais.claritySessoes).toBeNull();
    expect(r.dias).toBe(3);
  });
});

describe("obterAcessos", () => {
  it("lista as variáveis que faltam e não chama nenhuma API", async () => {
    expect(faltandoPorFonte({} as any)).toEqual({
      ga4: ["GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_JSON"], meta: ["META_ADS_ACCOUNT_ID", "META_ADS_ACCESS_TOKEN"], clarity: ["CLARITY_API_TOKEN"],
    });
    let chamadas = 0;
    const http: Http = async () => { chamadas++; throw new Error("não devia chamar"); };
    const r = await obterAcessos(7, { env: {} as any, http, agora: new Date("2026-10-28T15:00:00Z") });
    expect(chamadas).toBe(0);
    expect(r.fontes.ga4).toMatchObject({ configurada: false, ok: false });
    expect(r.serie).toHaveLength(7);
  });

  it("Meta: manda o token no cabeçalho, nunca na URL, e uma fonte com erro não derruba as outras", async () => {
    const urls: string[] = [];
    const cabecalhos: Array<Record<string, string> | undefined> = [];
    const http: Http = async (url, init) => {
      urls.push(url); cabecalhos.push(init?.headers);
      return { ok: true, status: 200, text: async () => "", json: async () => ({ data: [{ date_start: "2026-10-28", impressions: "50", inline_link_clicks: "4", actions: [{ action_type: "landing_page_view", value: "3" }] }] }) };
    };
    const r = await obterAcessos(7, {
      env: { META_ADS_ACCOUNT_ID: "act_123456", META_ADS_ACCESS_TOKEN: "segredo-meta", GA4_PROPERTY_ID: "999", GA4_SERVICE_ACCOUNT_JSON: "quebrado" } as any,
      http, agora: new Date("2026-10-28T15:00:00Z"),
    });
    expect(urls[0]).toContain("/act_123456/insights");
    expect(urls[0]).not.toContain("segredo-meta");
    expect(cabecalhos[0]?.Authorization).toBe("Bearer segredo-meta");
    expect(r.fontes.meta.ok).toBe(true);
    expect(r.serie[6]).toMatchObject({ data: "2026-10-28", metaVisitas: 3 });
    expect(r.fontes.ga4).toMatchObject({ configurada: true, ok: false });
    expect(r.fontes.ga4.erro).toContain("GA4_SERVICE_ACCOUNT_JSON");
  });

  it("Meta com erro HTTP mostra a mensagem da Meta sem vazar o token", async () => {
    const http: Http = async () => ({ ok: false, status: 400, text: async () => "", json: async () => ({ error: { message: "Invalid OAuth access token" } }) });
    const r = await obterAcessos(7, { env: { META_ADS_ACCOUNT_ID: "1", META_ADS_ACCESS_TOKEN: "tok-secreto" } as any, http, agora: new Date("2026-10-28T15:00:00Z") });
    expect(r.fontes.meta.ok).toBe(false);
    expect(r.fontes.meta.erro).toContain("Invalid OAuth access token");
    expect(JSON.stringify(r)).not.toContain("tok-secreto");
  });
});
