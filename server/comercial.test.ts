import { describe, expect, it } from "vitest";
import {
  formatarReais, lerRefPrograma, linhas, metodosAtivos, paragrafos, percentualDesconto, precoVendavel,
  reaisParaCentavos, refPrograma, validarPrecos,
} from "../shared/comercial";
import { TEXTOS_SUGERIDOS, textoSugeridoPara } from "../shared/catalogoSugerido";
import { vinculoDaCobrancaAsaas, lancamentoDoAsaas } from "./financeSync";
import { textoDaVenda } from "./avisoVenda";

describe("preços", () => {
  it("converte reais digitados para centavos", () => {
    expect(reaisParaCentavos("197,00")).toBe(19700);
    expect(reaisParaCentavos("R$ 1.234,56")).toBe(123456);
    expect(reaisParaCentavos("57")).toBe(5700);
    expect(reaisParaCentavos("57.9")).toBe(5790);
    expect(reaisParaCentavos("abc")).toBeNull();
    expect(reaisParaCentavos("")).toBeNull();
  });

  it("só aceita preço original maior que o de venda e preço na faixa", () => {
    expect(validarPrecos(19700, 59700)).toBeNull();
    expect(validarPrecos(19700, null)).toBeNull();
    expect(validarPrecos(null, null)).toBeNull();
    expect(validarPrecos(19700, 19700)).toMatch(/maior/);
    expect(validarPrecos(19700, 5700)).toMatch(/maior/);
    expect(validarPrecos(100, null)).toMatch(/entre/);
    expect(validarPrecos(19700.5, null)).toMatch(/entre/);
  });

  it("formata em reais e calcula o desconto", () => {
    expect(formatarReais(19700).replace(/\s/g, " ")).toBe("R$ 197,00");
    expect(percentualDesconto(19700, 59700)).toBe(67);
    expect(percentualDesconto(5700, 19700)).toBe(71);
    expect(percentualDesconto(5700, null)).toBeNull();
    expect(precoVendavel(5700)).toBe(true);
    expect(precoVendavel(null)).toBe(false);
  });
});

describe("referência e formas de pagamento", () => {
  it("monta e lê a referência da cobrança", () => {
    expect(refPrograma(12, 9)).toBe("programa:12:9");
    expect(lerRefPrograma("programa:12:9")).toEqual({ userId: 12, collectionId: 9 });
    expect(lerRefPrograma("trial:12:9")).toBeNull();
    expect(lerRefPrograma("programa:12:9:x")).toBeNull();
  });

  it("formas de pagamento: padrão Pix e cartão, ignora lixo", () => {
    expect(metodosAtivos(undefined)).toEqual({ pix: true, cartao: true, boleto: false });
    expect(metodosAtivos({ boleto: true, pix: "sim" })).toEqual({ pix: true, cartao: true, boleto: true });
  });

  it("quebra textos do admin em linhas e parágrafos", () => {
    expect(linhas("- um\n\n• dois\n três ")).toEqual(["um", "dois", "três"]);
    expect(paragrafos("a\nb\n\nc")).toEqual(["a b", "c"]);
  });
});

describe("textos sugeridos", () => {
  it("só sugere quando id e título batem", () => {
    expect(textoSugeridoPara(1, "Jornada Permita-se SER LIVRE")).not.toBeNull();
    expect(textoSugeridoPara(9, "Pensamentos Automáticos")).not.toBeNull();
    expect(textoSugeridoPara(1, "Outro programa")).toBeNull();
  });

  it("preços sugeridos são válidos e os textos evitam promessa de cura e travessão", () => {
    for (const t of Object.values(TEXTOS_SUGERIDOS)) {
      expect(validarPrecos(t.priceCents, t.originalPriceCents)).toBeNull();
      const tudo = [t.headline, t.salesDescription, t.forWhom, t.learnings, t.ctaText].join(" ");
      expect(tudo).not.toMatch(/—|cura garantida|garantimos|resultado garantido/i);
    }
  });
});

describe("financeiro e aviso de venda", () => {
  it("sincronização reconhece cobrança de programa", () => {
    const c = { id: "pay_1", externalReference: "programa:7:9", value: 57, status: "RECEIVED", description: "Programa Pensamentos Automáticos - Shadia Hasan", billingType: "PIX" } as any;
    const v = vinculoDaCobrancaAsaas(c, []);
    expect(v).toEqual({ userId: 7, planSlug: "programa", tipo: "programa" });
    expect(lancamentoDoAsaas(c, v!).description).toBe("Programa Pensamentos Automáticos (Asaas)");
  });

  it("push de venda diz que foi programa", () => {
    expect(textoDaVenda({ amount: 5700, planSlug: "programa", paymentMethod: "asaas:pix" }).corpo).toMatch(/^Programa \(compra avulsa\) · Pix/);
  });
});

import { presenteDoPrograma, urlDoPresente } from "../shared/presentes";
import fs from "node:fs";

describe("presente do programa", () => {
  it("Diário só para Pensamentos Automáticos, com o título conferido", () => {
    const p = presenteDoPrograma(9, "Pensamentos Automáticos");
    expect(p?.titulo).toBe("Diário da Transformação");
    expect(presenteDoPrograma(9, "Outro programa")).toBeNull();
    expect(presenteDoPrograma(1, "Jornada Permita-se SER LIVRE")).toBeNull();
    expect(urlDoPresente(9, p!)).toBe("/api/presentes/9/diario-da-transformacao.pdf");
    expect(fs.existsSync(`server/assets/presentes/${p!.arquivo}`)).toBe(true);
  });
});
