import { describe, it, expect } from "vitest";
import { urlCanonica, montarSitemap, montarRobots, escaparXml, PAGINAS_FIXAS, CAMINHOS_BLOQUEADOS } from "./_core/seo";

describe("urlCanonica", () => {
  it("usa shadiahasan.com por padrão e respeita CANONICAL_HOST", () => {
    expect(urlCanonica({} as any)).toBe("https://shadiahasan.com");
    expect(urlCanonica({ CANONICAL_HOST: "Outro.com.br " } as any)).toBe("https://outro.com.br");
  });
  it("nunca devolve o domínio antigo", () => {
    expect(urlCanonica({} as any)).not.toContain(".club");
  });
});

describe("montarSitemap", () => {
  const base = "https://shadiahasan.com";
  it("gera loc absoluto, data e prioridade com ponto decimal", () => {
    const xml = montarSitemap(base, [
      { path: "/", priority: 1, changefreq: "weekly" },
      { path: "/courses/curso-1", lastmod: new Date("2026-10-30T12:00:00Z"), priority: 0.8 },
    ]);
    expect(xml).toContain("<loc>https://shadiahasan.com/</loc>");
    expect(xml).toContain("<loc>https://shadiahasan.com/courses/curso-1</loc>");
    expect(xml).toContain("<lastmod>2026-10-30</lastmod>");
    expect(xml).toContain("<priority>0.8</priority>");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });
  it("escapa caracteres especiais e ignora duplicados e datas inválidas", () => {
    const xml = montarSitemap(base, [
      { path: "/a?x=1&y=2" },
      { path: "/a?x=1&y=2" },
      { path: "/b", lastmod: "não é data" },
    ]);
    expect(xml.match(/<url>/g)?.length).toBe(2);
    expect(xml).toContain("/a?x=1&amp;y=2");
    expect(xml).not.toContain("<lastmod>");
  });
  it("as páginas fixas não incluem telas de login/cadastro nem área logada", () => {
    const caminhos = PAGINAS_FIXAS.map((p) => p.path);
    expect(caminhos).toContain("/courses");
    expect(caminhos).toContain("/pricing");
    for (const c of caminhos) {
      expect(CAMINHOS_BLOQUEADOS.some((b) => c.startsWith(b))).toBe(false);
    }
  });
});

describe("montarRobots", () => {
  it("aponta o sitemap para o domínio canônico e bloqueia áreas privadas", () => {
    const txt = montarRobots("https://shadiahasan.com");
    expect(txt).toContain("Sitemap: https://shadiahasan.com/sitemap.xml");
    expect(txt).toContain("Allow: /\n");
    for (const c of ["/admin", "/api/", "/lesson/", "/minha-area", "/checkout/"]) expect(txt).toContain(`Disallow: ${c}`);
    expect(txt).not.toContain(".club");
  });
});

describe("escaparXml", () => {
  it("troca os cinco caracteres reservados", () => {
    expect(escaparXml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;");
  });
});
