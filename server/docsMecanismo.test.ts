import { describe, expect, it } from "vitest";
// @ts-expect-error módulo .mjs sem tipos (script de infraestrutura)
import * as lib from "../scripts/docs/lib.mjs";

describe("mecanismo de documentação", () => {
  it("só considera código de produção como código", () => {
    expect(lib.ehCodigo("server/marketing.ts")).toBe(true);
    expect(lib.ehCodigo("client/src/pages/Login.tsx")).toBe(true);
    expect(lib.ehCodigo("shared/autoavaliacao.ts")).toBe(true);
    expect(lib.ehCodigo("server/marketing.test.ts")).toBe(false);
    expect(lib.ehCodigo("docs/memoria-do-sistema/memory_system.md")).toBe(false);
    expect(lib.ehCodigo("client/src/assets/logo.svg")).toBe(false);
    expect(lib.ehCodigo("package.json")).toBe(false);
  });

  it("ignora commits que não mudam comportamento", () => {
    expect(lib.commitIsento("chore: atualiza dependências")).toBe(true);
    expect(lib.commitIsento("docs: ajusta README")).toBe(true);
    expect(lib.commitIsento("test(marketing): cobre sequência")).toBe(true);
    expect(lib.commitIsento("feat(marketing): nova página")).toBe(false);
    expect(lib.commitIsento("fix(login): contraste")).toBe(false);
  });

  it("extrai só nomes de variáveis de ambiente, nunca valores", () => {
    const texto = `
      const a = process.env.STRIPE_SECRET_KEY;
      const b = process.env["RESEND_API_KEY"];
      const c = import.meta.env.VITE_GA4_ID;
      const d = process.env.STRIPE_SECRET_KEY ?? "sk_live_valor_que_nao_pode_vazar";
    `;
    const nomes = [...lib.extrairEnvs(texto)].sort();
    expect(nomes).toEqual(["RESEND_API_KEY", "STRIPE_SECRET_KEY", "VITE_GA4_ID"]);
    expect(JSON.stringify(nomes)).not.toContain("sk_live");
  });

  it("lê os nomes do .env.example, inclusive os comentados", () => {
    const nomes = lib.nomesDoEnvExemplo("# cabeçalho\nDATABASE_URL=\n# FROM_EMAIL=x\nJWT_SECRET=abc\n");
    expect([...nomes].sort()).toEqual(["DATABASE_URL", "FROM_EMAIL", "JWT_SECRET"]);
  });

  it("extrai tabelas criadas em tempo de execução", () => {
    const sql = 'CREATE TABLE IF NOT EXISTS "marketingContatos" (id int); create table if not exists x; CREATE TABLE IF NOT EXISTS leads (id int)';
    expect([...lib.extrairTabelas(sql)].sort()).toEqual(["leads", "marketingContatos"]);
  });

  it("extrai telas e o tipo de acesso", () => {
    const jsx = `
      <Route path={"/faq"} component={FAQ} />
      <ProtectedRoute path={"/certificates"} component={MyCertificates} />
      <ProtectedRoute path={"/admin/campanhas"} component={AdminCampanhas} requireAdmin />
    `;
    expect(lib.extrairRotasCliente(jsx)).toEqual([
      { caminho: "/faq", componente: "FAQ", acesso: "público" },
      { caminho: "/certificates", componente: "MyCertificates", acesso: "logado" },
      { caminho: "/admin/campanhas", componente: "AdminCampanhas", acesso: "admin" },
    ]);
  });

  it("extrai rotas Express e routers tRPC", () => {
    expect(lib.extrairRotasExpress('router.get("/me", a); router.post(`/link`, b);')).toEqual([
      { metodo: "GET", caminho: "/me" },
      { metodo: "POST", caminho: "/link" },
    ]);
    const src = "export const appRouter = router({\n  system: systemRouter,\n  auth: router({\n    me: x,\n  }),\n  profile: profileRouter,\n});\n";
    expect(lib.extrairRoutersTrpc(src)).toEqual(["system", "auth", "profile"]);
  });

  it("conta casos de teste", () => {
    expect(lib.contarTestes('it("a", () => {});\n  test("b", () => {});\n// it("comentado")')).toBe(2);
  });

  it("a referência é determinística e não carrega data nem valores", () => {
    const d = {
      envs: new Map([["X_KEY", new Set(["server/a.ts"])]]),
      envExemplo: new Set(),
      tabelas: new Map([["leads", "server/routers.ts"]]),
      routersTrpc: ["auth"],
      rotasExpress: [{ metodo: "GET", caminho: "/me", arquivo: "server/auth/routes.ts" }],
      rotasCliente: [{ caminho: "/faq", componente: "FAQ", acesso: "público" }],
      arquivosDeTeste: 1,
      casosDeTeste: 3,
    };
    const a = lib.montarReferencia(d);
    expect(lib.montarReferencia(d)).toBe(a);
    expect(a).toContain("`X_KEY`");
    expect(a).toContain("**não**");
    expect(a).not.toMatch(/20\d\d-\d\d-\d\d/);
  });
});
