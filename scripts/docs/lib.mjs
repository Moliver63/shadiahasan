/**
 * Funções puras do mecanismo de documentação (testadas em server/docsMecanismo.test.ts).
 * Sem dependências: roda no GitHub Actions e na máquina de quem desenvolve.
 */

/** Arquivo que muda o comportamento do sistema (e portanto pede registro na documentação). */
export function ehCodigo(caminho) {
  const c = String(caminho).replace(/\\/g, "/");
  if (!/^(server|client\/src|shared|drizzle)\//.test(c)) return false;
  if (/\.(test|spec)\.(ts|tsx|mjs)$/.test(c)) return false;
  if (/\.(md|txt|png|jpg|jpeg|svg|webp|ico|woff2?|ttf|json)$/.test(c)) return false;
  return true;
}

export function ehDoc(caminho) {
  return String(caminho).replace(/\\/g, "/").startsWith("docs/");
}

/** Tipos de commit que não mudam comportamento. */
export function commitIsento(assunto) {
  return /^(chore|test|style|ci|build|docs)(\(.+\))?!?:/i.test(String(assunto).trim());
}

/** Nomes de variáveis de ambiente lidas no código. Nunca valores. */
export function extrairEnvs(texto) {
  const nomes = new Set();
  for (const m of texto.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) nomes.add(m[1]);
  for (const m of texto.matchAll(/process\.env\[\s*["']([A-Z][A-Z0-9_]+)["']\s*\]/g)) nomes.add(m[1]);
  for (const m of texto.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)) nomes.add(m[1]);
  return nomes;
}

/** Variáveis declaradas num .env de exemplo (só os nomes). */
export function nomesDoEnvExemplo(texto) {
  const nomes = new Set();
  for (const linha of texto.split("\n")) {
    const m = /^\s*#?\s*([A-Z][A-Z0-9_]+)=/.exec(linha);
    if (m) nomes.add(m[1]);
  }
  return nomes;
}

/** Tabelas criadas em tempo de execução (CREATE TABLE IF NOT EXISTS). */
export function extrairTabelas(texto) {
  const nomes = new Set();
  for (const m of texto.matchAll(/CREATE TABLE IF NOT EXISTS\s+"?([A-Za-z0-9_]+)"?/g)) nomes.add(m[1]);
  return nomes;
}

/** Rotas de tela: `<Route path={"/x"} component={X} />` e `<ProtectedRoute ... requireAdmin />`. */
export function extrairRotasCliente(texto) {
  const rotas = [];
  for (const m of texto.matchAll(/<(Protected)?Route\s+path=\{"([^"]+)"\}\s+component=\{(\w+)\}([^>]*?)\/?>/g)) {
    const acesso = /requireAdmin/.test(m[4]) ? "admin" : m[1] ? "logado" : "público";
    rotas.push({ caminho: m[2], componente: m[3], acesso });
  }
  return rotas;
}

/** Rotas Express declaradas com `router.get("/x", ...)` em server/routes e server/auth. */
export function extrairRotasExpress(texto) {
  const rotas = [];
  for (const m of texto.matchAll(/\brouter\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g)) {
    rotas.push({ metodo: m[1].toUpperCase(), caminho: m[2] });
  }
  return rotas;
}

/** Chaves do primeiro nível do appRouter (um router tRPC por chave). */
export function extrairRoutersTrpc(texto) {
  const inicio = texto.indexOf("export const appRouter = router({");
  if (inicio < 0) return [];
  const resto = texto.slice(inicio).split("\n");
  const corpo = [];
  for (let i = 1; i < resto.length; i++) {
    if (resto[i] === "});") break;
    corpo.push(resto[i]);
  }
  const chaves = [];
  for (const linha of corpo) {
    const m = /^ {2}(\w+):/.exec(linha);
    if (m) chaves.push(m[1]);
  }
  return chaves;
}

/** Casos de teste declarados (it/test no início da linha). */
export function contarTestes(texto) {
  return (texto.match(/^\s*(?:it|test)(?:\.each\([^)]*\))?\(/gm) ?? []).length;
}

const ordem = (a, b) => a.localeCompare(b, "pt-BR");

/** Monta o markdown. Determinístico: só muda quando o código muda (sem data nem hash). */
export function montarReferencia(d) {
  const L = [];
  L.push("# Referência gerada do sistema");
  L.push("");
  L.push("> GERADO AUTOMATICAMENTE por `scripts/docs/gerar-referencia.mjs` a cada push no `main`. **Não edite à mão**: a próxima execução apaga a edição.");
  L.push("> Lê só o código (nomes de variáveis, tabelas, rotas e testes), nunca valores. O contexto e as decisões estão em `memory_system.md`.");
  L.push("");

  L.push("## Variáveis de ambiente lidas no código");
  L.push("");
  L.push("| Variável | Arquivos que leem | Está no `.env.example` |");
  L.push("|---|---|---|");
  for (const [nome, arqs] of [...d.envs.entries()].sort((a, b) => ordem(a[0], b[0]))) {
    const exemplos = [...arqs].sort(ordem).slice(0, 2).map((a) => `\`${a}\``).join(", ");
    const extra = arqs.size > 2 ? ` e mais ${arqs.size - 2}` : "";
    L.push(`| \`${nome}\` | ${exemplos}${extra} | ${d.envExemplo.has(nome) ? "sim" : "**não**"} |`);
  }
  const faltando = [...d.envs.keys()].filter((n) => !d.envExemplo.has(n)).length;
  L.push("");
  L.push(`${d.envs.size} variáveis; ${faltando} sem entrada no \`.env.example\`. Variáveis do Render que não estão no código (ou o contrário) aparecem aqui como diferença a investigar.`);
  L.push("");

  L.push("## Tabelas criadas em tempo de execução");
  L.push("");
  L.push("Criadas por `CREATE TABLE IF NOT EXISTS` na primeira chamada (fora do `drizzle/schema.ts`). Ao subir uma coluna nova, ela entra por `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` no mesmo arquivo.");
  L.push("");
  L.push("| Tabela | Criada em |");
  L.push("|---|---|");
  for (const [nome, arq] of [...d.tabelas.entries()].sort((a, b) => ordem(a[0], b[0]))) L.push(`| \`${nome}\` | \`${arq}\` |`);
  L.push("");

  L.push("## Routers tRPC (`server/routers.ts`)");
  L.push("");
  L.push([...d.routersTrpc].sort(ordem).map((r) => `\`${r}\``).join(", ") || "(nenhum encontrado)");
  L.push("");

  L.push("## Rotas HTTP do servidor (Express)");
  L.push("");
  L.push("| Método | Caminho | Arquivo |");
  L.push("|---|---|---|");
  for (const r of [...d.rotasExpress].sort((a, b) => ordem(a.caminho + a.metodo, b.caminho + b.metodo))) L.push(`| ${r.metodo} | \`${r.caminho}\` | \`${r.arquivo}\` |`);
  L.push("");
  L.push("Os prefixos (`/api`, `/api/auth`) vêm de `server/_core/index.ts`.");
  L.push("");

  L.push("## Telas (`client/src/App.tsx`)");
  L.push("");
  L.push("| Caminho | Componente | Acesso |");
  L.push("|---|---|---|");
  for (const r of [...d.rotasCliente].sort((a, b) => ordem(a.caminho, b.caminho))) L.push(`| \`${r.caminho}\` | \`${r.componente}\` | ${r.acesso} |`);
  L.push("");

  L.push("## Testes");
  L.push("");
  L.push(`${d.arquivosDeTeste} arquivos de teste, ${d.casosDeTeste} casos declarados (\`it\`/\`test\`). Para o resultado real, rode \`pnpm test\`.`);
  L.push("");
  return L.join("\n");
}
