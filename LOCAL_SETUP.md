# 🚀 Guia de Setup Local - Visual Studio Code

Este guia explica como baixar e rodar o projeto **Shadia Hasan Platform** localmente no Visual Studio Code.

---

## 📋 Pré-requisitos

Antes de começar, instale:

1. **Node.js 22.x** - [Download](https://nodejs.org/)
2. **pnpm** - Gerenciador de pacotes (instale com `npm install -g pnpm`)
3. **Visual Studio Code** - [Download](https://code.visualstudio.com/)
4. **MySQL 8.0+** ou **TiDB Cloud** (banco de dados)
5. **Git** - [Download](https://git-scm.com/)

---

## 📥 Passo 1: Baixar o Projeto

### Opção A: Via GitHub (Recomendado)

1. Acesse o Management UI da Manus
2. Vá em **Settings → GitHub**
3. Clique em **Export to GitHub**
4. Escolha o nome do repositório (ex: `shadia-vr-platform`)
5. Clone o repositório:

```bash
gh repo clone seu-usuario/shadia-vr-platform
cd shadia-vr-platform
```

### Opção B: Download Direto

1. No Management UI, vá em **Code**
2. Clique em **Download All Files**
3. Extraia o ZIP em uma pasta
4. Abra a pasta no terminal

---

## 🔧 Passo 2: Instalar Dependências

```bash
pnpm install
```

**Tempo estimado:** 2-3 minutos

---

## 🗄️ Passo 3: Configurar Banco de Dados

### Opção A: MySQL Local

1. Instale MySQL: [Download](https://dev.mysql.com/downloads/mysql/)
2. Crie o banco de dados:

```sql
CREATE DATABASE shadia_vr_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

3. Anote a connection string:

```
mysql://root:sua_senha@localhost:3306/shadia_vr_platform
```

### Opção B: TiDB Cloud (Grátis)

1. Crie conta em [TiDB Cloud](https://tidbcloud.com/)
2. Crie um cluster gratuito
3. Copie a connection string fornecida

---

## 🔐 Passo 4: Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
# Windows (PowerShell)
New-Item .env

# macOS/Linux
touch .env
```

Cole este conteúdo no `.env`:

```env
# BANCO DE DADOS
DATABASE_URL=mysql://root:senha@localhost:3306/shadia_vr_platform

# JWT (gere uma chave forte)
JWT_SECRET=cole_uma_chave_aleatoria_de_32_caracteres_aqui

# APLICAÇÃO
NODE_ENV=development
PORT=3000
SITE_URL=http://localhost:3000
VITE_APP_TITLE=Shadia Hasan
VITE_APP_LOGO=https://cdn.manus.im/shadia/logo.png

# GOOGLE OAUTH (opcional para desenvolvimento)
GOOGLE_CLIENT_ID=seu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# RESEND (emails)
RESEND_API_KEY=re_sua_chave_aqui
FROM_EMAIL=noreply@shadiahasan.club

# STRIPE (pagamentos - use chaves de teste)
STRIPE_SECRET_KEY=sk_test_sua_chave_aqui
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_sua_chave_publica_aqui
STRIPE_WEBHOOK_SECRET=whsec_seu_webhook_secret_aqui

# MANUS APIs (opcional - para LLM, storage, etc)
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=sua_chave_aqui
```

### 🔑 Como Gerar JWT_SECRET

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# OpenSSL
openssl rand -base64 32
```

### 🔑 Como Obter Chaves de APIs

- **Google OAuth**: [Console Google Cloud](https://console.cloud.google.com/apis/credentials)
- **Resend**: [Resend Dashboard](https://resend.com/api-keys)
- **Stripe**: [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)

---

## 🗃️ Passo 5: Criar Tabelas no Banco

Execute a migração do Drizzle:

```bash
pnpm db:push
```

**Saída esperada:**
```
✓ Pushing schema changes to database...
✓ Done!
```

---

## ▶️ Passo 6: Rodar o Projeto

### Modo Desenvolvimento (Hot Reload)

```bash
pnpm dev
```

**Acesse:** http://localhost:3000

### Modo Produção (Build + Start)

```bash
# 1. Build do frontend e backend
pnpm build

# 2. Iniciar servidor
pnpm start
```

---

## 📂 Pasta `dist` (Build de Produção)

Após rodar `pnpm build`, a pasta `dist` será criada com:

```
dist/
├── client/          # Frontend buildado (HTML, JS, CSS)
│   ├── index.html
│   ├── assets/
│   └── ...
└── server/          # Backend transpilado (TypeScript → JavaScript)
    ├── index.js
    ├── routers.js
    └── ...
```

**Para visualizar o build:**

```bash
# Servir pasta dist/client (frontend estático)
npx serve dist/client

# Ou usar o servidor completo
node dist/server/index.js
```

---

## 🎨 Passo 7: Abrir no Visual Studio Code

```bash
code .
```

### Extensões Recomendadas

Instale estas extensões no VS Code:

1. **ESLint** - Linting de JavaScript/TypeScript
2. **Prettier** - Formatação de código
3. **Tailwind CSS IntelliSense** - Autocomplete do Tailwind
4. **Drizzle ORM** - Syntax highlighting para queries
5. **Thunder Client** - Testar APIs (alternativa ao Postman)

---

## 🧪 Passo 8: Rodar Testes

```bash
# Todos os testes
pnpm test

# Testes específicos
pnpm test auth

# Modo watch (re-roda ao salvar)
pnpm test --watch
```

---

## 🛠️ Scripts Úteis

```bash
# Desenvolvimento
pnpm dev              # Inicia servidor com hot reload
pnpm db:push          # Atualiza schema do banco
pnpm db:studio        # Abre interface visual do banco (Drizzle Studio)

# Produção
pnpm build            # Build completo (frontend + backend)
pnpm start            # Inicia servidor de produção

# Testes
pnpm test             # Roda todos os testes
pnpm test:watch       # Modo watch

# Qualidade de código
pnpm lint             # Verifica erros de linting
pnpm format           # Formata código com Prettier
pnpm typecheck        # Verifica tipos TypeScript

# Banco de dados
pnpm db:generate      # Gera migrations
pnpm db:migrate       # Aplica migrations
pnpm db:seed          # Popula banco com dados de teste
```

---

## 🐛 Troubleshooting

### Erro: "Cannot find module"

```bash
# Limpar cache e reinstalar
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Erro: "Port 3000 already in use"

```bash
# Mudar porta no .env
PORT=3001
```

### Erro: "Database connection failed"

- Verifique se MySQL está rodando
- Confirme `DATABASE_URL` no `.env`
- Teste conexão:

```bash
mysql -u root -p -h localhost
```

### Erro: "OAuth redirect_uri_mismatch"

- Adicione `http://localhost:3000/api/auth/google/callback` nas URLs autorizadas do Google Console

### Build não gera pasta `dist`

```bash
# Limpar e rebuildar
rm -rf dist
pnpm build
```

---

## 📚 Estrutura do Projeto

```
shadia-vr-platform/
├── client/               # Frontend (React + Tailwind)
│   ├── src/
│   │   ├── pages/       # Páginas da aplicação
│   │   ├── components/  # Componentes reutilizáveis
│   │   ├── lib/         # Utilitários (tRPC client)
│   │   └── App.tsx      # Rotas principais
│   └── public/          # Assets estáticos
├── server/              # Backend (Express + tRPC)
│   ├── routers.ts       # Endpoints tRPC
│   ├── db.ts            # Query helpers
│   ├── auth/            # Autenticação OAuth
│   └── _core/           # Framework (não editar)
├── drizzle/             # Schema do banco
│   └── schema.ts        # Definição de tabelas
├── dist/                # Build de produção (gerado)
├── .env                 # Variáveis de ambiente (criar)
├── package.json         # Dependências
└── LOCAL_SETUP.md       # Este arquivo
```

---

## 🎯 Próximos Passos

Após rodar o projeto:

1. **Crie o primeiro super admin:**

```bash
pnpm tsx server/scripts/seed-superadmin.ts
```

**Credenciais:**
- Email: `admin@shadiahasan.club`
- Senha: `Admin@123`

2. **Explore o código:**
   - Páginas: `client/src/pages/`
   - Endpoints: `server/routers.ts`
   - Banco: `drizzle/schema.ts`

3. **Faça alterações:**
   - Salve o arquivo → Hot reload automático
   - Veja mudanças em http://localhost:3000

---

## 📞 Suporte

- **Documentação Manus:** https://docs.manus.im
- **Suporte:** https://help.manus.im
- **GitHub Issues:** (após exportar para GitHub)

---

**Bom desenvolvimento! 🚀**
