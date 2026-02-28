# Arquitetura da Plataforma Shadia Hasan

## 📋 Visão Geral

Plataforma educacional completa com cursos online, realidade virtual, sistema de assinaturas, programa de indicações e comunidade. Stack: React 19 + TypeScript + Vite + TailwindCSS (frontend) + Node.js + Express + tRPC (backend) + MySQL (banco de dados).

---

## 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Páginas    │  │ Componentes  │  │   Hooks      │      │
│  │  Públicas    │  │   UI (shadcn)│  │   tRPC       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/tRPC
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (Node.js + Express + tRPC)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Routers    │  │  Middleware  │  │   Services   │      │
│  │   tRPC       │  │  Auth/RBAC   │  │  Email/S3    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ Drizzle ORM
┌─────────────────────────────────────────────────────────────┐
│                    BANCO DE DADOS (MySQL)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Users     │  │   Courses    │  │  Referrals   │      │
│  │ Subscriptions│  │   Lessons    │  │   Payments   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ Webhooks
┌─────────────────────────────────────────────────────────────┐
│                   SERVIÇOS EXTERNOS                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Stripe     │  │    Resend    │  │      S3      │      │
│  │  Pagamentos  │  │    Emails    │  │  Arquivos    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura de Diretórios

```
shadia-vr-platform/
├── client/                          # Frontend React
│   ├── public/                      # Arquivos estáticos
│   │   ├── logo.png                 # Logo da plataforma
│   │   ├── favicon.ico              # Favicon
│   │   ├── robots.txt               # SEO - controle de crawlers
│   │   └── sitemap.xml              # SEO - mapa do site
│   └── src/
│       ├── components/              # Componentes reutilizáveis
│       │   ├── ui/                  # Componentes shadcn/ui
│       │   ├── Breadcrumbs.tsx      # Navegação hierárquica (SEO)
│       │   ├── OptimizedImage.tsx   # Lazy loading + WebP/AVIF
│       │   ├── ProtectedRoute.tsx   # Proteção de rotas
│       │   └── WhatsAppButton.tsx   # Botão flutuante WhatsApp
│       ├── pages/                   # Páginas da aplicação
│       │   ├── Home.tsx             # Landing page
│       │   ├── Login.tsx            # Autenticação
│       │   ├── Register.tsx         # Cadastro
│       │   ├── ForgotPassword.tsx   # Recuperação de senha
│       │   ├── ResetPassword.tsx    # Redefinir senha
│       │   ├── Courses.tsx          # Catálogo de cursos
│       │   ├── CourseDetail.tsx     # Detalhes do curso
│       │   ├── LessonView.tsx       # Player de aulas
│       │   ├── MyCourses.tsx        # Dashboard do aluno
│       │   ├── UserReferrals.tsx    # Sistema de indicações
│       │   ├── About.tsx            # Sobre Shadia Hasan
│       │   ├── Contact.tsx          # Contato + agendamento
│       │   ├── Pricing.tsx          # Planos e preços
│       │   └── admin/               # Painel administrativo
│       │       ├── AdminDashboard.tsx
│       │       ├── AdminCourses.tsx
│       │       ├── AdminCourseLessons.tsx
│       │       ├── AdminStudents.tsx
│       │       ├── AdminCashbackRequests.tsx
│       │       └── AdminManageAdmins.tsx
│       ├── lib/
│       │   ├── trpc.ts              # Cliente tRPC
│       │   ├── breadcrumbs.ts       # Helper de breadcrumbs
│       │   └── seo-meta-tags.ts     # Meta tags para SEO
│       ├── contexts/                # Contextos React
│       ├── hooks/                   # Hooks customizados
│       ├── App.tsx                  # Roteamento principal
│       ├── main.tsx                 # Entry point
│       └── index.css                # Estilos globais + Tailwind
│
├── server/                          # Backend Node.js
│   ├── _core/                       # Infraestrutura
│   │   ├── index.ts                 # Servidor Express
│   │   ├── trpc.ts                  # Configuração tRPC
│   │   ├── context.ts               # Contexto de requisições
│   │   ├── cookies.ts               # Gerenciamento de cookies
│   │   ├── email.ts                 # Serviço de emails (Resend)
│   │   ├── oauth.ts                 # OAuth (Google/Apple)
│   │   └── systemRouter.ts          # Rotas de sistema
│   ├── routers/                     # Routers tRPC modulares
│   │   ├── admin.ts                 # Procedures admin
│   │   ├── referrals.ts             # Sistema de indicações
│   │   └── subscriptions.ts         # Assinaturas Stripe
│   ├── auth/                        # Autenticação
│   │   ├── passport.ts              # Estratégias Passport
│   │   └── routes.ts                # Rotas OAuth
│   ├── db.ts                        # Funções de banco de dados
│   ├── routers.ts                   # Router principal tRPC
│   ├── routes.ts                    # Rotas Express
│   └── *.test.ts                    # Testes unitários (Vitest)
│
├── drizzle/                         # Banco de dados
│   ├── schema.ts                    # Schema completo (40+ tabelas)
│   └── migrations/                  # Migrações SQL
│
├── storage/                         # Helpers S3
│   └── index.ts                     # Upload de arquivos
│
├── shared/                          # Código compartilhado
│   └── constants.ts                 # Constantes globais
│
├── todo.md                          # Lista de tarefas
├── package.json                     # Dependências
└── README.md                        # Documentação
```

---

## 🔑 Principais Arquivos e Responsabilidades

### **Frontend**

#### **Páginas Principais**

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `Home.tsx` | `/` | Landing page com hero section, depoimentos, planos |
| `Login.tsx` | `/login` | Autenticação (email/senha, Google, Apple) |
| `Register.tsx` | `/register` | Cadastro de novos usuários |
| `ForgotPassword.tsx` | `/forgot-password` | Solicitação de recuperação de senha |
| `ResetPassword.tsx` | `/reset-password` | Redefinição de senha com token |
| `Courses.tsx` | `/courses` | Catálogo de cursos disponíveis |
| `CourseDetail.tsx` | `/courses/:slug` | Detalhes do curso + matrícula |
| `LessonView.tsx` | `/courses/:slug/lessons/:id` | Player de vídeo + progresso |
| `MyCourses.tsx` | `/my-courses` | Dashboard do aluno (cursos matriculados) |
| `UserReferrals.tsx` | `/dashboard/referrals` | Sistema de indicações + cashback |
| `Pricing.tsx` | `/pricing` | Planos e preços (Free, Premium) |
| `About.tsx` | `/about` | Sobre Shadia Hasan (bio, formação, CRP) |
| `Contact.tsx` | `/contact` | Formulário de contato + agendamento WhatsApp |

#### **Painel Administrativo**

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `AdminDashboard.tsx` | `/admin` | Dashboard com estatísticas |
| `AdminCourses.tsx` | `/admin/courses` | CRUD de cursos |
| `AdminCourseLessons.tsx` | `/admin/courses/:id/lessons` | CRUD de aulas |
| `AdminStudents.tsx` | `/admin/students` | Gerenciamento de alunos + trocar plano |
| `AdminCashbackRequests.tsx` | `/admin/cashback-requests` | Aprovar/rejeitar resgates de pontos |
| `AdminManageAdmins.tsx` | `/admin/manage-admins` | Promover/demover admins/superadmins |

#### **Componentes Críticos**

| Arquivo | Função |
|---------|--------|
| `ProtectedRoute.tsx` | Protege rotas que requerem autenticação |
| `Breadcrumbs.tsx` | Navegação hierárquica com schema.org (SEO) |
| `OptimizedImage.tsx` | Lazy loading + WebP/AVIF + fallback JPEG |
| `WhatsAppButton.tsx` | Botão flutuante para contato (+55 47 99142-6662) |
| `ui/*` | Componentes shadcn/ui (Button, Card, Input, etc.) |

---

### **Backend**

#### **Routers tRPC**

| Arquivo | Namespace | Procedures Principais |
|---------|-----------|----------------------|
| `routers.ts` | `auth.*` | `me`, `login`, `register`, `logout`, `verifyEmail`, `requestPasswordReset`, `resetPassword` |
| `routers/admin.ts` | `admin.*` | `promoteToAdmin`, `demoteFromAdmin`, `promoteToSuperAdmin`, `updateUserPlan`, `listAdmins`, `getAuditLogs` |
| `routers/referrals.ts` | `referrals.*` | `getMyReferralCode`, `getMyStats`, `listMyReferrals`, `getPointsHistory`, `requestCashback`, `processCashbackRequest` |
| `routers/subscriptions.ts` | `subscriptions.*` | `createCheckoutSession`, `getMySubscription`, `cancelSubscription` |

#### **Banco de Dados**

| Arquivo | Função |
|---------|--------|
| `db.ts` | Funções de acesso ao banco (900+ linhas) |
| `drizzle/schema.ts` | Schema completo com 40+ tabelas |

**Principais funções em `db.ts`:**
- **Autenticação:** `registerUser`, `loginUser`, `verifyEmail`, `requestPasswordReset`, `resetPassword`
- **OAuth:** `findOrCreateUserByProvider`
- **Cursos:** `getAllCourses`, `getCourseBySlug`, `createCourse`, `updateCourse`, `deleteCourse`
- **Aulas:** `getLessonsByCourseId`, `createLesson`, `updateLesson`, `deleteLesson`
- **Matrículas:** `enrollUserInCourse`, `getUserEnrollments`, `updateLessonProgress`
- **Indicações:** `generateReferralCode`, `getReferralStats`, `processReferralPoints`, `createCashbackRequest`
- **Admin:** `promoteToAdmin`, `demoteFromAdmin`, `promoteToSuperAdmin`, `listAllAdminsAndSuperAdmins`

#### **Serviços Externos**

| Arquivo | Serviço | Função |
|---------|---------|--------|
| `_core/email.ts` | Resend | Envio de emails (verificação, reset de senha, boas-vindas) |
| `storage/index.ts` | S3 | Upload de arquivos (imagens, vídeos, PDFs) |
| `routes.ts` | Stripe | Webhook para processar pagamentos e indicações |

---

## 🗄️ Schema do Banco de Dados

### **Tabelas Principais**

#### **1. Usuários e Autenticação**
- `users` - Dados dos usuários (email, senha, role, plano, referralCode, pontos)
- `emailVerificationTokens` - Tokens de verificação de email
- `passwordResetTokens` - Tokens de recuperação de senha
- `refreshTokens` - Tokens JWT para autenticação

#### **2. Cursos e Conteúdo**
- `courses` - Cursos disponíveis (título, descrição, thumbnail, preço)
- `courseModules` - Módulos/seções de cursos
- `lessons` - Aulas (vídeo, ordem, duração, descrição)
- `enrollments` - Matrículas de alunos em cursos
- `lessonProgress` - Progresso de cada aula
- `ebooks` - E-books disponíveis

#### **3. Sistema de Indicações**
- `referrals` - Indicações realizadas (status, plano, pontos)
- `pointsTransactions` - Histórico de transações de pontos
- `cashbackRequests` - Solicitações de resgate de pontos

#### **4. Assinaturas e Pagamentos**
- `subscriptions` - Assinaturas ativas/canceladas
- `paymentHistory` - Histórico de pagamentos
- `coursePurchases` - Compras avulsas de cursos

#### **5. Administração**
- `adminAuditLogs` - Auditoria de ações de admins
- `adminPermissions` - Permissões granulares de admins

#### **6. Comunidade**
- `userProfiles` - Perfis públicos (bio, interesses, objetivos)
- `connections` - Conexões entre usuários
- `connectionRequests` - Solicitações de conexão
- `conversations` - Conversas entre usuários
- `messages` - Mensagens individuais

#### **7. Gamificação**
- `userBadges` - Conquistas/badges dos alunos
- `certificates` - Certificados de conclusão

---

## 🔐 Sistema de Autenticação

### **Métodos de Login**
1. **Email/Senha** - Cadastro tradicional com verificação de email
2. **Google OAuth** - Login social via Google
3. **Apple OAuth** - Login social via Apple

### **Fluxo de Autenticação**
```
1. Usuário faz login → Passport.js valida credenciais
2. Backend gera JWT e armazena em cookie seguro
3. Middleware `protectedProcedure` valida JWT em cada requisição
4. Frontend usa `useAuth()` para acessar dados do usuário
```

### **Níveis de Acesso (RBAC)**
- **user** - Acesso básico (cursos, perfil, indicações)
- **admin** - Gerenciamento de cursos, alunos, cashback
- **superadmin** - Gerenciamento de admins + todas as permissões

---

## 💳 Sistema de Assinaturas

### **Planos Disponíveis**
| Plano | Preço | Recursos |
|-------|-------|----------|
| **Gratuito** | R$ 0 | Acesso limitado, 1 curso gratuito |
| **Premium** | R$ 97/mês | Acesso total, certificados, comunidade |

### **Fluxo de Pagamento (Stripe)**
```
1. Usuário clica em "Assinar" → Frontend chama `createCheckoutSession`
2. Backend cria sessão no Stripe com metadata (userId, plan, referredBy)
3. Usuário é redirecionado para Stripe Checkout
4. Após pagamento, Stripe envia webhook para `/api/stripe/webhook`
5. Backend processa pagamento:
   - Atualiza plano do usuário
   - Processa indicação (se houver)
   - Concede pontos ao indicador
   - Concede mensalidade grátis a cada 2 indicações
```

---

## 🎁 Sistema de Indicações

### **Regras**
- Cada usuário tem um código único (`referralCode`)
- Ao indicar alguém que assina, o indicador ganha pontos:
  - **Plano Premium:** 200 pontos
- **2 indicações = 1 mensalidade grátis**
- **100 pontos = R$ 10** (resgate via PIX, transferência ou crédito)
- Bônus progressivo: 3ª indicação (+150pts), 4ª (+200pts), 5ª+ (+250pts)

### **Fluxo de Resgate**
```
1. Usuário solicita resgate em `/dashboard/referrals`
2. Admin aprova/rejeita em `/admin/cashback-requests`
3. Se aprovado, pontos são debitados
4. Se rejeitado, pontos são reembolsados
```

---

## 📧 Sistema de Emails (Resend)

### **Templates Implementados**
1. **Verificação de Email** - Enviado após cadastro
2. **Recuperação de Senha** - Enviado ao solicitar reset
3. **Boas-vindas** - Enviado após verificar email

**Nota:** Emails usam templates HTML profissionais com gradiente purple-pink e logo da plataforma.

---

## 🎨 Design e SEO

### **Identidade Visual**
- **Cores:** Gradiente purple (#9333EA) → pink (#EC4899)
- **Fonte:** Inter (Google Fonts)
- **Logo:** Árvore roxa (símbolo de crescimento e transformação)

### **Otimizações de SEO**
- ✅ Meta tags dinâmicas (React Helmet)
- ✅ Breadcrumbs com schema.org em 12 páginas
- ✅ Sitemap.xml com 7 URLs públicas
- ✅ Robots.txt bloqueando rotas privadas
- ✅ Imagens otimizadas (WebP/AVIF) com lazy loading
- ✅ URLs amigáveis (slugs)

---

## 🧪 Testes

### **Testes Unitários (Vitest)**
- `auth.logout.test.ts` - Teste de logout
- `auth.password-reset.test.ts` - Fluxo completo de recuperação de senha (8 testes)

**Executar testes:**
```bash
pnpm test
```

---

## 🚀 Comandos Úteis

```bash
# Desenvolvimento
pnpm dev                    # Inicia servidor de desenvolvimento

# Banco de Dados
pnpm db:push                # Aplica mudanças no schema
pnpm db:studio              # Interface visual do banco

# Testes
pnpm test                   # Executa todos os testes
pnpm test <arquivo>         # Executa teste específico

# Build
pnpm build                  # Build de produção
```

---

## 📊 Estatísticas do Projeto

- **Linhas de código:** ~15.000+
- **Páginas:** 30+
- **Componentes:** 50+
- **Tabelas no banco:** 40+
- **Procedures tRPC:** 100+
- **Testes unitários:** 10+

---

## 🔗 URLs Importantes

- **Produção:** https://shadiahasan.club
- **Painel Admin:** https://shadiahasan.club/admin
- **Stripe Dashboard:** https://dashboard.stripe.com
- **Resend Dashboard:** https://resend.com/emails

---

## 📝 Próximos Passos Recomendados

1. **Configurar domínio no Resend** para envio de emails em produção
2. **Testar fluxo de recuperação de senha** em produção
3. **Promover primeiro superadmin** via banco de dados
4. **Configurar webhook do Stripe** no dashboard
5. **Adicionar rate limiting** no login e reset de senha
6. **Implementar notificação por email** quando senha for alterada

---

**Última atualização:** 18 de fevereiro de 2026
