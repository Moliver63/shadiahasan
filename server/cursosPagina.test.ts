import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const html = fs.readFileSync(path.resolve("server/assets/paginas/cursos.html"), "utf8");

test("página /cursos: toda imagem local citada existe em client/public", () => {
  const refs = Array.from(html.matchAll(/\/midia\/cursos\/[\w.-]+/g)).map((m) => m[0]);
  assert.ok(refs.length >= 7);
  for (const ref of new Set(refs)) assert.ok(fs.existsSync(path.resolve("client/public" + ref)), `falta ${ref}`);
});

test("página /cursos: oferta de R$ 19,90, sem link para o diário restrito", () => {
  assert.ok(html.includes("R$ 19,90"));
  assert.ok(!html.includes("/presentes/diario"));
  assert.ok(html.includes('href="/diario"'));
});

test("página /cursos: repassa fbclid e utm para a oferta e grava o _fbc", () => {
  assert.ok(html.includes("fbclid"));
  assert.ok(html.includes('a[href^="/#"]'));
  assert.ok(html.includes("_fbc=fb.1."));
});
