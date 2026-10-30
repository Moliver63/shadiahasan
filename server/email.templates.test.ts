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

  it("todo e-mail leva logo dimensionado e contatos completos (boas práticas)", () => {
    const html = layoutEmail({ preheader: "p", titulo: "T", corpo: "" });
    expect(html).toMatch(/logo-email\.png" width="150" height="123" alt="Shadia Hasan/);
    for (const trecho of ["(47) 99166-5536", "https://wa.me/5547991665536", "mailto:contato@shadiahasan.com", "@shadia_hasan", "/privacy", "/minha-area"]) {
      expect(html).toContain(trecho);
    }
    const texto = htmlParaTexto(html);
    expect(texto).toContain("WhatsApp (47) 99166-5536");
    expect(texto).toContain("Política de privacidade");
  });

  it("resposta da caixa de contato assina com o setor e os mesmos contatos", async () => {
    const { emailRespostaContato } = await import("./_core/email");
    const html = emailRespostaContato({ corpo: "Oi", setor: "Financeiro", endereco: "financeiro@shadiahasan.com" });
    expect(html).toContain("assinatura-email.png");
    expect(html).toContain("Financeiro");
    expect(html).toContain("mailto:financeiro@shadiahasan.com");
    expect(html).toContain("(47) 99166-5536");
    expect(html).toContain("CRP 12/27052");
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
