import { describe, expect, it } from "vitest";
import { chaveDoEmail } from "./emailConta";
import { destinoSeguro } from "./linkDeAcesso";

describe("mesma caixa de entrada = mesma conta", () => {
  it("Gmail ignora pontos, +etiqueta e googlemail", () => {
    expect(chaveDoEmail("Maria.Silva@Gmail.com")).toBe("mariasilva@gmail.com");
    expect(chaveDoEmail("maria.silva+aula@googlemail.com")).toBe("mariasilva@gmail.com");
    expect(chaveDoEmail(" mariasilva@gmail.com ")).toBe("mariasilva@gmail.com");
  });
  it("outros provedores: só maiúscula/espaço (ponto conta como letra)", () => {
    expect(chaveDoEmail("Maria.Silva@Outlook.com")).toBe("maria.silva@outlook.com");
    expect(chaveDoEmail("maria.silva@empresa.com.br")).not.toBe(chaveDoEmail("mariasilva@empresa.com.br"));
  });
});

describe("destino depois do link de acesso", () => {
  it("só caminhos do próprio site", () => {
    expect(destinoSeguro("/lesson/3")).toBe("/lesson/3");
    expect(destinoSeguro("https://evil.com")).toBe("/my-courses");
    expect(destinoSeguro("//evil.com")).toBe("/my-courses");
    expect(destinoSeguro("/\\evil.com")).toBe("/my-courses");
    expect(destinoSeguro(undefined)).toBe("/my-courses");
  });
});
