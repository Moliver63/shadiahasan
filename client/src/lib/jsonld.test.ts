import { describe, it, expect } from "vitest";
import { organizacaoSchema, siteSchema, cursoSchema, faqSchema, textoLimpo, jsonLdSeguro } from "./jsonld";
import { SITE_URL, urlAbsoluta } from "./site";

describe("site", () => {
  it("o domínio é o canônico e urlAbsoluta tira query e âncora", () => {
    expect(SITE_URL).toBe("https://shadiahasan.com");
    expect(urlAbsoluta("/courses/x?utm=1#topo")).toBe("https://shadiahasan.com/courses/x");
    expect(urlAbsoluta("/")).toBe("https://shadiahasan.com/");
    expect(urlAbsoluta("faq")).toBe("https://shadiahasan.com/faq");
  });
});

describe("schemas", () => {
  it("organização e site apontam para o domínio canônico", () => {
    const txt = JSON.stringify([organizacaoSchema(), siteSchema()]);
    expect(txt).toContain("https://shadiahasan.com");
    expect(txt).not.toContain(".club");
  });
  it("curso exige nome e descrição, limpa HTML e codifica o slug", () => {
    expect(cursoSchema({ title: "X", slug: "x", description: "" })).toBeNull();
    const c: any = cursoSchema({ title: "Curso A", slug: "curso a", description: "<p>Olá   <b>mundo</b></p>", thumbnail: "https://cdn/x.jpg" });
    expect(c["@type"]).toBe("Course");
    expect(c.description).toBe("Olá mundo");
    expect(c.url).toBe("https://shadiahasan.com/courses/curso%20a");
    expect(c.image).toBe("https://cdn/x.jpg");
    expect(cursoSchema({ title: "A", slug: "a", description: "d", thumbnail: "javascript:x" })).not.toHaveProperty("image");
  });
  it("FAQ ignora itens vazios e devolve null sem itens", () => {
    expect(faqSchema([])).toBeNull();
    expect(faqSchema([{ q: " ", a: "x" }])).toBeNull();
    const f: any = faqSchema([{ q: "Pergunta?", a: "Resposta." }, { q: "", a: "x" }]);
    expect(f.mainEntity).toHaveLength(1);
    expect(f.mainEntity[0].acceptedAnswer.text).toBe("Resposta.");
  });
  it("textoLimpo corta com reticências", () => {
    const t = textoLimpo("a".repeat(500), 50);
    expect(t.length).toBe(50);
    expect(t.endsWith("…")).toBe(true);
  });
  it("jsonLdSeguro impede fechar o script", () => {
    expect(jsonLdSeguro({ a: "</script><script>alert(1)" })).not.toContain("</script>");
  });
});

describe("index.html", () => {
  it("o JSON-LD estático da home bate com organizacaoSchema e siteSchema", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const html = readFileSync(fileURLToPath(new URL("../../index.html", import.meta.url)), "utf8");
    const m = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
    expect(m).not.toBeNull();
    const grafo = JSON.parse(m![1])["@graph"];
    const { "@context": _a, ...org } = organizacaoSchema() as any;
    const { "@context": _b, ...site } = siteSchema() as any;
    expect(grafo).toEqual([org, site]);
  });
});
