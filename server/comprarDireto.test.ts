import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { acharEntrada, slugTitulo } from "../client/src/lib/comprarDireto.ts";

const entradas = [
  { courseTitle: "Pensamentos Automáticos", lessonId: 40 },
  { courseTitle: "Jornada Permita-se SER LIVRE", lessonId: 7 },
];

test("slugTitulo tira acento e pontuação", () => {
  assert.equal(slugTitulo("Pensamentos Automáticos"), "pensamentos-automaticos");
  assert.equal(slugTitulo("Jornada Permita-se SER LIVRE"), "jornada-permita-se-ser-livre");
});

test("acharEntrada: acha a aula do curso pedido, ignora pedido ausente ou desconhecido", () => {
  assert.equal(acharEntrada(entradas, "?comprar=pensamentos-automaticos&fbclid=x")?.lessonId, 40);
  assert.equal(acharEntrada(entradas, "?comprar=jornada-permita-se-ser-livre")?.lessonId, 7);
  assert.equal(acharEntrada(entradas, ""), null);
  assert.equal(acharEntrada(entradas, "?comprar=outro-curso"), null);
});

const html = fs.readFileSync(path.resolve("server/assets/paginas/cursos.html"), "utf8");

test("página /cursos: botões de compra abrem o pagamento do curso; planos só rolam para a oferta", () => {
  assert.ok(html.includes('href="/?comprar=pensamentos-automaticos#experimente-uma-aula">Escolher minha aula'));
  assert.ok(html.includes("href=\"/?comprar='+slug(c.t)+'#experimente-uma-aula\""));
  assert.ok(html.includes('href="/#experimente-uma-aula">Assinar Premium'));
});

test("script de atribuição repassa fbclid/utm sem duplicar o ?", () => {
  const code = html.match(/<script>\s*\/\* Anuncio[\s\S]*?<\/script>/)![0].replace(/<\/?script>/g, "");
  const link = (h: string) => ({ h, getAttribute() { return this.h; }, setAttribute(_k: string, v: string) { this.h = v; } });
  const links = [link("/?comprar=pensamentos-automaticos#experimente-uma-aula"), link("/#experimente-uma-aula")];
  (globalThis as any).location = { search: "?fbclid=AbC&utm_campaign=819", origin: "https://shadiahasan.com" };
  (globalThis as any).document = { cookie: "", querySelectorAll: () => links };
  new Function(code)();
  assert.equal(links[0].h, "/?comprar=pensamentos-automaticos&fbclid=AbC&utm_campaign=819#experimente-uma-aula");
  assert.equal(links[1].h, "/?fbclid=AbC&utm_campaign=819#experimente-uma-aula");
});
