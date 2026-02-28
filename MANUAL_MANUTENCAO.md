# Manual de Manutenção e Mudanças - Shadia VR Platform

**Versão:** 1.0  
**Data:** Fevereiro 2026  
**Site:** https://shadiahasan.club

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Estrutura de Pastas](#estrutura-de-pastas)
4. [Guia de Alterações Comuns](#guia-de-alterações-comuns)
5. [Configurações e Integrações](#configurações-e-integrações)
6. [Banco de Dados](#banco-de-dados)
7. [Troubleshooting](#troubleshooting)
8. [Deploy e Publicação](#deploy-e-publicação)

---

## Visão Geral

A **Shadia VR Platform** é uma plataforma de transformação pessoal através de realidade virtual, desenvolvida com tecnologias modernas para oferecer experiências imersivas de desenvolvimento consciente.

### Tecnologias Principais

- **Frontend:** React 19 + Vite + Tailwind CSS 4 + shadcn/ui
- **Backend:** Node.js + Express 4 + tRPC 11
- **Banco de Dados:** MySQL/TiDB (via Drizzle ORM)
- **Autenticação:** Manus OAuth
- **Pagamentos:** Stripe
- **Hospedagem:** Manus Platform (domínio personalizado configurado)

### Funcionalidades Principais

1. **Sistema de Cursos** - Plataforma educacional com vídeos, lições e progresso
2. **Agendamento de Sessões VR** - Calendário de sessões de realidade virtual
3. **Sistema de Assinaturas** - 4 planos (Gratuito, Básico, Premium, VIP)
4. **Painel Administrativo** - Dashboard completo para gestão
5. **Avatar Assistente** - Shadia (avatar flutuante com mensagens rotativas)
6. **Chat com IA** - Assistente virtual para recomendação de cursos

---

## Arquitetura do Sistema

### Fluxo de Dados

```
Cliente (Browser)
    ↓
React App (Frontend)
    ↓
tRPC Client
    ↓
Express Server (Backend)
    ↓
tRPC Procedures
    ↓
Drizzle ORM
    ↓
MySQL Database
```

### Componentes Principais

**Frontend (`client/`):**
- `src/pages/` - Páginas da aplicação
- `src/components/` - Componentes reutilizáveis
- `src/lib/trpc.ts` - Cliente tRPC configurado
- `src/contexts/` - Contextos React (Auth, Theme)

**Backend (`server/`):**
- `routers.ts` - Definição de todas as procedures tRPC
- `db.ts` - Funções helper para banco de dados
- `_core/` - Infraestrutura (OAuth, LLM, Stripe, etc.)

**Banco de Dados (`drizzle/`):**
- `schema.ts` - Definição de todas as tabelas

---

## Estrutura de Pastas

```
shadia-vr-platform/
├── client/                    # Frontend React
│   ├── public/               # Arquivos estáticos
│   ├── src/
│   │   ├── pages/           # Páginas da aplicação
│   │   │   ├── Home.tsx
│   │   │   ├── Courses.tsx
│   │   │   ├── Pricing.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   └── ...
│   │   ├── components/      # Componentes reutilizáveis
│   │   │   ├── ui/         # shadcn/ui components
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── ShadiaAssistantChat.tsx
│   │   │   ├── CookieConsent.tsx
│   │   │   └── ...
│   │   ├── contexts/       # Contextos React
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/
│   │   │   └── trpc.ts    # Cliente tRPC
│   │   ├── App.tsx        # Rotas e layout
│   │   ├── main.tsx       # Entry point
│   │   └── index.css      # Estilos globais
│   └── index.html
│
├── server/                   # Backend Node.js
│   ├── _core/              # Infraestrutura
│   │   ├── context.ts     # Contexto tRPC
│   │   ├── oauth.ts       # Autenticação Manus
│   │   ├── llm.ts         # Integração LLM
│   │   ├── stripe-webhook.ts
│   │   └── ...
│   ├── routers/           # Routers modulares
│   │   ├── admin.ts
│   │   ├── subscriptions.ts
│   │   └── ...
│   ├── routers.ts        # Router principal
│   ├── db.ts             # Funções de banco
│   └── stripe.ts         # Cliente Stripe
│
├── drizzle/              # Banco de dados
│   └── schema.ts        # Schema completo
│
├── shared/              # Código compartilhado
│   └── stripe-config.ts
│
├── storage/             # Helpers S3
│
├── todo.md             # Lista de tarefas
├── STRIPE_SETUP.md     # Guia de configuração Stripe
└── package.json
```

---

## Guia de Alterações Comuns

### 1. Adicionar Nova Página

**Passo 1:** Criar arquivo em `client/src/pages/`

```tsx
// client/src/pages/MinhaNovaPage.tsx
import DashboardLayout from "@/components/DashboardLayout";

export default function MinhaNovaPage() {
  return (
    <DashboardLayout>
      <h1>Minha Nova Página</h1>
      {/* Conteúdo aqui */}
    </DashboardLayout>
  );
}
```

**Passo 2:** Adicionar rota em `client/src/App.tsx`

```tsx
import MinhaNovaPage from "@/pages/MinhaNovaPage";

// Dentro do <Switch>:
<Route path="/minha-pagina" component={MinhaNovaPage} />
```

---

### 2. Modificar Cores e Estilos

**Cores Globais:** Editar `client/src/index.css`

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 280 70% 60%;  /* Roxo/Rosa principal */
    /* ... outras variáveis */
  }
}
```

**Componentes:** Usar classes Tailwind

```tsx
<div className="bg-primary text-primary-foreground">
  Conteúdo com cor primária
</div>
```

---

### 3. Adicionar Procedure tRPC

**Passo 1:** Definir procedure em `server/routers.ts`

```typescript
// Dentro do appRouter:
minhaFeature: router({
  listar: protectedProcedure
    .query(async ({ ctx }) => {
      const { db } = await import('./db');
      const { minhaTabela } = await import('../drizzle/schema');
      return await db.select().from(minhaTabela);
    }),
  
  criar: protectedProcedure
    .input(z.object({
      nome: z.string(),
      descricao: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { db } = await import('./db');
      const { minhaTabela } = await import('../drizzle/schema');
      await db.insert(minhaTabela).values({
        ...input,
        userId: ctx.user.id,
      });
      return { success: true };
    }),
}),
```

**Passo 2:** Usar no frontend

```tsx
import { trpc } from "@/lib/trpc";

function MeuComponente() {
  const { data, isLoading } = trpc.minhaFeature.listar.useQuery();
  const criar = trpc.minhaFeature.criar.useMutation();
  
  const handleCriar = async () => {
    await criar.mutateAsync({
      nome: "Teste",
      descricao: "Descrição"
    });
  };
  
  return (
    <div>
      {isLoading ? "Carregando..." : data?.map(item => ...)}
      <button onClick={handleCriar}>Criar</button>
    </div>
  );
}
```

---

### 4. Adicionar Tabela no Banco

**Passo 1:** Definir schema em `drizzle/schema.ts`

```typescript
export const minhaTabela = mysqlTable('minha_tabela', {
  id: serial('id').primaryKey(),
  userId: int('user_id').notNull().references(() => users.id),
  nome: varchar('nome', { length: 255 }).notNull(),
  descricao: text('descricao'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});
```

**Passo 2:** Aplicar mudanças

```bash
pnpm db:push
```

---

### 5. Modificar Avatar da Shadia

**Arquivo:** `client/src/components/ShadiaAssistantChat.tsx`

**Alterar mensagens rotativas:**

```typescript
const messages = [
  "Nova mensagem 1 💬",
  "Nova mensagem 2 ✨",
  "Nova mensagem 3 🌿",
];
```

**Alterar tamanho:**

```tsx
// Mobile: w-24 h-24 (96px)
// Desktop: w-40 h-40 (160px)
<img
  className="w-24 h-24 md:w-40 md:h-40 rounded-full"
  src="..."
/>
```

**Alterar link do WhatsApp:**

```typescript
const whatsappUrl = "https://wa.me/5511999999999?text=Olá!";
```

---

### 6. Adicionar Novo Curso

**Opção 1: Via Banco de Dados (UI do Manus)**

1. Acessar Management UI → Database
2. Tabela `courses` → Add Row
3. Preencher campos:
   - `title`: Nome do curso
   - `slug`: URL amigável (ex: `meu-curso`)
   - `description`: Descrição
   - `thumbnail`: URL da imagem
   - `category`: Categoria
   - `difficulty`: beginner/intermediate/advanced
   - `duration`: Duração em minutos
   - `price`: Preço em centavos (ex: 9900 = R$ 99,00)

**Opção 2: Via Código**

```typescript
// Criar procedure em server/routers.ts
courses: router({
  create: adminProcedure
    .input(z.object({
      title: z.string(),
      slug: z.string(),
      description: z.string(),
      // ... outros campos
    }))
    .mutation(async ({ input }) => {
      const { db } = await import('./db');
      const { courses } = await import('../drizzle/schema');
      await db.insert(courses).values(input);
      return { success: true };
    }),
}),
```

---

### 7. Modificar Planos de Assinatura

**Arquivo:** `client/src/pages/Pricing.tsx`

```typescript
const plans = [
  {
    name: "Gratuito",
    slug: "free",
    price: 0,
    features: [
      "Acesso a 3 cursos básicos",
      "1 sessão VR experimental",
    ],
  },
  {
    name: "Básico",
    slug: "basic",
    price: 4900, // R$ 49,00
    features: [
      "Acesso a todos os cursos básicos",
      "3 sessões VR por mês",
    ],
  },
  // ... adicionar mais planos
];
```

---

## Configurações e Integrações

### Stripe (Pagamentos)

**Localização das configurações:**
- `shared/stripe-config.ts` - Product IDs e Price IDs
- `server/stripe.ts` - Cliente Stripe
- `server/_core/stripe-webhook.ts` - Webhook handler

**Adicionar Price IDs:**

1. Acessar Stripe Dashboard → Produtos
2. Copiar Price IDs (começam com `price_`)
3. Editar `shared/stripe-config.ts`:

```typescript
export const STRIPE_PLANS = {
  basic: {
    productId: 'prod_U0eqO9v4LHNm06',
    priceId: 'price_XXXXXXXXXXXXXXX', // Adicionar aqui
  },
  premium: {
    productId: 'prod_U0f1fmv8sHeo4u',
    priceId: 'price_YYYYYYYYYYYYYYY', // Adicionar aqui
  },
  vip: {
    productId: 'prod_U0f1YgyCp6HGP0',
    priceId: 'price_ZZZZZZZZZZZZZZZ', // Adicionar aqui
  },
};
```

**Configurar Secret Key:**

1. Acessar Management UI → Settings → Secrets
2. Adicionar `STRIPE_SECRET_KEY` com valor da API Key

**Testar Pagamentos:**

- Cartão de teste: `4242 4242 4242 4242`
- Qualquer data futura e CVV

---

### Manus OAuth (Autenticação)

**Configuração automática** - Não requer ação manual.

**Verificar usuário logado:**

```tsx
import { trpc } from "@/lib/trpc";

function MeuComponente() {
  const { data: user } = trpc.auth.me.useQuery();
  
  if (!user) {
    return <div>Faça login</div>;
  }
  
  return <div>Olá, {user.name}!</div>;
}
```

**Fazer logout:**

```tsx
const logout = trpc.auth.logout.useMutation();

<button onClick={() => logout.mutate()}>
  Sair
</button>
```

---

### LLM (Chat com IA)

**Arquivo:** `server/_core/llm.ts`

**Usar em procedures:**

```typescript
import { invokeLLM } from './server/_core/llm';

const response = await invokeLLM({
  messages: [
    { role: 'system', content: 'Você é um assistente.' },
    { role: 'user', content: 'Olá!' },
  ],
});

const resposta = response.choices[0]?.message?.content;
```

---

### S3 (Armazenamento de Arquivos)

**Arquivo:** `server/storage.ts`

**Upload de arquivo:**

```typescript
import { storagePut } from './server/storage';

// Em uma procedure:
const { url } = await storagePut(
  `usuarios/${userId}/avatar.jpg`,
  fileBuffer,
  'image/jpeg'
);

// Salvar URL no banco
await db.update(users).set({ avatar: url });
```

---

## Banco de Dados

### Schema Principal

**Tabelas importantes:**

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários da plataforma |
| `userProfiles` | Perfis estendidos (avatar, telefone, endereço) |
| `courses` | Cursos disponíveis |
| `lessons` | Lições de cada curso |
| `enrollments` | Matrículas dos alunos |
| `appointments` | Agendamentos de sessões VR |
| `subscriptions` | Assinaturas ativas |
| `userSettings` | Configurações do usuário |
| `notifications` | Notificações |
| `activityLogs` | Logs de atividade (LGPD) |

### Comandos Úteis

**Aplicar mudanças no schema:**

```bash
cd /home/ubuntu/shadia-vr-platform
pnpm db:push
```

**Executar SQL customizado:**

Via Management UI → Database → SQL Query ou via código:

```typescript
import { db } from './server/db';
import { sql } from 'drizzle-orm';

await db.execute(sql`
  SELECT * FROM users WHERE role = 'admin'
`);
```

---

## Troubleshooting

### Erro: "Module not found"

**Causa:** Arquivo não existe ou caminho incorreto.

**Solução:**
1. Verificar se o arquivo existe
2. Corrigir import (usar `@/` para paths absolutos)
3. Reiniciar servidor: `pnpm dev`

---

### Erro: "Procedure not found"

**Causa:** Procedure não exportada ou nome incorreto.

**Solução:**
1. Verificar se procedure está em `server/routers.ts`
2. Verificar nome no frontend: `trpc.nomeCorreto.useQuery()`
3. Reiniciar servidor

---

### Avatar não aparece

**Causa:** Cookies não aceitos.

**Solução:**
- Avatar só aparece após aceitar cookies
- Verificar localStorage: `cookieConsent` deve ser `"accepted"`

---

### Stripe: "No such price"

**Causa:** Price ID não configurado.

**Solução:**
1. Editar `shared/stripe-config.ts`
2. Adicionar Price IDs corretos do Stripe Dashboard
3. Reiniciar servidor

---

### Erro de TypeScript

**Causa:** Tipos incorretos ou faltando.

**Solução:**
1. Verificar imports
2. Adicionar tipos explícitos: `const x: string = "valor"`
3. Reiniciar TypeScript: `Ctrl+Shift+P` → "Restart TS Server"

---

### Banco de dados: "Table doesn't exist"

**Causa:** Schema não aplicado.

**Solução:**

```bash
pnpm db:push
```

---

## Deploy e Publicação

### Criar Checkpoint

**Via Management UI:**
1. Clicar em "Save Checkpoint" no header
2. Adicionar descrição das mudanças
3. Aguardar conclusão

**Via Manus Agent:**
- Solicitar: "Salvar checkpoint com descrição X"

---

### Publicar Site

**Passo 1:** Criar checkpoint (obrigatório)

**Passo 2:** Clicar em "Publish" no Management UI

**Passo 3:** Aguardar deploy (1-3 minutos)

**Passo 4:** Site publicado em https://shadiahasan.club

---

### Rollback (Voltar Versão)

1. Management UI → Checkpoints
2. Selecionar checkpoint anterior
3. Clicar em "Rollback"
4. Confirmar

---

### Domínio Personalizado

**Atual:** shadiahasan.club (já configurado)

**Adicionar novo domínio:**
1. Management UI → Settings → Domains
2. Adicionar domínio
3. Configurar DNS conforme instruções
4. Aguardar propagação (até 48h)

---

## Boas Práticas

### Desenvolvimento

1. **Sempre criar checkpoint antes de mudanças grandes**
2. **Testar localmente antes de publicar**
3. **Usar todo.md para rastrear tarefas**
4. **Comentar código complexo**
5. **Seguir padrões do template**

### Segurança

1. **Nunca commitar secrets/API keys**
2. **Usar `protectedProcedure` para dados sensíveis**
3. **Validar inputs com Zod**
4. **Sanitizar dados do usuário**

### Performance

1. **Otimizar imagens (usar CDN)**
2. **Lazy loading de componentes pesados**
3. **Usar `useQuery` com `staleTime` adequado**
4. **Evitar re-renders desnecessários**

---

## Contatos e Suporte

**Plataforma Manus:**
- Suporte: https://help.manus.im
- Documentação: https://docs.manus.im

**Stripe:**
- Dashboard: https://dashboard.stripe.com
- Documentação: https://stripe.com/docs

---

## Changelog

### Versão 1.0 (Fevereiro 2026)
- Sistema de cursos completo
- Agendamento de sessões VR
- Integração Stripe (4 planos)
- Avatar assistente Shadia
- Chat com IA
- Painel administrativo
- Sistema de autenticação Manus OAuth
- Cookie consent (LGPD)

---

**Última atualização:** Fevereiro 2026  
**Mantido por:** Equipe Shadia VR Platform
