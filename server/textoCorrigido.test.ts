import { describe, expect, it } from "vitest";
import { consertarAcentos, consertarPlano, temAcentoQuebrado } from "../shared/acentos";

describe("acentos quebrados", () => {
  it("conserta o que veio do banco", () => {
    expect(consertarAcentos("BÃ¡sico")).toBe("Básico");
    expect(consertarAcentos("Mais recursos para sua transformaÃ§Ã£o pessoal")).toBe("Mais recursos para sua transformação pessoal");
    expect(consertarAcentos("AtenÃ§Ã£o individual dedicada para vocÃª")).toBe("Atenção individual dedicada para você");
    expect(consertarAcentos('["AtÃ© 3 cursos simultÃ¢neos","Acesso Ã\u00a0 comunidade"]')).toBe('["Até 3 cursos simultâneos","Acesso à comunidade"]');
  });
  it("não mexe em texto correto, inclusive maiúsculas", () => {
    for (const t of ["Básico", "O PODER DA COMUNICAÇÃO ", "INTRODUÇÃO 1", "Sessão individual", "", "VIP"]) {
      expect(temAcentoQuebrado(t)).toBe(false);
      expect(consertarAcentos(t)).toBe(t);
    }
    expect(consertarAcentos(null)).toBeNull();
  });
  it("plano inteiro", () => {
    expect(consertarPlano({ id: 2, name: "BÃ¡sico", description: null, features: "[\"ExperiÃªncia VR\"]" })).toEqual({ id: 2, name: "Básico", description: null, features: "[\"Experiência VR\"]" });
  });
});
