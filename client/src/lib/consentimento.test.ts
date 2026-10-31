import { describe, it, expect } from "vitest";
import { TEXTO_CONSENTIMENTO as cliente } from "./consentimento";
import { TEXTO_CONSENTIMENTO as servidor } from "../../../server/marketing";

describe("texto de autorização", () => {
  it("o que a pessoa lê no formulário é o mesmo que o servidor registra", () => {
    expect(cliente).toBe(servidor);
  });
  it("não vem pré-marcado nem promete o que não existe", () => {
    expect(cliente).not.toMatch(/gratuit|grátis|gratis/i);
    expect(cliente).toMatch(/cancelar/i);
  });
});
