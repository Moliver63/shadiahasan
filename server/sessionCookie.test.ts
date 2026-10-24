import { describe, expect, it } from "vitest";
import { assinarSessao, lerSessao, chaveDeSessao } from "./_core/sessionCookie";

const CHAVE = new TextEncoder().encode("x".repeat(48));
const OUTRA = new TextEncoder().encode("y".repeat(48));

describe("cookie de sessão assinado", () => {
  it("o cookie antigo (JSON puro) não autentica mais: era o ataque", async () => {
    const forjado = JSON.stringify({ id: 2, email: "admin@exemplo.com", role: "admin" });
    expect(await lerSessao(forjado, { chave: CHAVE })).toBeNull();
  });

  it("ida e volta com a chave certa", async () => {
    const t = await assinarSessao({ id: 7, email: "Aluno@Exemplo.com" }, { chave: CHAVE });
    expect(await lerSessao(t, { chave: CHAVE })).toEqual({ userId: 7, email: "aluno@exemplo.com" });
  });

  it("assinado com outra chave ou adulterado é recusado", async () => {
    const t = await assinarSessao({ id: 7, email: "a@b.com" }, { chave: OUTRA });
    expect(await lerSessao(t, { chave: CHAVE })).toBeNull();
    const [h, , s] = (await assinarSessao({ id: 7, email: "a@b.com" }, { chave: CHAVE })).split(".");
    const payloadAdmin = Buffer.from(JSON.stringify({ uid: 2, email: "admin@exemplo.com", v: 1, iss: "shadiahasan-session" })).toString("base64url");
    expect(await lerSessao(`${h}.${payloadAdmin}.${s}`, { chave: CHAVE })).toBeNull();
  });

  it("vencido é recusado", async () => {
    const t = await assinarSessao({ id: 7, email: "a@b.com" }, { chave: CHAVE, agoraS: 1_000, validadeS: 60 });
    expect(await lerSessao(t, { chave: CHAVE, agoraS: 2_000 })).toBeNull();
  });

  it("sem chave (ou chave curta) não emite nem aceita sessão", async () => {
    expect(chaveDeSessao({ JWT_SECRET: "curta" } as any)).toBeNull();
    expect(chaveDeSessao({ SESSION_SIGNING_SECRET: "z".repeat(40), JWT_SECRET: "curta" } as any)).not.toBeNull();
    await expect(assinarSessao({ id: 1, email: "a@b.com" }, { chave: null })).rejects.toThrow();
    const t = await assinarSessao({ id: 1, email: "a@b.com" }, { chave: CHAVE });
    expect(await lerSessao(t, { chave: null })).toBeNull();
  });
});
