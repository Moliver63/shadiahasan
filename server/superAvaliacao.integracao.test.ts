/**
 * Super Avaliação contra um Postgres de verdade (Asaas, IA e e-mail simulados).
 *   TEST_DATABASE_URL=postgresql://postgres@localhost:5433/shadia_teste pnpm test superAvaliacao.integracao
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const URL_TESTE = process.env.TEST_DATABASE_URL;
const descrever = URL_TESTE ? describe : describe.skip;
if (URL_TESTE) {
  process.env.DATABASE_URL = URL_TESTE;
  process.env.ASAAS_API_KEY = "chave-falsa-de-teste";
  process.env.BUILT_IN_FORGE_API_KEY = "ia-falsa";
  delete process.env.RESEND_API_KEY;
}

const chamadas: Array<{ method: string; path: string; body?: any }> = [];
const cobrancas = new Map<string, any>();
let seq = 0;
vi.mock("./asaas", async (original) => {
  const real = await original<typeof import("./asaas")>();
  return {
    ...real,
    asaasRequest: vi.fn(async (method: string, path: string, body?: any) => {
      chamadas.push({ method, path, body });
      if (method === "POST" && path === "/customers") return { id: "cus_teste" };
      if (method === "POST" && path === "/payments") {
        const id = `pay_sa_${++seq}`;
        const p = { id, invoiceUrl: `https://sandbox.asaas.com/i/${id}`, ...body, status: "PENDING" };
        cobrancas.set(id, p);
        return p;
      }
      if (method === "GET" && path.endsWith("/pixQrCode")) return { encodedImage: "aW1n", payload: "000201pix" };
      if (method === "POST" && path.endsWith("/refund")) return { status: "REFUNDED" };
      if (method === "GET" && path.startsWith("/payments/")) return cobrancas.get(decodeURIComponent(path.split("/")[2]));
      throw new Error(`chamada inesperada ${method} ${path}`);
    }),
  };
});

const emails: Array<{ para: string; assunto: string; html: string }> = [];
vi.mock("./_core/email", async (original) => {
  const real = await original<typeof import("./_core/email")>();
  return { ...real, enviarEmail: vi.fn(async (p: any) => { emails.push(p); return { success: true }; }) };
});

let respostaIA: () => string = () => "";
const pedidosIA: any[] = [];
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async (p: any) => { pedidosIA.push(p); return { choices: [{ message: { content: respostaIA() } }] }; }),
}));

const DEVOLUTIVA = JSON.stringify({
  abertura: "Li o seu mapa com atenção.", padroes: [{ titulo: "Silêncio vira rejeição", texto: "Quando a colega ficou quieta, você concluiu \"minha ideia é ruim\"." }],
  forcas: ["Você mesma escreveu outra leitura."], perguntas: ["O que você ainda não sabe?"], passos: ["Peça um retorno específico."], fechamento: "Você já começou.", cuidado: "",
});
const MAPA = [
  { secao: "Mapa", pergunta: "Situação", resposta: "Comentei minha ideia na reunião e a colega ficou em silêncio total" },
  { secao: "Mapa", pergunta: "Pensamento", resposta: "Minha ideia é ruim e todo mundo percebeu" },
  { secao: "Mapa", pergunta: "Emoção", resposta: "Vergonha, 7 de 10" },
  { secao: "Mapa", pergunta: "Resposta", resposta: "Parei de falar e quis tirar a ideia da pauta" },
];
const dados = (extra: Record<string, unknown> = {}) => ({
  nome: "Maria Teste", email: "maria@exemplo.com", cpfCnpj: "52998224725", metodo: "pix" as const,
  origem: "amostra" as const, respostas: MAPA, origin: "https://shadiahasan.com", ...extra,
});

let sa: typeof import("./superAvaliacao");
let db: typeof import("./db");
const exec = async (q: any) => (((await (await db.getDb())!.execute(q)) as any).rows as any[]);

descrever("Super Avaliação (integração)", () => {
  beforeAll(async () => {
    db = await import("./db");
    sa = await import("./superAvaliacao");
    expect(await sa.garantirSchemaAvaliacao()).toBe(true);
  });
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await exec(sql`TRUNCATE "superAvaliacoes" RESTART IDENTITY`);
    chamadas.length = 0; emails.length = 0; pedidosIA.length = 0;
    respostaIA = () => DEVOLUTIVA;
  });

  it("está disponível com Asaas e IA configurados", async () => {
    expect((await sa.configAvaliacao()).disponivel).toBe(true);
  });

  it("recusa pedido sem respostas suficientes ou com CPF errado, sem cobrar", async () => {
    await expect(sa.criarSuperAvaliacao(dados({ respostas: MAPA.slice(0, 2) }))).rejects.toThrow(/Escreva um pouco mais/);
    await expect(sa.criarSuperAvaliacao(dados({ cpfCnpj: "11111111111" }))).rejects.toThrow(/CPF/);
    expect(chamadas.filter((c) => c.path === "/payments")).toHaveLength(0);
  });

  it("cobra R$ 15, e depois do pagamento a IA escreve, a página mostra e o e-mail sai", async () => {
    const r = await sa.criarSuperAvaliacao(dados());
    const pg = chamadas.find((c) => c.path === "/payments")!;
    expect(pg.body.value).toBe(15);
    expect(pg.body.externalReference).toMatch(/^avaliacao:\d+$/);
    expect(r.pix?.copiaECola).toBe("000201pix");
    expect((await sa.statusAvaliacao(r.token))!.status).toBe("aguardando_pagamento");

    cobrancas.get([...cobrancas.keys()].pop()!).status = "RECEIVED";
    await sa.processarAvaliacoesPendentes();
    const st = (await sa.statusAvaliacao(r.token))!;
    expect(st.status).toBe("pronta");
    expect(st.devolutiva?.padroes[0].titulo).toBe("Silêncio vira rejeição");
    expect(pedidosIA[0].messages[1].content).toContain("Minha ideia é ruim");
    expect(emails.some((e) => e.assunto.includes("pronta") && e.html.includes(`/avaliacao/${r.token}`))).toBe(true);

    // Pagamento repetido (webhook + conferência) não gera de novo
    await sa.processarEventoAvaliacao({ id: "ev2", event: "PAYMENT_CONFIRMED", payment: { ...cobrancas.get([...cobrancas.keys()].pop()!) } });
    expect(pedidosIA).toHaveLength(1);
  });

  it("com sinal de risco, a devolutiva abre com o CVV", async () => {
    const r = await sa.criarSuperAvaliacao(dados({ respostas: [...MAPA, { secao: "Mapa", pergunta: "Outra leitura", resposta: "Às vezes não quero mais viver" }] }));
    cobrancas.get([...cobrancas.keys()].pop()!).status = "CONFIRMED";
    await sa.processarAvaliacoesPendentes();
    expect((await sa.statusAvaliacao(r.token))!.devolutiva?.cuidado).toMatch(/188/);
  });

  it("se a IA falhar 6 vezes, estorna no Asaas e avisa a pessoa", async () => {
    respostaIA = () => "isto não é json";
    const r = await sa.criarSuperAvaliacao(dados());
    cobrancas.get([...cobrancas.keys()].pop()!).status = "RECEIVED";
    for (let i = 0; i < 6; i++) await sa.processarAvaliacoesPendentes();
    expect(chamadas.some((c) => c.method === "POST" && c.path.endsWith("/refund"))).toBe(true);
    expect((await sa.statusAvaliacao(r.token))!.status).toBe("estornada");
    expect(emails.some((e) => e.assunto.includes("Devolvemos"))).toBe(true);
  });

  it("estorno feito no Asaas cancela a avaliação", async () => {
    const r = await sa.criarSuperAvaliacao(dados());
    const p = cobrancas.get([...cobrancas.keys()].pop()!);
    await sa.processarEventoAvaliacao({ id: "ev-ref", event: "PAYMENT_REFUNDED", payment: p });
    expect((await sa.statusAvaliacao(r.token))!.status).toBe("estornada");
  });
});
