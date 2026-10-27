import { describe, expect, it } from "vitest";
import { clientIdDoCookie, idsGA4Atuais, sessionIdDoCookie } from "./ga4Ids";

describe("ids do GA4 para a compra pelo servidor", () => {
  it("lê client_id do _ga", () => {
    expect(clientIdDoCookie("GA1.1.123456789.1730000000")).toBe("123456789.1730000000");
    expect(clientIdDoCookie("lixo")).toBeUndefined();
  });
  it("lê a sessão nos dois formatos do cookie _ga_<id>", () => {
    expect(sessionIdDoCookie("GS1.1.1730000123.3.1.1730000200.0.0.0")).toBe("1730000123");
    expect(sessionIdDoCookie("GS2.1.s1730000123$o3$g1$t1730000200$j0$l0$h0")).toBe("1730000123");
    expect(sessionIdDoCookie(undefined)).toBeUndefined();
  });
  it("sem consentimento não manda nada, mesmo com cookie antigo", () => {
    const cookies = "_ga=GA1.1.111.222; _ga_DGCPN51SD6=GS2.1.s1730000123$o1";
    expect(idsGA4Atuais(cookies, () => false)).toEqual({});
    expect(idsGA4Atuais(cookies, () => true)).toEqual({ ga4ClientId: "111.222", ga4SessionId: "1730000123" });
    expect(idsGA4Atuais("outro=1", () => true)).toEqual({});
  });
});
