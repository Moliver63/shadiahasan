import { describe, expect, it } from "vitest";
import { destinoSeguro, ehHostTecnico, emitirPasseDeLogin, hostCanonico, lerPasseDeLogin, middlewareDominioCanonico } from "./_core/canonicalHost";
import { assinarSessao } from "./_core/sessionCookie";

const CHAVE = new TextEncoder().encode("q".repeat(40));

describe("domínio canônico", () => {
  it("só o domínio técnico do Render é redirecionado", () => {
    const c = hostCanonico({} as any);
    expect(c).toBe("shadiahasan.com");
    expect(ehHostTecnico("shadiahasan-2ngl.onrender.com", c)).toBe(true);
    expect(ehHostTecnico("shadiahasan.com", c)).toBe(false);
    expect(ehHostTecnico("www.shadiahasan.com", c)).toBe(false);
    expect(ehHostTecnico("localhost:5055", c)).toBe(false);
    expect(ehHostTecnico(undefined, c)).toBe(false);
  });

  function chamar(host: string, path: string, method = "GET") {
    const out: any = {};
    const res: any = { setHeader: () => {}, send: (b: string) => { out.body = b; }, redirect: (code: number, url: string) => { out.redirect = [code, url]; } };
    let passou = false;
    middlewareDominioCanonico({} as any)({ headers: { host }, path: path.split("?")[0], originalUrl: path, method } as any, res, () => { passou = true; });
    return { ...out, passou };
  }

  it("página no Render vai para shadiahasan.com mantendo caminho e UTM", () => {
    expect(chamar("shadiahasan-2ngl.onrender.com", "/?utm_campaign=aula-19-90").redirect).toEqual([301, "https://shadiahasan.com/?utm_campaign=aula-19-90"]);
  });
  it("API, webhook e callback do Google continuam no Render", () => {
    expect(chamar("shadiahasan-2ngl.onrender.com", "/api/auth/google/callback?code=x").passou).toBe(true);
    expect(chamar("shadiahasan-2ngl.onrender.com", "/api/webhooks/asaas", "POST").passou).toBe(true);
  });
  it("no Render, /sw.js é o desinstalador do service worker velho", () => {
    expect(chamar("shadiahasan-2ngl.onrender.com", "/sw.js").body).toContain("unregister");
  });
  it("no domínio do site nada muda", () => {
    expect(chamar("shadiahasan.com", "/sw.js").passou).toBe(true);
  });
});

describe("passe de login entre domínios", () => {
  it("ida e volta, com destino interno", async () => {
    const t = await emitirPasseDeLogin(1, "/admin", { chave: CHAVE });
    expect(await lerPasseDeLogin(t, { chave: CHAVE })).toEqual({ userId: 1, destino: "/admin" });
  });
  it("vence em 2 minutos", async () => {
    const t = await emitirPasseDeLogin(1, "/", { chave: CHAVE, agoraS: 1000 });
    expect(await lerPasseDeLogin(t, { chave: CHAVE, agoraS: 1200 })).toBeNull();
  });
  it("cookie de sessão não serve como passe (propósito diferente)", async () => {
    const sessao = await assinarSessao({ id: 1, email: "a@b.com" }, { chave: CHAVE });
    expect(await lerPasseDeLogin(sessao, { chave: CHAVE })).toBeNull();
  });
  it("destino externo vira /", () => {
    expect(destinoSeguro("https://mal.com")).toBe("/");
    expect(destinoSeguro("//mal.com")).toBe("/");
    expect(destinoSeguro("/courses")).toBe("/courses");
  });
});
