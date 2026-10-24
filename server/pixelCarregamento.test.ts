import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Auditoria de 24/10, campanha 804: 19 cliques no link, 1 visualizacao de
 * pagina de destino (5,26%). O pixel nao estava quebrado — estava chegando
 * tarde. Era injetado por um `useEffect`, entao so nascia depois de ~890 kB
 * comprimidos e do React montar, com 470 das 471 impressoes no navegador
 * interno do app do Facebook e 71% do publico acima de 55 anos.
 *
 * Teste de FONTE, nao de comportamento: o que protege estas correcoes e a
 * ORDEM das coisas no HTML e a configuracao do build, e as duas se leem em
 * arquivo. Build e navegador nao cabem aqui.
 */

const raiz = resolve(import.meta.dirname, "..");
const HTML = readFileSync(resolve(raiz, "client/index.html"), "utf8");
const VITE = readFileSync(resolve(raiz, "vite.config.ts"), "utf8");
const APP = readFileSync(resolve(raiz, "client/src/App.tsx"), "utf8");
const ANALYTICS = readFileSync(resolve(raiz, "client/src/components/Analytics.tsx"), "utf8");

describe("pixel no head", () => {
  it("existe no index.html e nao depende do React", () => {
    expect(HTML).toContain("connect.facebook.net/en_US/fbevents.js");
    expect(HTML).toMatch(/fbq\("init", id\)/);
  });

  it("dispara antes do script da aplicacao", () => {
    // Esta ordem E a correcao. Invertida, volta o problema.
    const pixel = HTML.indexOf("fbevents.js");
    const app = HTML.indexOf('src="/src/main.tsx"');
    expect(pixel).toBeGreaterThan(0);
    expect(app).toBeGreaterThan(0);
    expect(pixel).toBeLessThan(app);
  });

  it("usa a variavel de ambiente, sem ID fixo no codigo", () => {
    expect(HTML).toContain("%VITE_META_PIXEL_ID%");
    // Nenhuma sequencia de 10+ digitos solta perto do init: ID inventado
    // mediria a conta errada, que e pior que nao medir.
    const bloco = HTML.slice(HTML.indexOf("<script>"), HTML.indexOf("</script>"));
    expect(bloco).not.toMatch(/fbq\("init", ["']\d{8,}["']\)/);
  });

  it("nao inicializa quando a variavel nao foi definida no build", () => {
    // Sem a variavel, o Vite deixa o proprio marcador no lugar. A guarda
    // compara o primeiro caractere com "%".
    expect(HTML).toMatch(/id\.charAt\(0\) === "%"/);
    expect(HTML).toMatch(/if \(!id \|\| id\.charAt\(0\) === "%"\) return;/);
  });

  it("nao inicializa duas vezes", () => {
    // Guarda no HTML e guarda no componente: os dois caminhos checam fbq.
    expect(HTML).toMatch(/if \(window\.fbq\) return;/);
    expect(ANALYTICS).toMatch(/if \(window\.fbq\) return;/);
  });

  it("o PageView da primeira tela nao e contado duas vezes", () => {
    // O head dispara o PageView de entrada; o efeito de rota ignora a
    // primeira rota e cuida so das navegacoes seguintes.
    expect(HTML).toMatch(/fbq\("track", "PageView"\)/);
    expect(ANALYTICS).toMatch(/primeiraRota\.current/);
    const efeito = ANALYTICS.slice(ANALYTICS.indexOf("primeiraRota.current"));
    expect(efeito).toMatch(/return;/);
  });
});

describe("runtime da Manus fora do build", () => {
  it("o plugin so roda no servidor de desenvolvimento", () => {
    // O plugin injeta sempre (dev e build); `apply: "serve"` e o que o tira
    // do artefato publicado. Eram 367 kB de JS inline no index.html.
    expect(VITE).toMatch(/vitePluginManusRuntime\(\),\s*apply:\s*"serve"/);
  });

  it("o coletor de debug continua protegido por NODE_ENV", () => {
    expect(VITE).toMatch(/process\.env\.NODE_ENV === "production"/);
  });
});

describe("codigo dividido por rota", () => {
  it("as paginas sao carregadas sob demanda", () => {
    const lazies = APP.match(/lazy\(\(\) => import\("\.\/pages\//g) ?? [];
    // Eram 52 paginas importadas de uma vez, ~20 delas de admin.
    expect(lazies.length).toBeGreaterThanOrEqual(45);
  });

  it("a home fica no pedaco inicial, porque e o destino do anuncio", () => {
    expect(APP).toMatch(/^import Home from "\.\/pages\/Home";$/m);
    expect(APP).not.toMatch(/lazy\(\(\) => import\("\.\/pages\/Home"\)\)/);
  });

  it("o NotFound tambem, porque o fallback nao pode depender de download", () => {
    expect(APP).toMatch(/^import NotFound from "@\/pages\/NotFound";$/m);
  });

  it("existe um Suspense em volta das rotas", () => {
    // Sem ele, uma rota lazy derruba a arvore.
    const suspense = APP.indexOf("<Suspense");
    const sw = APP.indexOf("<Switch>");
    expect(suspense).toBeGreaterThan(0);
    expect(suspense).toBeLessThan(sw);
    expect(APP).toContain("</Suspense>");
  });

  it("a tela de espera nao introduz texto nem cor nova", () => {
    // "Nao altere a aparencia": fallback neutro, fundo do tema.
    const corpo = APP.slice(APP.indexOf("function RotaCarregando"), APP.indexOf("function Router"));
    expect(corpo).toContain("bg-background");

    // So o JSX devolvido, nao o nome da funcao: a primeira versao deste teste
    // casava com o identificador `RotaCarregando` e falhava sozinha.
    const jsx = corpo.slice(corpo.indexOf("return"), corpo.indexOf(";", corpo.indexOf("return")));
    expect(jsx).not.toMatch(/>[^<>]*\p{L}[^<>]*</u);
    expect(jsx).not.toMatch(/Carregando|Loading|aguarde/i);
  });
});
