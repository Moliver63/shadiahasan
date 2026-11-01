#!/usr/bin/env node
/**
 * Gera docs/memoria-do-sistema/REFERENCIA_GERADA.md a partir do código.
 *   node scripts/docs/gerar-referencia.mjs           grava o arquivo
 *   node scripts/docs/gerar-referencia.mjs --check   não grava; sai com 1 se estiver desatualizado
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  contarTestes, ehCodigo, extrairEnvs, extrairRotasCliente, extrairRotasExpress, extrairRoutersTrpc,
  extrairTabelas, montarReferencia, nomesDoEnvExemplo,
} from "./lib.mjs";

const raiz = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const SAIDA = join(raiz, "docs", "memoria-do-sistema", "REFERENCIA_GERADA.md");

function arquivos(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === "dist" || nome.startsWith(".")) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, acc);
    else if (/\.(ts|tsx|mjs)$/.test(nome)) acc.push(caminho);
  }
  return acc;
}
const rel = (c) => relative(raiz, c).split(sep).join("/");
const ler = (c) => readFileSync(c, "utf8");

const todos = ["server", "client/src", "shared", "drizzle"].flatMap((d) => arquivos(join(raiz, d))).sort();

const envs = new Map();
const tabelas = new Map();
const rotasExpress = [];
let arquivosDeTeste = 0;
let casosDeTeste = 0;

for (const c of todos) {
  const r = rel(c);
  const texto = ler(c);
  if (/\.(test|spec)\.(ts|tsx|mjs)$/.test(r)) {
    arquivosDeTeste++;
    casosDeTeste += contarTestes(texto);
    continue; // variáveis e tabelas de arquivos de teste não contam
  }
  if (!ehCodigo(r)) continue;
  for (const nome of extrairEnvs(texto)) {
    if (!envs.has(nome)) envs.set(nome, new Set());
    envs.get(nome).add(r);
  }
  for (const nome of extrairTabelas(texto)) if (!tabelas.has(nome)) tabelas.set(nome, r);
  if (/^server\/(routes|auth)\//.test(r)) {
    for (const rota of extrairRotasExpress(texto)) rotasExpress.push({ ...rota, arquivo: r });
  }
}

const exemploPath = join(raiz, ".env.example");
const envExemplo = existsSync(exemploPath) ? nomesDoEnvExemplo(ler(exemploPath)) : new Set();
const rotasCliente = extrairRotasCliente(ler(join(raiz, "client/src/App.tsx")));
const routersTrpc = extrairRoutersTrpc(ler(join(raiz, "server/routers.ts")));

const md = montarReferencia({ envs, envExemplo, tabelas, routersTrpc, rotasExpress, rotasCliente, arquivosDeTeste, casosDeTeste });

if (process.argv.includes("--check")) {
  const atual = existsSync(SAIDA) ? ler(SAIDA) : "";
  if (atual !== md) {
    console.error("REFERENCIA_GERADA.md está desatualizada. Rode: node scripts/docs/gerar-referencia.mjs");
    process.exit(1);
  }
  console.log("REFERENCIA_GERADA.md está em dia.");
} else {
  writeFileSync(SAIDA, md);
  console.log(`Referência gerada: ${envs.size} variáveis, ${tabelas.size} tabelas, ${routersTrpc.length} routers, ${rotasExpress.length} rotas HTTP, ${rotasCliente.length} telas, ${casosDeTeste} casos de teste.`);
}
