import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { atribuicaoAtual, capturarAtribuicaoNaEntrada, novoEventId } from "./metaAttribution";

/**
 * Captura de origem do visitante (24/10).
 *
 * O que está em jogo: o `Purchase` sai do servidor, depois do webhook do
 * Asaas. Se `_fbp`/`_fbc` e as UTMs não forem guardados na chegada, a Meta
 * recebe uma compra que não liga a campanha nenhuma, e o relatório da 804
 * continua em zero mesmo com tudo "funcionando".
 *
 * Sem jsdom: os poucos globais usados entram como dublê.
 */

type Dubles = { cookie: string; url: string };

const original = {
  document: (globalThis as any).document,
  window: (globalThis as any).window,
  sessionStorage: (globalThis as any).sessionStorage,
};

function montarAmbiente({ cookie, url }: Dubles) {
  const loja = new Map<string, string>();
  (globalThis as any).document = { cookie };
  (globalThis as any).window = { location: { search: new URL(url).search, href: url } };
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => loja.get(k) ?? null,
    setItem: (k: string, v: string) => void loja.set(k, v),
    removeItem: (k: string) => void loja.delete(k),
  };
  return loja;
}

beforeEach(() => {
  montarAmbiente({ cookie: "", url: "https://shadiahasan.com/" });
});

afterEach(() => {
  (globalThis as any).document = original.document;
  (globalThis as any).window = original.window;
  (globalThis as any).sessionStorage = original.sessionStorage;
});

describe("captura na entrada", () => {
  it("monta o _fbc a partir do fbclid, no formato da Meta", () => {
    montarAmbiente({ cookie: "", url: "https://shadiahasan.com/?fbclid=AbC123" });
    capturarAtribuicaoNaEntrada();
    const a = atribuicaoAtual();
    // fb.<subdomain index>.<timestamp>.<fbclid>
    expect(a.fbc).toMatch(/^fb\.1\.\d+\.AbC123$/);
  });

  it("guarda as UTMs, que a primeira navegação apagaria da URL", () => {
    montarAmbiente({
      cookie: "",
      url: "https://shadiahasan.com/?utm_source=facebook&utm_medium=cpc&utm_campaign=804&utm_content=card1",
    });
    capturarAtribuicaoNaEntrada();

    // Simula navegar para a aula: a URL já não tem parâmetro nenhum.
    (globalThis as any).window.location = { search: "", href: "https://shadiahasan.com/courses/1" };
    const a = atribuicaoAtual();
    expect(a.utmSource).toBe("facebook");
    expect(a.utmCampaign).toBe("804");
    expect(a.utmContent).toBe("card1");
  });

  it("navegação interna sem UTM não apaga a origem do primeiro clique", () => {
    montarAmbiente({ cookie: "", url: "https://shadiahasan.com/?utm_source=facebook&utm_campaign=804" });
    capturarAtribuicaoNaEntrada();
    (globalThis as any).window.location = { search: "", href: "https://shadiahasan.com/outra" };
    capturarAtribuicaoNaEntrada(); // chamada de novo, agora sem parâmetros
    expect(atribuicaoAtual().utmSource).toBe("facebook");
  });

  it("guarda a URL de entrada, que vira event_source_url no evento do servidor", () => {
    const url = "https://shadiahasan.com/?fbclid=X";
    montarAmbiente({ cookie: "", url });
    capturarAtribuicaoNaEntrada();
    expect(atribuicaoAtual().landingUrl).toBe(url);
  });
});

describe("leitura dos cookies do pixel", () => {
  it("lê o _fbp que o pixel escreveu", () => {
    montarAmbiente({ cookie: "_fbp=fb.1.1700000000000.99887766; outro=x", url: "https://shadiahasan.com/" });
    expect(atribuicaoAtual().fbp).toBe("fb.1.1700000000000.99887766");
  });

  it("o _fbc do cookie vence o que montamos do fbclid", () => {
    // O cookie é escrito pelo próprio pixel: é a versão canônica.
    montarAmbiente({ cookie: "_fbc=fb.1.111.DoCookie", url: "https://shadiahasan.com/?fbclid=DaUrl" });
    capturarAtribuicaoNaEntrada();
    expect(atribuicaoAtual().fbc).toBe("fb.1.111.DoCookie");
  });

  it("sem cookie nenhum devolve objeto vazio, sem lançar", () => {
    expect(() => atribuicaoAtual()).not.toThrow();
    expect(atribuicaoAtual().fbp).toBeUndefined();
  });

  it("storage bloqueado (navegação privada) não quebra a página", () => {
    (globalThis as any).sessionStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => capturarAtribuicaoNaEntrada()).not.toThrow();
    expect(() => atribuicaoAtual()).not.toThrow();
  });
});

describe("event id", () => {
  it("é único por chamada e carrega o prefixo", () => {
    const a = novoEventId("ic");
    const b = novoEventId("ic");
    expect(a).not.toBe(b);
    expect(a.startsWith("ic.")).toBe(true);
  });
});
