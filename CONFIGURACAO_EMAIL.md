# Configuração de Email - Domínio shadiahasan.com

## 📧 Status Atual

- **Domínio**: shadiahasan.com
- **Email Remetente**: noreply@shadiahasan.com
- **Provedor**: Resend API
- **Status**: ⚠️ Aguardando verificação de domínio

---

## 🔧 Passo a Passo para Ativar Emails

### 1. Acessar Painel do Resend

Acesse: https://resend.com/domains

### 2. Adicionar Domínio

1. Clique em **"Add Domain"**
2. Digite: `shadiahasan.com`
3. Clique em **"Add"**

### 3. Configurar Registros DNS

O Resend fornecerá 3 registros DNS que você precisa adicionar no seu provedor de domínio:

#### A) Registro SPF (TXT)

```
Tipo: TXT
Nome: @ (ou deixe em branco)
Valor: v=spf1 include:resend.com ~all
TTL: 3600
```

#### B) Registro DKIM (TXT)

```
Tipo: TXT
Nome: resend._domainkey
Valor: [será fornecido pelo Resend - copie exatamente]
TTL: 3600
```

#### C) Registro MX (opcional, mas recomendado)

```
Tipo: MX
Nome: @ (ou deixe em branco)
Prioridade: 10
Valor: feedback-smtp.us-east-1.amazonses.com
TTL: 3600
```

### 4. Aguardar Verificação

- A verificação pode levar de **alguns minutos até 48 horas**
- O Resend verifica automaticamente a cada hora
- Você receberá um email quando o domínio for verificado

### 5. Testar Envio de Email

Após a verificação, teste o cadastro:

1. Acesse `/signup`
2. Crie uma conta de teste
3. Verifique se o email de verificação chegou
4. Clique no link de ativação

---

## 🎯 Onde Adicionar os Registros DNS

Dependendo de onde você registrou o domínio `shadiahasan.com`, acesse o painel DNS:

### Registro.br (Brasil)

1. Acesse https://registro.br
2. Faça login
3. Vá em "Meus Domínios"
4. Clique em "shadiahasan.com"
5. Vá em "Editar Zona DNS"
6. Adicione os registros TXT e MX

### Cloudflare

1. Acesse https://dash.cloudflare.com
2. Selecione o domínio `shadiahasan.com`
3. Vá em "DNS"
4. Clique em "Add record"
5. Adicione cada registro conforme instruções

### GoDaddy

1. Acesse https://dcc.godaddy.com
2. Vá em "Meus Produtos"
3. Clique em "DNS" ao lado do domínio
4. Adicione os registros

### Hostinger

1. Acesse o painel da Hostinger
2. Vá em "Domínios"
3. Clique em "Gerenciar" ao lado de shadiahasan.com
4. Vá em "DNS / Nameservers"
5. Adicione os registros

---

## ✅ Como Saber se Está Funcionando

### Verificar no Resend

1. Acesse https://resend.com/domains
2. O status do domínio deve estar **"Verified"** (verde)
3. Se estiver "Pending", aguarde mais alguns minutos

### Testar Envio

```bash
# Criar conta de teste
1. Acesse https://shadiahasan.com/signup
2. Preencha o formulário
3. Clique em "Criar conta gratuita"
4. Verifique sua caixa de entrada
```

Se o email **NÃO** chegar:
- Verifique a pasta de spam
- Confirme que os registros DNS foram adicionados corretamente
- Aguarde até 48h para propagação DNS
- Verifique o status no painel do Resend

---

## 🔍 Verificar Registros DNS (Opcional)

Você pode verificar se os registros foram aplicados usando ferramentas online:

### MXToolbox
https://mxtoolbox.com/SuperTool.aspx
- Digite: `shadiahasan.com`
- Verifique registros SPF, DKIM e MX

### Google Admin Toolbox
https://toolbox.googleapps.com/apps/dig/
- Digite: `shadiahasan.com`
- Tipo: TXT
- Verifique se aparecem os registros do Resend

---

## 📧 Tipos de Email Enviados

Após a configuração, o sistema enviará automaticamente:

1. **Email de Verificação** (ao criar conta)
   - Assunto: "Bem-vindo à Jornada de Transformação Interior"
   - Remetente: noreply@shadiahasan.com
   - Conteúdo: Link de ativação de conta

2. **Email de Recuperação de Senha**
   - Assunto: "Recuperação de Senha - Shadia Hasan"
   - Remetente: noreply@shadiahasan.com
   - Conteúdo: Link para redefinir senha (válido por 1 hora)

3. **Notificações do Sistema** (futuro)
   - Novos cursos
   - Mensagens da comunidade
   - Certificados disponíveis

---

## ⚠️ Problemas Comuns

### Email não chega

**Causa**: Domínio não verificado no Resend
**Solução**: Aguarde verificação ou verifique registros DNS

### Email vai para spam

**Causa**: Falta de registros SPF/DKIM
**Solução**: Adicione todos os registros DNS recomendados

### Erro "Domain not verified"

**Causa**: Domínio ainda não foi verificado pelo Resend
**Solução**: Aguarde até 48h após adicionar registros DNS

---

## 🚀 Após Configuração

Quando o domínio estiver verificado:

1. ✅ Emails de verificação funcionarão automaticamente
2. ✅ Recuperação de senha funcionará
3. ✅ Notificações do sistema funcionarão
4. ✅ Todos os emails terão branding profissional

**Não é necessário alterar nenhum código** - o sistema já está configurado para usar `noreply@shadiahasan.com`!

---

## 📞 Suporte

Se tiver problemas:

1. **Resend Support**: https://resend.com/support
2. **Documentação**: https://resend.com/docs
3. **Status do serviço**: https://status.resend.com

---

## 📝 Checklist de Configuração

- [ ] Acessar https://resend.com/domains
- [ ] Adicionar domínio `shadiahasan.com`
- [ ] Copiar registros DNS fornecidos pelo Resend
- [ ] Adicionar registro SPF (TXT)
- [ ] Adicionar registro DKIM (TXT)
- [ ] Adicionar registro MX (opcional)
- [ ] Aguardar verificação (até 48h)
- [ ] Verificar status "Verified" no Resend
- [ ] Testar cadastro de conta
- [ ] Confirmar recebimento de email
- [ ] Verificar que email não foi para spam

---

**Data de configuração**: 14 de fevereiro de 2026
**Email configurado**: noreply@shadiahasan.com
**Status**: Aguardando verificação de domínio no Resend
