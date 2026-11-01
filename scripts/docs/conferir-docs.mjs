#!/usr/bin/env node
/**
 * Guarda de documentação: avisa quando há código mudado desde a última atualização
 * de docs/memoria-do-sistema/memory_system.md.
 *
 *   node scripts/docs/conferir-docs.mjs                 avisa (sempre sai com 0)
 *   node scripts/docs/conferir-docs.mjs --strict        sai com 1 se houver pendência
 *   node scripts/docs/conferir-docs.mjs --base <ref>    compara a partir de outro commit
 *   (ou DOCS_BASE=<ref>)
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { commitIsento, ehCodigo } from "./lib.mjs";

const DOC = "docs/memoria-do-sistema/memory_system.md";
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const strict = process.argv.includes("--strict");
const iBase = process.argv.indexOf("--base");
let base = (iBase >= 0 ? process.argv[iBase + 1] : process.env.DOCS_BASE) || "";

if (!base) base = git("log", "-1", "--format=%H", "--", DOC);
if (!base) {
  console.log("Não achei nenhum commit que tenha tocado em " + DOC + ". Nada a comparar.");
  process.exit(0);
}

const linhas = git("log", "--no-merges", "--format=%H%x09%h%x09%an%x09%s", `${base}..HEAD`).split("\n").filter(Boolean);
const pendentes = [];
for (const linha of linhas) {
  const [hash, curto, , ...resto] = linha.split("\t");
  const assunto = resto.join("\t");
  if (commitIsento(assunto)) continue;
  const arquivos = git("show", "--no-renames", "--name-only", "--format=", hash).split("\n").filter(Boolean);
  const codigo = arquivos.filter(ehCodigo);
  if (codigo.length === 0) continue;
  pendentes.push({ curto, assunto, codigo });
}

const dataBase = git("log", "-1", "--format=%cs", base);
const saida = [];
if (pendentes.length === 0) {
  saida.push(`Documentação em dia: nenhum commit de código depois da última atualização de \`${DOC}\` (${dataBase}).`);
} else {
  saida.push(`### Documentação possivelmente desatualizada`);
  saida.push("");
  saida.push(`Desde a última atualização de \`${DOC}\` (${dataBase}) há ${pendentes.length} commit(s) que mexem em código sem que a documentação tenha sido tocada depois deles:`);
  saida.push("");
  for (const p of pendentes) {
    const lista = p.codigo.slice(0, 3).map((a) => `\`${a}\``).join(", ");
    saida.push(`- \`${p.curto}\` ${p.assunto} (${lista}${p.codigo.length > 3 ? ` e mais ${p.codigo.length - 3}` : ""})`);
  }
  saida.push("");
  saida.push(`Registre o que mudou (o quê, por quê, como reverter) em \`${DOC}\` e rode \`pnpm docs:referencia\`. Se a mudança não pede registro (ajuste visual, correção pontual), ignore: o aviso não bloqueia nada.`);
}
const texto = saida.join("\n");
console.log(texto);

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, texto + "\n");
if (process.env.GITHUB_ACTIONS && pendentes.length) {
  console.log(`::warning title=Documentação possivelmente desatualizada::${pendentes.length} commit(s) de código sem atualização de ${DOC}`);
}
process.exit(strict && pendentes.length ? 1 : 0);
