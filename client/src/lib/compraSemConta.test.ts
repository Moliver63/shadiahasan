import { describe, expect, it } from "vitest";
import { lerCompra } from "./compraSemConta";

describe("token da compra sem conta", () => {
  it("lê do fragmento da URL (#t=), que não vai para o servidor", () => {
    const t = "a".repeat(43);
    expect(lerCompra(`#t=${t}`)).toBe(t);
  });
  it("ignora fragmento inválido e não quebra sem armazenamento", () => {
    expect(lerCompra("#t=curto")).toBeNull();
    expect(lerCompra("#experimente-uma-aula")).toBeNull();
  });
});
