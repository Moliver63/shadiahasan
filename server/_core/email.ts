import { Resend } from "resend";

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "Shadia Hasan <noreply@shadiahasan.club>";
const SITE_URL = process.env.SITE_URL || "https://www.shadiahasan.club";

// Email template styles
const emailStyles = `
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; }
  .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
  .header { background: linear-gradient(135deg, #9333EA 0%, #EC4899 100%); padding: 40px 20px; text-align: center; }
  .logo { width: 120px; height: auto; margin-bottom: 20px; }
  .content { padding: 40px 30px; color: #1f2937; }
  .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #9333EA 0%, #EC4899 100%); color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
  .footer { background-color: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
  .footer a { color: #9333EA; text-decoration: none; }
  h1 { color: #ffffff; font-size: 28px; margin: 0; }
  p { line-height: 1.6; margin: 16px 0; }
  .highlight { background-color: #faf5ff; border-left: 4px solid #9333EA; padding: 16px; margin: 20px 0; border-radius: 4px; }
`;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("[Email] Error sending email:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Sent successfully to ${to}:`, data?.id);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error("[Email] Exception sending email:", error);
    return { success: false, error: String(error) };
  }
}

export async function sendVerificationEmail(email: string, name: string, token: string) {
  const verifyUrl = `${SITE_URL}/verify-email?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${emailStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${SITE_URL}/logo.png" alt="Shadia Hasan" class="logo" />
          <h1>Bem-vindo à Shadia Hasan! 🌟</h1>
        </div>
        
        <div class="content">
          <p>Olá <strong>${name}</strong>,</p>
          
          <p>Estamos muito felizes em tê-lo(a) conosco nesta jornada de transformação interior através da realidade virtual.</p>
          
          <p>Para ativar sua conta e começar a explorar nossos programas, clique no botão abaixo:</p>
          
          <div style="text-align: center;">
            <a href="${verifyUrl}" class="button">Confirmar Meu Email</a>
          </div>
          
          <div class="highlight">
            <p style="margin: 0;"><strong>Ou copie e cole este link no seu navegador:</strong></p>
            <p style="margin: 8px 0 0 0; word-break: break-all; color: #9333EA;">${verifyUrl}</p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">Este link expira em 24 horas.</p>
        </div>
        
        <div class="footer">
          <p>Precisa de ajuda? Entre em contato conosco: <a href="mailto:contato@shadiahasan.club">contato@shadiahasan.club</a></p>
          <p style="margin-top: 20px;"><strong>Psicóloga Shadia Hasan</strong><br>CRP 12/27052</p>
          <p><a href="${SITE_URL}">www.shadiahasan.club</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Bem-vindo à Shadia Hasan - Confirme seu email",
    html,
  });
}

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const resetUrl = `${SITE_URL}/reset-password?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${emailStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${SITE_URL}/logo.png" alt="Shadia Hasan" class="logo" />
          <h1>Redefinir Sua Senha</h1>
        </div>
        
        <div class="content">
          <p>Olá <strong>${name}</strong>,</p>
          
          <p>Recebemos uma solicitação para redefinir a senha da sua conta Shadia Hasan.</p>
          
          <p>Se foi você quem solicitou, clique no botão abaixo para criar uma nova senha:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Redefinir Minha Senha</a>
          </div>
          
          <div class="highlight">
            <p style="margin: 0;"><strong>Ou copie e cole este link no seu navegador:</strong></p>
            <p style="margin: 8px 0 0 0; word-break: break-all; color: #9333EA;">${resetUrl}</p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">Este link expira em 1 hora.</p>
          
          <p style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px;">
            <strong>⚠️ Não solicitou esta alteração?</strong><br>
            Ignore este email. Sua senha permanecerá a mesma.
          </p>
        </div>
        
        <div class="footer">
          <p>Precisa de ajuda? Entre em contato conosco: <a href="mailto:contato@shadiahasan.club">contato@shadiahasan.club</a></p>
          <p style="margin-top: 20px;"><strong>Psicóloga Shadia Hasan</strong><br>CRP 12/27052</p>
          <p><a href="${SITE_URL}">www.shadiahasan.club</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Redefinir sua senha - Shadia Hasan",
    html,
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${emailStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${SITE_URL}/logo.png" alt="Shadia Hasan" class="logo" />
          <h1>Sua jornada começa agora! ✨</h1>
        </div>
        
        <div class="content">
          <p>Olá <strong>${name}</strong>,</p>
          
          <p>Parabéns! Sua conta foi ativada com sucesso. 🎉</p>
          
          <p>Você agora tem acesso completo à plataforma Shadia Hasan e pode começar sua jornada de transformação interior através de experiências imersivas em realidade virtual.</p>
          
          <div style="background: linear-gradient(135deg, #faf5ff 0%, #fce7f3 100%); padding: 20px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #9333EA;">O que você pode fazer agora:</p>
            <p style="margin: 8px 0;">✓ Explorar nossos programas de desenvolvimento pessoal</p>
            <p style="margin: 8px 0;">✓ Participar da comunidade "Conexões Conscientes"</p>
            <p style="margin: 8px 0;">✓ Acompanhar seu progresso e conquistas</p>
            <p style="margin: 8px 0;">✓ Obter certificados de conclusão</p>
          </div>
          
          <div style="text-align: center;">
            <a href="${SITE_URL}/courses" class="button">Começar Minha Jornada</a>
          </div>
          
          <div class="highlight">
            <p style="margin: 0;"><strong>💡 Dica:</strong> Comece pelo programa "Fundamentos da Transformação Interior" para aproveitar ao máximo sua experiência.</p>
          </div>
        </div>
        
        <div class="footer">
          <p>Precisa de ajuda? Nossa equipe está sempre disponível: <a href="mailto:contato@shadiahasan.club">contato@shadiahasan.club</a></p>
          <p style="margin-top: 20px;"><strong>Psicóloga Shadia Hasan</strong><br>CRP 12/27052</p>
          <p><a href="${SITE_URL}">www.shadiahasan.club</a></p>
          <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">Você está recebendo este email porque criou uma conta em shadiahasan.club</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Sua jornada de transformação começa agora! ✨",
    html,
  });
}


/**
 * Lembrete de cobrança em aberto (PIX, boleto ou cartão ainda não pago).
 * O link é o da fatura do Asaas; o texto evita pressão e falsa urgência.
 */
export async function sendPaymentReminderEmail(
  email: string,
  name: string,
  params: { invoiceUrl: string; what: string; note?: string },
) {
  const firstName = (name || "").trim().split(" ")[0] || "";
  const greeting = firstName ? `Olá, ${firstName}.` : "Olá.";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${emailStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${SITE_URL}/logo.png" alt="Shadia Hasan" class="logo" />
          <h1>Seu pagamento está esperando</h1>
        </div>
        <div class="content">
          <p>${greeting}</p>
          <p>Você começou a contratar <strong>${params.what}</strong> e o pagamento ainda não foi concluído. Se foi só uma interrupção, é possível retomar de onde parou:</p>
          <div style="text-align: center;">
            <a href="${params.invoiceUrl}" class="button">Concluir pagamento</a>
          </div>
          ${params.note ? `<p>${params.note}</p>` : ""}
          <p>Se você já pagou, pode ignorar esta mensagem. A liberação acontece sozinha assim que o pagamento é confirmado.</p>
        </div>
        <div class="footer">
          <p>Precisa de ajuda? Escreva para <a href="mailto:contato@shadiahasan.club">contato@shadiahasan.club</a></p>
          <p><a href="${SITE_URL}">www.shadiahasan.club</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject: "Seu pagamento ainda não foi concluído", html });
}
