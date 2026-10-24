import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { capiConfigurado, enviarCompra, _internals } from "./metaCapi";

/**
 * Rastreamento de conversão do teste de 1 aula (24/10).
 *
 * Contexto real: a campanha 804 mostrava 253 impressões, 9 cliques, 0 visitas
 * e 0 compras. O pagamento acontece na fatura do Asaas, fora do site, então o
 * `Purchase` tem que sair do servidor quando o webhook confirma.
 *
 * Nenhum teste aqui toca a rede: o `fetch` entra por parâmetro.
 */

const AMBIENTE = { ...process.env };

beforeEach(() => {
  process.env.META_PIXEL_ID = "123456789";
  process.env.META_CAPI_ACCESS_TOKEN = "token-de-teste";
  delete process.env.META_CAPI_TEST_EVENT_CODE;
});

afterEach(() => {
  process.env = { ...AMBIENTE };
});

function fetchFalso(resposta: { ok: boolean; status: number; body: string }) {
  const chamadas: Array<{ url: string; corpo: any }> = [];
  const impl = (async (url: any, init: any) => {
    chamadas.push({ url: String(url), corpo: JSON.parse(String(init?.body ?? "{}")) });
    return {
      ok: resposta.ok,
      status: resposta.status,
      text: async () => resposta.body,
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, chamadas };
}

const COMPRA = {
  eventId: "pay_abc123",
  value: 19.9,
  contentIds: ["lesson:42"],
  contentName: "Aula de entrada",
  email: "  Aluno@Exemplo.COM  ",
  externalId: "7",
  atribuicao: {
    fbp: "fb.1.1700000000000.1234567890",
    fbc: "fb.1.1700000000000.AbCdEf",
    clientIpAddress: "203.0.113.9",
    clientUserAgent: "Mozilla/5.0",
    eventSourceUrl: "https://shadiahasan.com/?fbclid=AbCdEf",
  },
};

describe("Conversions API — configuração", () => {
  it("é no-op quando falta variável, sem lançar", async () => {
    delete process.env.META_CAPI_ACCESS_TOKEN;
    expect(capiConfigurado()).toBe(false);

    const { impl, chamadas } = fetchFalso({ ok: true, status: 200, body: "{}" });
    const r = await enviarCompra(COMPRA, impl);
    expect(r.ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("reconhece a configuração completa", () => {
    expect(capiConfigurado()).toBe(true);
  });
});

describe("Conversions API — corpo do Purchase", () => {
  it("manda event_name, valor e produto no formato que a Meta espera", async () => {
    const { impl, chamadas } = fetchFalso({ ok: true, status: 200, body: '{"events_received":1}' });
    const r = await enviarCompra(COMPRA, impl, () => 1_700_000_000_000);

    expect(r.ok).toBe(true);
    expect(r.eventsReceived).toBe(1);
    expect(chamadas).toHaveLength(1);

    const evento = chamadas[0].corpo.data[0];
    expect(evento.event_name).toBe("Purchase");
    expect(evento.action_source).toBe("website");
    expect(evento.event_time).toBe(1_700_000_000);
    expect(evento.custom_data).toMatchObject({
      currency: "BRL",
      value: 19.9,
      content_ids: ["lesson:42"],
      content_type: "product",
    });
  });

  it("usa o id da cobrança como event_id, que é o que deduplica", async () => {
    // PAYMENT_CONFIRMED e PAYMENT_RECEIVED chegam os dois pra mesma cobrança.
    // Mesmo event_id = a Meta conta uma compra.
    const { impl, chamadas } = fetchFalso({ ok: true, status: 200, body: "{}" });
    await enviarCompra(COMPRA, impl);
    await enviarCompra(COMPRA, impl);
    expect(chamadas[0].corpo.data[0].event_id).toBe("pay_abc123");
    expect(chamadas[1].corpo.data[0].event_id).toBe("pay_abc123");
  });

  it("aplica hash em e-mail e external_id, e deixa fbp/fbc crus", async () => {
    const { impl, chamadas } = fetchFalso({ ok: true, status: 200, body: "{}" });
    await enviarCompra(COMPRA, impl);
    const ud = chamadas[0].corpo.data[0].user_data;

    // E-mail normalizado (minúsculo, sem espaço) antes do hash.
    expect(ud.em).toEqual([_internals.hash("aluno@exemplo.com")]);
    expect(ud.external_id).toEqual([_internals.hash("7")]);
    // Nada de e-mail em texto puro saindo daqui.
    expect(JSON.stringify(chamadas[0].corpo)).not.toContain("aluno@exemplo.com");
    expect(JSON.stringify(chamadas[0].corpo)).not.toContain("Aluno@Exemplo.COM");

    // Identificadores de clique vão sem hash, por especificação da Meta.
    expect(ud.fbp).toBe(COMPRA.atribuicao.fbp);
    expect(ud.fbc).toBe(COMPRA.atribuicao.fbc);
    expect(ud.client_ip_address).toBe("203.0.113.9");
  });

  it("manda o token no corpo, nunca na URL", async () => {
    // URL de requisição entra em log de proxy e de erro.
    const { impl, chamadas } = fetchFalso({ ok: true, status: 200, body: "{}" });
    await enviarCompra(COMPRA, impl);
    expect(chamadas[0].url).not.toContain("token-de-teste");
    expect(chamadas[0].url).toContain("/123456789/events");
    expect(chamadas[0].corpo.access_token).toBe("token-de-teste");
  });

  it("omite dado de correspondência que não existe, em vez de mandar vazio", async () => {
    const { impl, chamadas } = fetchFalso({ ok: true, status: 200, body: "{}" });
    await enviarCompra({ eventId: "p1", value: 19.9, contentIds: ["lesson:1"] }, impl);
    const ud = chamadas[0].corpo.data[0].user_data;
    expect(ud.em).toBeUndefined();
    expect(ud.fbp).toBeUndefined();
    expect(chamadas[0].corpo.data[0].event_source_url).toBeUndefined();
  });

  it("só inclui test_event_code quando a variável existe", async () => {
    const semCodigo = fetchFalso({ ok: true, status: 200, body: "{}" });
    await enviarCompra(COMPRA, semCodigo.impl);
    expect(semCodigo.chamadas[0].corpo.test_event_code).toBeUndefined();

    process.env.META_CAPI_TEST_EVENT_CODE = "TEST123";
    const comCodigo = fetchFalso({ ok: true, status: 200, body: "{}" });
    await enviarCompra(COMPRA, comCodigo.impl);
    expect(comCodigo.chamadas[0].corpo.test_event_code).toBe("TEST123");
  });
});

describe("Conversions API — falhas não derrubam a venda", () => {
  it("recusa da Meta volta como resultado, não como exceção", async () => {
    const { impl } = fetchFalso({ ok: false, status: 400, body: '{"error":{"message":"Invalid parameter"}}' });
    const r = await enviarCompra(COMPRA, impl);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
    expect(r.erro).toContain("Invalid parameter");
  });

  it("erro de rede volta como resultado, não como exceção", async () => {
    const impl = (async () => {
      throw new Error("fetch failed");
    }) as unknown as typeof fetch;
    const r = await enviarCompra(COMPRA, impl);
    expect(r.ok).toBe(false);
    expect(r.erro).toBe("fetch failed");
  });

  it("resposta sem JSON ainda conta como aceita se o status foi ok", async () => {
    const { impl } = fetchFalso({ ok: true, status: 200, body: "OK" });
    const r = await enviarCompra(COMPRA, impl);
    expect(r.ok).toBe(true);
    expect(r.eventsReceived).toBeUndefined();
  });
});

describe("Normalização de dados de correspondência", () => {
  it("e-mail inválido é descartado em vez de virar hash de lixo", () => {
    expect(_internals.normalizarEmail("sem-arroba")).toBeNull();
    expect(_internals.normalizarEmail(" X@Y.com ")).toBe("x@y.com");
  });

  it("telefone brasileiro recebe o código do país uma vez só", () => {
    expect(_internals.normalizarTelefone("(47) 99999-8888")).toBe("5547999998888");
    expect(_internals.normalizarTelefone("5547999998888")).toBe("5547999998888");
    expect(_internals.normalizarTelefone("123")).toBeNull();
  });
});
