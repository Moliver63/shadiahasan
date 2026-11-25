import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  TIKTOK_EVENTS_URL, enviarCompraTikTok, enviarCompraConfirmadaTikTok, montarCorpoCompra, registrarAtribuicaoTikTok,
  tiktokEventsConfigurado, identificadorValido, _internals,
} from "./tiktokEvents";

/**
 * Events API do TikTok: Purchase pelo servidor, uma vez por cobrança do Asaas.
 * Nenhum teste toca a rede nem o banco: fetch e banco entram como dublês.
 */

const AMBIENTE = { ...process.env };
beforeEach(() => {
  process.env.TIKTOK_PIXEL_ID = "CTESTE123";
  process.env.TIKTOK_EVENTS_ACCESS_TOKEN = "token-secreto-de-teste";
  delete process.env.TIKTOK_EVENTS_TEST_CODE;
});
afterEach(() => { process.env = { ...AMBIENTE }; });

function fetchFalso(r: { ok?: boolean; status?: number; body: string }) {
  const chamadas: Array<{ url: string; headers: any; corpo: any }> = [];
  const impl = (async (url: any, init: any) => {
    chamadas.push({ url: String(url), headers: init?.headers, corpo: JSON.parse(String(init?.body ?? "{}")) });
    return { ok: r.ok ?? true, status: r.status ?? 200, text: async () => r.body } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, chamadas };
}

const COMPRA = {
  eventId: "pay_abc123", value: 197, contentId: "programa:7", contentName: "Programa Black Friday",
  email: "  Maria@Exemplo.COM ", phone: "(11) 99999-8888", externalId: "42", eventTime: 1_700_000_000,
  atribuicao: { ttclid: "E.C.P.abc123", ttp: "ttp-xyz_1", tiktokConsent: true, clientIp: "203.0.113.9", clientUserAgent: "UA-do-comprador", landingUrl: "https://shadiahasan.com/cursos?ttclid=E.C.P.abc123" },
};

describe("corpo do Purchase", () => {
  it("segue o formato da Events API 2.0", () => {
    const c = montarCorpoCompra(COMPRA, "CTESTE123") as any;
    expect(c.event_source).toBe("web");
    expect(c.event_source_id).toBe("CTESTE123");
    const e = c.data[0];
    expect(e.event).toBe("Purchase");
    expect(e.event_id).toBe("pay_abc123");
    expect(e.event_time).toBe(1_700_000_000);
    expect(e.properties).toMatchObject({ currency: "BRL", value: 197, order_id: "pay_abc123" });
    expect(e.properties.contents[0]).toMatchObject({ content_id: "programa:7", price: 197, quantity: 1 });
    expect(e.page.url).toContain("shadiahasan.com");
  });

  it("e-mail, telefone e id vão com SHA-256; ttclid, _ttp, IP e user-agent vão sem hash", () => {
    const u = (montarCorpoCompra(COMPRA, "C") as any).data[0].user;
    expect(u.email).toBe(_internals.sha256("maria@exemplo.com"));
    expect(u.phone).toBe(_internals.sha256("+5511999998888"));
    expect(u.external_id).toBe(_internals.sha256("42"));
    expect(u.ttclid).toBe("E.C.P.abc123");
    expect(u.ttp).toBe("ttp-xyz_1");
    expect(u.ip).toBe("203.0.113.9");
    expect(u.user_agent).toBe("UA-do-comprador");
    expect(JSON.stringify(u)).not.toContain("maria@exemplo");
  });

  it("ttclid com caracteres estranhos é descartado em vez de enviado", () => {
    expect(identificadorValido("abc def")).toBe(false);
    expect(identificadorValido("<script>")).toBe(false);
    expect(identificadorValido("E.C.P.abc-123_x~")).toBe(true);
    const u = (montarCorpoCompra({ ...COMPRA, atribuicao: { ttclid: "x y", ttp: "a;b" } }, "C") as any).data[0].user;
    expect(u.ttclid).toBeUndefined();
    expect(u.ttp).toBeUndefined();
  });

  it("test_event_code só aparece quando configurado (evento de teste não conta como conversão)", () => {
    expect((montarCorpoCompra(COMPRA, "C") as any).test_event_code).toBeUndefined();
    process.env.TIKTOK_EVENTS_TEST_CODE = "TEST123";
    expect((montarCorpoCompra(COMPRA, "C") as any).test_event_code).toBe("TEST123");
  });
});

describe("envio", () => {
  it("manda para o endpoint oficial com o token no cabeçalho, nunca no corpo ou na URL", async () => {
    const { impl, chamadas } = fetchFalso({ body: JSON.stringify({ code: 0, message: "OK" }) });
    const r = await enviarCompraTikTok(COMPRA, impl);
    expect(r.ok).toBe(true);
    expect(chamadas[0].url).toBe(TIKTOK_EVENTS_URL);
    expect(chamadas[0].headers["Access-Token"]).toBe("token-secreto-de-teste");
    expect(JSON.stringify(chamadas[0].corpo)).not.toContain("token-secreto-de-teste");
    expect(chamadas[0].url).not.toContain("token-secreto-de-teste");
  });

  it("recusa com HTTP 200 e code != 0 conta como falha, e o token não vaza na mensagem", async () => {
    const { impl } = fetchFalso({ body: JSON.stringify({ code: 40001, message: "Access-Token token-secreto-de-teste sem permissão" }) });
    const r = await enviarCompraTikTok(COMPRA, impl);
    expect(r.ok).toBe(false);
    expect(r.codigo).toBe(40001);
    expect(r.erro).not.toContain("token-secreto-de-teste");
  });

  it("falha de rede não lança", async () => {
    const r = await enviarCompraTikTok(COMPRA, (async () => { throw new Error("rede caiu"); }) as any);
    expect(r).toMatchObject({ ok: false, erro: "rede caiu" });
  });

  it("sem configuração é no-op silencioso e sem chamada", async () => {
    delete process.env.TIKTOK_EVENTS_ACCESS_TOKEN;
    expect(tiktokEventsConfigurado()).toBe(false);
    const { impl, chamadas } = fetchFalso({ body: "{}" });
    expect((await enviarCompraTikTok(COMPRA, impl)).ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("valor zero ou negativo nunca vira Purchase", async () => {
    const { impl, chamadas } = fetchFalso({ body: JSON.stringify({ code: 0 }) });
    expect((await enviarCompraTikTok({ ...COMPRA, value: 0 }, impl)).ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });
});

/** Banco falso mínimo: uma tabela `tiktokPurchases` em memória, interpretada pelo texto do SQL. */
function bancoFalso() {
  const linhas = new Map<string, any>();
  const d = {
    async execute(q: any) {
      const texto = (q.queryChunks ?? []).map((c: any) => (typeof c === "string" ? c : c?.value?.join?.("") ?? "")).join("?");
      const params = (q.queryChunks ?? []).filter((c: any) => !(c && Array.isArray(c.value)) ).map((c: any) => c?.value ?? c);
      if (/CREATE TABLE/i.test(texto)) return { rows: [] };
      if (/INSERT INTO "tiktokPurchases"/i.test(texto)) {
        const [paymentId, origem, ttclid, ttp] = params;
        if (!linhas.has(paymentId)) linhas.set(paymentId, { paymentId, origem, ttclid, ttp, sentAt: null, claimedAt: null, attempts: 0 });
        return { rows: [] };
      }
      if (/UPDATE "tiktokPurchases"\s+SET "claimedAt" = now\(\), "attempts"/i.test(texto)) {
        const l = linhas.get(params[0]);
        if (!l || l.sentAt || l.claimedAt) return { rows: [] };
        l.claimedAt = Date.now(); l.attempts++;
        return { rows: [{ ...l, landingUrl: null, clientIp: null, clientUserAgent: null }] };
      }
      if (/SET "sentAt" = now\(\)/i.test(texto)) { const l = linhas.get(params[params.length - 1]); if (l) l.sentAt = Date.now(); return { rows: [] }; }
      if (/SET "claimedAt" = NULL/i.test(texto)) { const l = linhas.get(params[params.length - 1]); if (l) l.claimedAt = null; return { rows: [] }; }
      if (/SELECT "sentAt","claimedAt"/i.test(texto)) { const l = linhas.get(params[0]); return { rows: l ? [l] : [] }; }
      return { rows: [] };
    },
  };
  return { d, linhas };
}

const DADOS = { value: 197, contentId: "programa:7", contentName: "Black Friday", email: "a@b.com", externalId: "42" };

describe("consentimento e idempotência por cobrança", () => {
  it("sem consentimento nada é registrado e nada é enviado", async () => {
    const { d, linhas } = bancoFalso();
    expect(await registrarAtribuicaoTikTok(d, "pay_1", "trial", { ttclid: "abc", tiktokConsent: false })).toBe(false);
    expect(await registrarAtribuicaoTikTok(d, "pay_1", "trial", { ttclid: "abc" })).toBe(false);
    expect(linhas.size).toBe(0);
    const { impl, chamadas } = fetchFalso({ body: JSON.stringify({ code: 0 }) });
    expect(await enviarCompraConfirmadaTikTok(d, "pay_1", DADOS, impl)).toBe("sem_consentimento");
    expect(chamadas).toHaveLength(0);
  });

  it("PAYMENT_CONFIRMED e PAYMENT_RECEIVED da mesma cobrança geram um único Purchase", async () => {
    const { d } = bancoFalso();
    await registrarAtribuicaoTikTok(d, "pay_2", "programa", { ttclid: "E.C.P.1", ttp: "ttp1", tiktokConsent: true });
    const { impl, chamadas } = fetchFalso({ body: JSON.stringify({ code: 0 }) });
    expect(await enviarCompraConfirmadaTikTok(d, "pay_2", DADOS, impl)).toBe("enviado");
    expect(await enviarCompraConfirmadaTikTok(d, "pay_2", DADOS, impl)).toBe("ja_enviado");
    expect(await enviarCompraConfirmadaTikTok(d, "pay_2", DADOS, impl)).toBe("ja_enviado");
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].corpo.data[0].event_id).toBe("pay_2");
  });

  it("duas execuções simultâneas da mesma cobrança enviam uma vez só", async () => {
    const { d } = bancoFalso();
    await registrarAtribuicaoTikTok(d, "pay_3", "trial", { ttclid: "E.C.P.1", tiktokConsent: true });
    const { impl, chamadas } = fetchFalso({ body: JSON.stringify({ code: 0 }) });
    const r = await Promise.all([enviarCompraConfirmadaTikTok(d, "pay_3", DADOS, impl), enviarCompraConfirmadaTikTok(d, "pay_3", DADOS, impl)]);
    expect(r.sort()).toEqual(["em_andamento", "enviado"]);
    expect(chamadas).toHaveLength(1);
  });

  it("recusa do TikTok libera a reserva e a próxima tentativa reenvia", async () => {
    const { d } = bancoFalso();
    await registrarAtribuicaoTikTok(d, "pay_4", "trial", { ttclid: "E.C.P.1", tiktokConsent: true });
    const ruim = fetchFalso({ body: JSON.stringify({ code: 40001, message: "sem permissão" }) });
    expect(await enviarCompraConfirmadaTikTok(d, "pay_4", DADOS, ruim.impl)).toBe("recusado");
    const bom = fetchFalso({ body: JSON.stringify({ code: 0 }) });
    expect(await enviarCompraConfirmadaTikTok(d, "pay_4", DADOS, bom.impl)).toBe("enviado");
    expect(bom.chamadas).toHaveLength(1);
  });

  it("sem configuração não envia nem mexe no banco", async () => {
    delete process.env.TIKTOK_PIXEL_ID;
    const { d } = bancoFalso();
    const { impl, chamadas } = fetchFalso({ body: "{}" });
    expect(await enviarCompraConfirmadaTikTok(d, "pay_5", DADOS, impl)).toBe("nao_configurado");
    expect(chamadas).toHaveLength(0);
  });
});

describe("código-fonte: o navegador nunca dispara Purchase no TikTok", () => {
  const raiz = resolve(import.meta.dirname, "..");
  const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");
  it("nenhum arquivo do cliente chama ttq.track com Purchase ou CompletePayment", () => {
    for (const f of ["client/src/lib/tiktokPixel.ts", "client/src/components/Analytics.tsx", "client/index.html"]) {
      const t = ler(f);
      expect(t, f).not.toMatch(/track\(\s*["'](Purchase|CompletePayment)["']/);
    }
  });
  it("o head só inicia o Pixel com consentimento e variável de ambiente", () => {
    const h = ler("client/index.html");
    expect(h).toContain("%VITE_TIKTOK_PIXEL_ID%");
    expect(h.indexOf("analytics.tiktok.com")).toBeLessThan(h.indexOf('src="/src/main.tsx"'));
    expect(h).toMatch(/consent\.analytics !== true/);
  });
  it("Meta e GA4 continuam intactos no Analytics.tsx", () => {
    const a = ler("client/src/components/Analytics.tsx");
    for (const trecho of ['sendMeta("track", "ViewContent"', 'sendMeta(\n    "track",\n    "InitiateCheckout"', 'sendGA4("event", "view_item"', 'sendGA4("event", "begin_checkout"', "loadMetaPixel(META_PIXEL_ID)", "loadGA4(GA4_ID)", 'sendGA4("event", "purchase"']) {
      expect(a, trecho).toContain(trecho.replace(/sendMeta\("track", "ViewContent"/, 'sendMeta("track", "ViewContent"'));
    }
  });
});
