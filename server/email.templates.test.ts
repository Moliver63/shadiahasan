import { afterEach, describe, expect, it, vi } from "vitest";
import { escapar, htmlParaTexto, layoutEmail, textoParaHtml } from "./_core/emailLayout";

describe("layout dos e-mails", () => {
  it("escapa HTML vindo de dados do usuário", () => {
    expect(escapar(`<script>"x"</script>`)).toBe("&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
    expect(textoParaHtml("a<b>\nc")).toBe("a&lt;b&gt;<br>c");
  });

  it("monta envelope com título, assinatura e preheader", () => {
    const html = layoutEmail({ preheader: "resumo curto", titulo: "Título <x>", corpo: "<p>oi</p>" });
    expect(html).toContain("Título &lt;x&gt;");
    expect(html).toContain("CRP 12/27052");
    expect(html).toContain("resumo curto");
    expect(html).toContain("/email/logo-email.png");
  });

  it("gera versão em texto sem link de imagem e com URL dos botões", () => {
    const html = layoutEmail({
      preheader: "p",
      titulo: "T",
      corpo: `<a href="https://exemplo.com/x">Abrir</a>`,
    });
    const texto = htmlParaTexto(html);
    expect(texto).toContain("Abrir (https://exemplo.com/x)");
    expect(texto.startsWith("(")).toBe(false);
    expect(texto).not.toMatch(/<[a-z]/i);
  });
});

describe("envio", () => {
  const chaveOriginal = process.env.RESEND_API_KEY;
  afterEach(() => {
    if (chaveOriginal === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = chaveOriginal;
    vi.resetModules();
  });

  it("sem RESEND_API_KEY não lança e devolve success=false", async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const { sendAssinaturaAtivadaEmail } = await import("./_core/email");
    const r = await sendAssinaturaAtivadaEmail("a@b.com", "Ana", { plano: "Premium", valorCentavos: 9990 });
    expect(r.success).toBe(false);
  });
});
