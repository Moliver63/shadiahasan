# Shadia Hasan — Memory System (Manutenção)

> Documento canônico de referência para manutenção humana e por IA.
> Última atualização: 2026-10-23.
> O `README.md` desta pasta é um resumo; em caso de divergência vale este arquivo.

---

## 1. Visão geral do projeto

- **Repositório**: <https://github.com/Moliver63/shadiahasan>
- **Produção**: <https://shadiahasan-2ngl.onrender.com>
- **Frontend**: React 19 + Vite 7 + TypeScript + TailwindCSS (`client/`)
- **Backend**: Express + tRPC 11 (`server/`)
- **ORM/DB**: Drizzle ORM + PostgreSQL (Render Postgres)
- **Deploy**: Render.com, build via `pnpm run build`
- **Verificação de tipos**: `pnpm check` (`tsc --noEmit`). O build usa Vite + esbuild, então erros de tipo **não** barram o deploy.

### Arquivos-fonte principais

```text
drizzle/schema.ts
server/routers.ts                 -- appRouter (cursos, aulas, assinaturas, matrículas...)
server/db.ts                      -- helpers de query (getDb() async)
server/routers/videos.ts          -- vídeo + controle de acesso (checkUserHasAccess)
server/routers/subscriptions.ts
server/routers/groups.ts          -- Grupos (módulos dentro de um curso)
server/routers/collections.ts     -- Programas (agrupamentos entre cursos)
server/asaas.ts                   -- integração Asaas (checkout + eventos)
server/routes/asaas-webhook.ts    -- POST /api/webhooks/asaas
server/routes/stripe-webhook.ts   -- POST /api/stripe/webhook
server/stripe.ts
server/cloudflare-stream.ts
shared/stripe-config.ts           -- planos x Price IDs
shared/br-document.ts             -- validação de CPF/CNPJ (front e back)
client/src/components/DashboardLayout.tsx
client/src/components/OptimizedImage.tsx
client/src/pages/AdminCourses.tsx
client/src/pages/AdminCourseLessons.tsx
client/src/pages/AdminCourseGroups.tsx
client/src/pages/AdminCollections.tsx
client/src/pages/AdminManageSubscriptions.tsx
client/src/pages/AdminUsers.tsx
client/src/pages/Courses.tsx / CourseDetail.tsx / LessonView.tsx
client/src/pages/Pricing.tsx / CheckoutSuccess.tsx
VIDEO_UPLOAD_TROUBLESHOOTING.md
```

---

## 2. Banco de dados — pontos relevantes

### Tabela `lessons`

| Campo | Uso |
|---|---|
| `courseId` | curso dono da aula |
| `moduleId` | **legado, sem uso** (ver seção 5) |
| `order` | posição da aula no curso (ordem exibida ao aluno) |
| `videoProvider` | provedor (`youtube`, `cloudflare`, etc.) |
| `videoAssetId` | UID do vídeo no Cloudflare Stream |
| `videoPlaybackUrl` | URL real de reprodução (YouTube ou manifest HLS) |
| `duration` | duração em segundos |
| `isAccessRestricted` | `0` grátis / `1` premium-avulso |
| `isPublished` | `0` rascunho / `1` publicado |

### Tabela `courses`

| Campo | Uso |
|---|---|
| `order` | posição do curso na vitrine (menor aparece primeiro). Cursos novos entram no fim. |
| `price` | preço avulso, em centavos |
| `allowIndividualPurchase` | `0/1` liga a compra avulsa. **Ainda sem UI no admin.** |
| `isPublished` | `0` rascunho / `1` publicado |

`getAllCourses` ordena por `order` crescente e depois por `createdAt` decrescente.

### Tabela `subscriptions`

| Campo | Uso |
|---|---|
| `userId` | usuário dono da assinatura |
| `plan` | `free`, `basic`, `premium`, `vip` |
| `status` | `active`, `paused`, `cancelled`, `expired`, `trial` |
| `startDate` / `endDate` / `trialEndDate` | vigência |
| `autoRenew` | renovação automática |
| `stripeSubscriptionId`, `stripePriceId`, `stripeCustomerId` | vínculo com o Stripe |
| `notes` | observações internas (o fluxo Asaas grava "Assinatura via Asaas") |

`userSubscriptions` existe no schema mas na prática não é gravada por nenhum webhook; o acesso lê `subscriptions` primeiro.

### Tabela `payment_history`

`amount` em **centavos** (o financeiro divide por 100). `status`: `pending`, `completed`, `failed`, `refunded`. No fluxo Asaas, a coluna `stripeInvoiceId` guarda a chave `asaas:<id da cobrança>` para evitar registro duplicado.

### Observação importante

A listagem administrativa de assinaturas vem de **todos os usuários**, com `leftJoin` em `subscriptions`, para o admin gerenciar também usuários sem registro prévio.

### Tabelas criadas sob demanda

`courseGroups`, `courseGroupLessons`, `contentCollections*`, `asaasAccounts` (colunas `overdueSince` e `remindersSent` entram por `ALTER TABLE ... IF NOT EXISTS`), `asaasWebhookEvents`, `trialPasses` e `trialEntryLessons` têm `CREATE TABLE IF NOT EXISTS` no próprio router/módulo (autocorreção), além de estarem em `drizzle/schema.ts`. Funciona com ou sem `pnpm db:push`.

---

## 3. Vídeo — estado atual da implementação

### Upload de vídeo (Cloudflare Stream)

1. Admin cria a aula em `AdminCourseLessons.tsx`.
2. O frontend chama `videos.admin.createUploadUrl`.
3. Arquivos grandes usam **TUS resumable upload** (`tus-js-client`).
4. Depois do upload, polling em `videos.admin.checkUploadStatus`.
5. Quando fica pronto, grava `videoPlaybackUrl` e `duration`.
6. Ao abrir a tela de aulas, `videos.admin.syncPendingVideos` reconcilia vídeos pendentes. Há também o botão "Sincronizar vídeos pendentes".

Diagnóstico: `VIDEO_UPLOAD_TROUBLESHOOTING.md`.

### Playback / tela preta

Causa histórica: o player recebia uma URL HLS montada localmente e dava `404 video.m3u8`. Correção: usar o `videoPlaybackUrl` real, ou buscar o manifest correto na API do Cloudflare. Sem `CLOUDFLARE_SIGNING_KEY_ID`/`PEM`, o sistema usa manifest público (fallback).

### Commits de referência

`26d640f` (status e duração), `6923e0a` (manifest real), `c91eaf8` (TUS), `4b3a0f7` (mensagem de frontend desatualizado), `bd35af8` e `20ebb6f` (ativar/desativar assinatura no admin).

---

## 4. Cursos e aulas — ordem, cópia e ações em lote

### Ordem

- Admin reordena **cursos** em `AdminCourses.tsx` e **aulas** em `AdminCourseLessons.tsx`, por arrastar e soltar (Sortable.js, pelo ícone de alça) ou pelos botões ↑↓.
- O aluno vê a mesma ordem: `courses.order` na vitrine e `lessons.order` dentro do curso (inclusive dentro de cada grupo).
- Dependências: `sortablejs` e `@types/sortablejs`.

### Procedures (todas exigem admin)

| Cursos | Aulas |
|---|---|
| `courses.reorder` | `lessons.reorder` |
| `courses.duplicate` | `lessons.duplicate` |
| `courses.bulkUpdate` | `lessons.bulkUpdate` |
| `courses.bulkDelete` | `lessons.bulkDelete` |

`courses.getByIds` é público e usado por `MyCourses`.

### Duplicar

- **Curso**: slug `-copia` (`-copia-2`...), título "(cópia)", nasce como rascunho no fim da lista. Copia as aulas **e os grupos** (apontando para as aulas novas). Os vídeos são reaproveitados (mesmo `videoAssetId`, sem novo upload); trocar o vídeo da cópia depois é seguro.
- **Aula**: vai para o fim do curso, como rascunho, e entra nos mesmos grupos da original.

### Excluir

`deleteCourse`, `bulkDeleteCourses`, `deleteLesson` e `bulkDeleteLessons` removem também os vínculos de grupos e programas (e recalculam a duração dos programas afetados). Esses passos são tolerantes: se as tabelas de agrupamento ainda não existirem, a exclusão principal não falha.

---

## 5. Agrupamento de conteúdo

Existem quatro estruturas. Três estão ativas.

| Estrutura | Tabelas | Para que serve |
|---|---|---|
| Curso → Aulas | `courses`, `lessons` | base de tudo |
| **Grupos** (módulos do aluno) | `courseGroups`, `courseGroupLessons` | dividir as aulas **de um curso** em módulos. Tela `/admin/courses/:id/groups`. O aluno vê "N módulo(s)"; aulas sem grupo aparecem em "Outras aulas". |
| **Programas** (coleções) | `contentCollections`, `contentCollectionItems`, `contentCollectionHistory` | trilha que junta aulas de **cursos diferentes**. Tela `/admin/collections`, rota pública `/collections/:id`, aba "Programas" em `/courses`, autoplay para a próxima aula/programa no `LessonView`. |
| Módulos | `course_modules`, `lessons.moduleId` | **legado, nenhuma tela ou query usa.** Não apagar sem conferir se há dados em produção. |

### Regras que não devem ser quebradas

- Um **grupo só aceita aulas do próprio curso** (validado no servidor em `create`, `update` e `addLessons`). O `CourseDetail` só mostra aulas do curso aberto, então aula de outro curso em um grupo some para o aluno. Para juntar cursos diferentes, usar Programas.
- No admin de grupos, cada aula mostra a etiqueta "rascunho" ou "outro curso" quando for o caso. Aula em rascunho não aparece para o aluno.
- `collections.getById` é público e **não pode devolver `videoPlaybackUrl`**. Para não-admin ele também oculta aulas não publicadas e programas inativos.
- A ordem dentro de um grupo vem de `lessons.order`. `courseGroupLessons.order` e `contentCollectionItems.order` existem, mas a ordem de Programas é própria (curadoria).

---

## 6. Assinaturas e controle de acesso

### Planos conhecidos

| Slug | Preço/mês | maxCourses | VR |
|---|---:|---:|---|
| `free` | R$0 | 1 | não |
| `basic` | R$49,90 | 3 | sim |
| `premium` | R$99,90 | ilimitado | sim |
| `vip` | R$299,90 | ilimitado | sim |

### Regra de acesso (`server/routers/videos.ts` → `checkUserHasAccess`)

```text
isAccessRestricted = 0  → todos acessam
isAccessRestricted = 1  → em ordem:
  1. coursePurchases (compra avulsa, status=completed) → libera sempre
  2. plano ativo (subscriptions com status 'active'; senão userSubscriptions):
     - premium/vip → libera tudo (cria matrícula automaticamente)
     - basic       → libera até maxCourses cursos pagos simultâneos
     - free/sem plano → sem acesso (só avulso)
```

Só `status = 'active'` libera. `paused`, `cancelled` e `expired` bloqueiam.

### ⚠️ Segurança — NUNCA reverter

`lessons.listByCourse` e `lessons.getById` (rotas públicas) verificam `checkUserHasAccess` no servidor e **removem** `videoPlaybackUrl`/`videoAssetId` da resposta de quem não tem acesso. Não usar `enrollments.checkEnrollment` como porta de acesso; usar `videos.hasAccess`. A mesma regra vale para qualquer rota nova que liste aulas (ex.: `collections.getById`).

### Regra administrativa

O admin ativa/desativa assinatura de qualquer usuário em `AdminManageSubscriptions.tsx` ou `AdminUsers.tsx`.

---

## 7. Pagamentos

A tela `/pricing` oferece os métodos que estiverem configurados (`subscriptions.paymentProviders`). Com só o Stripe, o fluxo é o de sempre. Com o Asaas configurado, abre uma janela para escolher.

### Stripe (cartão)

- Checkout: `subscriptions.createCheckout` (`server/stripe.ts`). API version `2026-01-28.clover`.
- Webhook: `POST /api/stripe/webhook` (`server/routes/stripe-webhook.ts`).
- Variáveis: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_BASICO`, `STRIPE_PRICE_PREMIUM`, `STRIPE_PRICE_VIP` (e `STRIPE_PROD_*`).

### Asaas (PIX, boleto e cartão)

**Variáveis (Render):**

```env
ASAAS_API_KEY=<chave>            # nunca no código nem no front
ASAAS_WEBHOOK_TOKEN=<aleatório>  # mesmo valor cadastrado no webhook do Asaas
ASAAS_BASE_URL=https://api.asaas.com/v3   # sandbox: https://api-sandbox.asaas.com/v3
```

Sem `ASAAS_API_KEY`, a opção Asaas não aparece e o webhook responde 401.

**Checkout** (`subscriptions.createAsaasCheckout`, `server/asaas.ts`): valida CPF/CNPJ, cria o cliente e uma assinatura mensal (`billingType: UNDEFINED`, o aluno escolhe PIX/boleto/cartão na fatura) e devolve o link da primeira cobrança. O preço vem de `subscription_plans.price` (centavos; fora da faixa de R$5 a R$10.000 cai no padrão e registra aviso). A assinatura leva `externalReference = user:<id>|plan:<slug>`. Um segundo clique reaproveita a assinatura pendente das últimas 24h. O checkout **não libera acesso**.

**Webhook** `POST /api/webhooks/asaas`: exige o header `asaas-access-token` igual a `ASAAS_WEBHOOK_TOKEN` (senão 401, inclusive se a variável não existir). Grava o evento pelo `id` (idempotência), responde 200 e processa depois. Eventos com erro ou travados são reprocessados quando o servidor sobe.

| Evento | Efeito |
|---|---|
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | libera o plano (`active`), registra o pagamento uma vez por cobrança; indicação só na primeira ativação |
| `PAYMENT_OVERDUE` | só registra `overdueSince`; a rotina pausa o acesso (`paused`) depois da carência (`ASAAS_GRACE_DAYS`, padrão 3); pagamento posterior reativa |
| `PAYMENT_REFUNDED` | marca a cobrança `refunded` e revoga (`free`/`cancelled`) |
| `PAYMENT_CHARGEBACK_REQUESTED` | revoga na hora |
| `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED` | revoga, **exceto** se o aluno cancelou a própria assinatura e ainda está no período pago |
| `PAYMENT_DELETED`, `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED` | só registra |

Decisões: assinatura Asaas cancelada **não derruba** plano ativo gerenciado pelo Stripe. Tabelas: `asaasAccounts` (usuário ↔ assinatura, com `overdueSince` e `remindersSent`) e `asaasWebhookEvents`.

**Forma de pagamento da assinatura:** o diálogo de planos oferece "Cartão de crédito" (`billingType: CREDIT_CARD`, renovação automática, primeira opção) e "PIX ou boleto" (`UNDEFINED`). **Confirmar no sandbox do Asaas** que as cobranças seguintes do cartão saem sozinhas a partir do link da fatura.

**Rotina periódica** (`runBillingMaintenance`, a cada 10 min a partir de 60s depois do boot, `server/_core/index.ts`): (1) pausa quem passou da carência sem pagar; (2) encerra o acesso de quem cancelou e chegou ao fim do período pago; (3) envia lembrete de pagamento não concluído por e-mail: o primeiro 1 h depois de gerar a cobrança e o segundo cerca de 6 h depois do primeiro (elegível 7 h após a criação), máx. 2, só enquanto a cobrança vale. Cada envio é reservado no banco antes, sem duplicar; se o e-mail falhar ou o aluno não tiver e-mail, a reserva é devolvida e a rotina tenta de novo na próxima rodada (commit `2e93a6e`).

**Cancelamento pelo aluno** (`subscriptions.cancelAsaas`, botão em "Minha assinatura"): remove a assinatura no Asaas e mantém o acesso até 30 dias depois do último pagamento confirmado (`subscriptions.endDate`, `autoRenew = 0`); sem período a cumprir, encerra na hora. Estorno e chargeback continuam revogando na hora.

### Teste pago de 1 aula (`server/trial.ts`, router `trial`)

Cobrança avulsa no Asaas (padrão **R$ 19,90**, pagamento único) que libera **uma aula** por **7 dias**. Depois disso o caminho é assinar; não há crédito nem abatimento.

- Opcionais no Render: `TRIAL_PRICE_CENTS` (500 a 20000, padrão 1990) e `TRIAL_VALID_DAYS` (1 a 60, padrão 7).
- **Só a aula de entrada de cada vitrine vende.** Vitrine = **Programa ativo** (é o que o aluno vê; os cursos de origem, como "Módulo 1" ou "Semana 3", ficam em rascunho de propósito) ou, fora de qualquer Programa, um curso publicado. A aula de entrada é a escolhida em `/admin` ("Definir como entrada", guardada por curso em `trialEntryLessons` e válida dentro do Programa) ou, sem escolha, a primeira aula **publicada, restrita (`isAccessRestricted = 1`) e com vídeo**, na ordem do Programa. Uma aula nunca aparece em duas vitrines. O card mostra o nome e a capa do Programa. Programa só com aulas grátis não gera entrada. **Não publicar os cursos-recipiente para fazer a promoção aparecer.**
- Um teste pago por aluno; quem já tem plano ou compra do curso não paga; trocar de aula antes de pagar cancela a cobrança pendente anterior.
- Cobrança leva `externalReference = trial:<userId>:<lessonId>` e o webhook a trata à parte (`processTrialEvent`): confirmação ativa o passe (`trialPasses`), valor menor que o preço não libera, estorno/chargeback revogam, OVERDUE/DELETED cancelam um passe ainda pendente. **O checkout nunca libera acesso.**
- `checkUserHasAccess(userId, { ..., id })` consulta o passe; o passe também dispensa a trava da trilha de aprendizado para aquela aula. Os quatro pontos que chamam `checkUserHasAccess` precisam passar `id` da aula.
- Home: seção `TrialOfferSection`, logo abaixo do bloco dos cursos, **visível para todos os visitantes**. Com Asaas configurado e ao menos uma aula de entrada, o botão "Quero experimentar" abre direto o diálogo de pagamento (`TrialPassDialog`) quando há uma só aula de entrada, ou desce para os cards quando há várias; cada card também abre o pagamento daquela aula. Quem não está logado vai antes para `/login`. Sem uma das duas coisas, o botão leva para `/courses`, os cards ficam ocultos e **só administradores** veem uma barra dourada dizendo o que falta (commits `b791b17` e seguinte).
- Aula bloqueada: botão "Assistir esta aula por R$ 19,90"; durante o teste, faixa com link para os planos.
- `TrialPassDialog`: a aba de pagamento é aberta no próprio clique (`window.open("about:blank")`) e só depois recebe o link da fatura, porque navegadores bloqueiam `window.open` depois de um `await`. Se a aba for bloqueada, o checkout segue na aba atual; em erro, a aba em branco é fechada (commit `1cc8480`).


### Funil do teste de 1 aula: correções de 24/10/2026 (campanha 804)

Diagnóstico com dados reais (Render: banco, logs): no primeiro dia da campanha 804 o anúncio trouxe dezenas de visitas (`/?utm_campaign=aula-19-90&fbclid=...`) e **zero** cadastros e cobranças. Três defeitos:

1. **O login perdia a compra.** Visitante sem conta clicava em "Quero experimentar", ia para `/login` e voltava em `/courses` (Google e e-mail redirecionam para lá). Agora `client/src/lib/trialIntent.ts` guarda a aula escolhida (1 h, `localStorage`), `RetomarCompraTeste` (montado no `App`) devolve o aluno logado para `/#experimente-uma-aula`, e a `TrialOfferSection` reabre o pagamento da mesma aula. Sem Asaas ou sem aula de entrada, a intenção é descartada (evita devolver o aluno à home em loop).
2. **Quem vem do anúncio via primeiro o banner genérico.** Com `utm_campaign` contendo `aula-19-90`, `?oferta` ou `#experimente-uma-aula`, a home rola sozinha até a oferta.
3. **O Asaas nunca avisou o site** (`asaasWebhookEvents` vazia; nenhum POST em `/api/webhooks/asaas`). Quem pagasse ficaria sem a aula. Correção definitiva é cadastrar o webhook no Asaas; enquanto isso, `conferirTestesPendentes` (em `trial.ts`, rodando no `runBillingMaintenance` a cada 10 min) consulta no Asaas as cobranças de teste pendentes dos últimos 10 dias e libera as pagas pelo mesmo `processTrialEvent` do webhook (idempotente; manda a compra para a Meta só na primeira ativação).

### Sincronização do financeiro (`server/financeSync.ts`, 24/10/2026)

O painel `/admin/financeiro` lê só `payment_history`, que só recebe o que os webhooks gravaram. Cobranças anteriores a cada fluxo gravar, webhooks que não chegaram (Render dormindo, token errado, Stripe sem corpo cru até 23/10) e eventos sem usuário vinculado ficavam fora. O botão **"Sincronizar com Asaas e Stripe"** (`subscriptions.syncPayments`, admin) lê `GET /payments` do Asaas e `invoices.list` do Stripe e faz upsert pela mesma chave dos webhooks (`asaas:<id>` e id da fatura), com a data real da cobrança.

- Dono da cobrança Asaas: `trial:<user>:<aula>` → `user:<id>` → assinatura em `asaasAccounts` → cliente em `asaasAccounts`. Stripe: assinatura em `subscriptions` → `metadata.user_id` → `stripeCustomerId` → e-mail. Sem dono, não grava e aparece como "sem aluno vinculado" no aviso.
- **Só mexe no financeiro.** Não libera nem revoga acesso; isso continua com os webhooks.
- Não rebaixa pagamento confirmado (regra de `upsertProviderPayment`). Rodar de novo é seguro.
- O painel ganhou o período "Todo o período" e "Mostrar mais" (antes cortava em 100 linhas).

**Cadastro do webhook no Asaas:** URL `https://shadiahasan-2ngl.onrender.com/api/webhooks/asaas`, API v3, envio sequencial, eventos da tabela acima. Teste antes no sandbox, com webhook separado. No plano gratuito do Render o serviço hiberna e o primeiro webhook pode dar timeout; o Asaas reenvia.

---

## 8. Capas dos cursos — "Motion Poster"

`OptimizedImage` aceita a prop `motion` (`"none"`, `"hover"`, `"always"`): zoom lento e brilho leve em CSS (`.motion-poster*` em `index.css`), desligado em `prefers-reduced-motion`. A prop `priority` carrega a imagem na hora (sem esperar o IntersectionObserver) e nunca deixa a capa invisível.

- `CourseDetail.tsx` usa `motion="always" priority`.
- `Courses.tsx` (grade) **no `main` não usa `OptimizedImage`**. A versão com `<OptimizedImage motion="hover" priority />` na capa ainda precisa ser publicada.
- Histórico: capas apareciam cinza no desktop em produção. Depois de qualquer ajuste nessa área, validar no desktop e no celular.

---

## 8.1 Sessão de login assinada (24/10/2026)

**Falha corrigida:** o cookie de sessão do login próprio (e-mail/senha, Google, convite de admin) era JSON puro, sem assinatura, e `sdk.authenticateRequest` aceitava qualquer cookie cujo `id` e `email` batessem com um usuário. Quem soubesse id e e-mail de um admin entrava como admin, sem senha. Agora é JWT HS256 (`server/_core/sessionCookie.ts`), assinado com `SESSION_SIGNING_SECRET` (criada no Render em 24/10; sem ela usa `JWT_SECRET`; chave com menos de 32 caracteres desativa o login em vez de aceitar sessão forjável). Cookies antigos deixaram de valer: todos fizeram login de novo uma vez. A rota REST `/api/auth/me` também passou a validar a assinatura. **Nunca voltar a aceitar cookie JSON.**

## 8.2 Domínio único: shadiahasan.com (24/10/2026)

O Google devolve o login em `shadiahasan-2ngl.onrender.com` (`GOOGLE_CALLBACK_URL`). A sessão nascia lá: o aluno ficava logado no endereço do Render e deslogado em shadiahasan.com, a compra guardada antes do login sumia (o navegador guarda por domínio), e no domínio do Render um service worker antigo servia versão velha do site, sem a faixa da promoção. Correção em `server/_core/canonicalHost.ts`:

- O callback do Google, no domínio técnico, emite um passe de 2 min (uso único) e redireciona para `https://shadiahasan.com/api/auth/handoff`, que cria a sessão no domínio do site.
- Páginas pedidas em `*.onrender.com` recebem 301 para o mesmo caminho em shadiahasan.com (com UTM). `/api/*` e POSTs continuam respondendo nos dois.
- `/sw.js` no domínio técnico é um service worker que limpa o cache, se desinstala e recarrega as abas.
- `CANONICAL_HOST` (opcional, padrão `shadiahasan.com`).

Melhor ainda: cadastrar `https://shadiahasan.com/api/auth/google/callback` no Google Cloud e trocar `GOOGLE_CALLBACK_URL` para ele; o passe continua funcionando como rede.

## 9. Variáveis de ambiente críticas

```env
# Banco
DATABASE_URL=<external_database_url>?sslmode=require

# Cloudflare Stream
CLOUDFLARE_ACCOUNT_ID=<id>
CLOUDFLARE_API_TOKEN=<token>
# opcionais (signed URLs)
CLOUDFLARE_SIGNING_KEY_ID=<id>
CLOUDFLARE_SIGNING_KEY_PEM=<pem>

# Stripe
STRIPE_SECRET_KEY=...  STRIPE_WEBHOOK_SECRET=...  STRIPE_PRICE_*=...

# Asaas
ASAAS_API_KEY=...  ASAAS_WEBHOOK_TOKEN=...  ASAAS_BASE_URL=...
# opcionais: carência no atraso (dias) e teste de 1 aula
ASAAS_GRACE_DAYS=3  TRIAL_PRICE_CENTS=1990  TRIAL_VALID_DAYS=7
# compra do teste sem conta (pagar primeiro); "off" volta ao login antes de pagar
TRIAL_GUEST_CHECKOUT=on
# GA4: compra enviada pelo servidor (Measurement Protocol). Sem a chave, vai pelo navegador.
GA4_API_SECRET=<chave secreta do Measurement Protocol>  GA4_MEASUREMENT_ID=G-DGCPN51SD6
```

`drizzle.config.ts` lê o `.env` local; `pnpm db:push` precisa de `DATABASE_URL`.

---

### Teste de 1 aula sem conta: "pagar primeiro, conta depois" (25/10/2026)

Motivo: campanha 804 levou ~25 visitantes à oferta e nenhum passou do login
(público 55+, navegador do app do Facebook, onde o Google bloqueia login).

- `server/trialGuest.ts`: compra pendente em `trialGuestCheckouts` (nome,
  e-mail, hash do CPF, token só em hash). Cobrança Asaas com
  `externalReference = trialguest:<compraId>:<aulaId>`. **Conta só nasce quando o
  pagamento é confirmado** (`materializarCompra`, chamada por `processTrialEvent`);
  daí em diante é o caminho normal do passe (financeiro, Meta CAPI).
- Limites contra robôs: 6/h por IP, 4/dia por CPF e por e-mail (memória) + 4/dia
  por CPF no banco.
- `trial.guestStatus`: tela `/compra/aguardando` consulta a cada 4 s; se pendente,
  pergunta ao Asaas na hora (não espera webhook nem os 10 min da manutenção).
  Mostra Pix copia e cola (`/payments/{id}/pixQrCode`) e a fatura como alternativa.
- Login automático só se a conta foi criada por esta compra e até 48 h após o
  pagamento. E-mail que já tinha conta **nunca** entra sozinho.
- Sessão provisória (`prov:1` no JWT, `sessaoValidaPara`): cai quando o e-mail é
  confirmado, uma senha é criada ou a conta entra com Google.
- E-mail pós-pagamento (`trialGuestEmail.ts`): link da aula + "criar senha"
  (token em `password_reset_tokens`, 7 dias). `resetPassword` agora marca
  `emailVerified=1`; `requestPasswordReset` aceita conta sem senha com
  `loginMethod=email`. Depende de `RESEND_API_KEY` válida.
- Desligar: `TRIAL_GUEST_CHECKOUT=off` no Render.

### Gráfico de acessos no Analytics (28/10/2026)

Pedido do Michel: gráfico com a quantidade de acessos usando Meta, GA4 e Clarity. Fica no topo de `/admin/analytics` (`client/src/components/AcessosChart.tsx`), lido por `trpc.acessos.porDia` (admin, 7/30/90 dias, cache de 5 min, botão atualizar). Lógica em `server/acessos.ts`.

As chaves que o site já tinha (`GA4_API_SECRET`, `META_CAPI_ACCESS_TOKEN`) só ENVIAM dados. Para LER, cada fonte pede credencial própria, todas opcionais. Sem ela a fonte aparece como "não conectada" com o nome da variável que falta, e as outras seguem normais.

| Fonte | Variáveis no Render | O que entrega |
|---|---|---|
| GA4 | `GA4_PROPERTY_ID` (número da propriedade), `GA4_SERVICE_ACCOUNT_JSON` (JSON da conta de serviço, puro ou em base64; o e-mail dela precisa ser Leitor na propriedade; Data API ligada no projeto Google) | usuários, sessões e visualizações por dia |
| Meta | `META_ADS_ACCOUNT_ID`, `META_ADS_ACCESS_TOKEN` (permissão `ads_read`; o token da API de Conversões não serve) | impressões, cliques no link e visitas à página (`landing_page_view`) por dia, só de anúncio |
| Clarity | `CLARITY_API_TOKEN` (Settings > Data Export) | sessões (sem robôs) e usuários |

Limites que o gráfico não esconde:
- **Clarity não tem série diária.** A API só devolve as últimas 24 h e aceita 10 chamadas por dia. `manterClarityEmDia` (a cada 3 h, agendado em `server/_core/index.ts`) grava um número por dia na tabela `analyticsClaritySnapshots`; o histórico começa na data da conexão.
- **GA4 e Clarity só contam quem aceitou cookies de análise** (LGPD): ficam abaixo do tráfego real. Meta conta só quem veio pelo anúncio.
- Token da Meta vai no cabeçalho `Authorization`, nunca na URL.
- Totais somam só métricas somáveis (sessões, visualizações, cliques); usuários únicos ficam só na linha do gráfico.
- Testes: `server/acessos.test.ts` (12). A parte do Clarity com banco foi testada à mão em Postgres local, não está na suíte.

### GA4 mais preciso (27/10/2026)

- `server/ga4.ts`: compra do teste vai ao GA4 pelo servidor quando o Asaas
  confirma (`enviarCompraParaGA4` em `processTrialEvent`, uma vez por cobrança,
  marca `trialPasses.ga4PurchaseSentAt`). Só com o client_id do cookie `_ga`
  enviado pelo navegador na compra (`client/src/lib/ga4Ids.ts`), que só existe
  com consentimento de análise. Anúncios sempre DENIED.
- Sem `GA4_API_SECRET`, a tela `/compra/aguardando` manda o `purchase` pelo
  navegador (`trial.info.ga4CompraPeloServidor` decide; nunca os dois).
- `user_id` do GA4 = id interno do aluno logado (nunca e-mail), em `Analytics.tsx`.
- `page_view` manual do GA4 removido: depende da medição otimizada
  ("mudanças de página com base no histórico") ligada no fluxo de dados.

## 10. Segurança e operação

- Nunca commitar tokens, senhas, JWTs ou arquivos de acesso.
- Nunca registrar chaves reais neste documento.
- Usar sempre a External Database URL do Render com `sslmode=require`.
- Não reverter a proteção que remove `videoPlaybackUrl` de respostas públicas (vale para aulas, programas e qualquer rota nova).
- Ausência de `CLOUDFLARE_SIGNING_KEY_*` não quebra playback (fallback público), mas signed URLs são o recomendado para produção.

---

## 11. Problemas conhecidos (abertos em 2026-10-23)

1. ~~Webhook do Stripe nunca validava~~ **Corrigido em 2026-10-23.** O `express.json()` rodava antes da rota `/api/stripe/webhook`, que precisa do corpo cru (resposta 400 "payload must be provided as a string or a Buffer"). Agora a rota é montada **antes** do `express.json()` em `server/_core/index.ts`. Não mover de volta. Verificado no servidor real: evento assinado → 200; assinatura inválida ou ausente → 400.
2. ~~Valores no webhook do Stripe~~ **Já corrigido** (commits 1dfef5f de 24/10 e 5fa7428 de 27/10): `invoice.paid` grava `invoice.amount_paid` e a falha grava `invoice.amount_due`, ambos em centavos e sem dividir; o checkout concluído grava `amount_total`. Conferido no código em 31/10/2026. O `amount: 0` que ainda aparece em `stripe-webhook.ts` é de transação de pontos de indicação, não de pagamento.
3. **`pnpm check` com 17 erros de tipo no `main`** (Analytics, AdminAppointments, AdminCollections, CourseDetail, Courses, LessonView, materials). Parte das correções feitas localmente pode não ter sido publicada. Não barra o build.
4. **Capas cinza no desktop:** confirmar em produção após publicar o `Courses.tsx` atualizado.
5. **Render:** houve quedas cerca de 60s depois da subida (`ELIFECYCLE`). Falta o stack trace anterior à linha do `ELIFECYCLE` para diagnosticar.

---

## 12. Pendências

### Publicado em 2026-10-23 (`main`)

| Commit | O que entrou |
|---|---|
| `6d46f8e` | teste pago de 1 aula via Asaas (R$ 19,90), `server/trial.ts`, router `trial` |
| `d07bcd3` | aula de entrada por curso, seção na home, carência no atraso, lembretes, cancelamento pelo aluno |
| `b791b17` | pré-visualização da faixa de oferta para administradores |
| `2e93a6e` | lembretes de pagamento com nova tentativa em falha de envio |
| `1cc8480` | janela de pagamento do teste não é mais bloqueada pelo navegador |

Estado em produção (atualizado em 01/11/2026): `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` estão no Render, o webhook está cadastrado e a chave é de produção (agente `Asaas_Prod`). Uma compra real de R$ 19,90 por PIX em 29/10 foi validada de ponta a ponta (ver "Validação de pagamentos em produção (31/10/2026)").

### Já concluído

- [x] ativar/desativar assinatura para qualquer usuário no admin
- [x] manifest HLS do Cloudflare e upload grande via TUS
- [x] sincronização de duração e vídeos pendentes
- [x] ordenar cursos e aulas (drag & drop + ↑↓), duplicar e ações em lote
- [x] agrupamento: grupos só do próprio curso, cascata ao excluir, cópia de grupos ao duplicar, `collections.getById` sem URL de vídeo
- [x] pagamento via Asaas (PIX, boleto, cartão) com webhook idempotente
- [x] webhook do Stripe passou a receber o corpo cru (rota montada antes do `express.json()`)

### Ainda pendente

- [x] valores gravados pelo webhook do Stripe (item 11.2): já corrigido em 24/10 e conferido em 31/10
- [ ] primeira assinatura de plano paga de verdade em produção, acompanhada de ponta a ponta (nenhuma existe até hoje)
- [ ] vídeos: ligar URL assinada, fechar o vazamento do endereço nas listas de aulas e marca d'água com o e-mail (ver "Auditoria 01/11/2026")
- [ ] UI no admin para `courses.allowIndividualPurchase` e preço avulso
- [ ] checkout de pagamento único (Stripe e/ou Asaas) para compra avulsa de curso
- [ ] revisar aula 1 com `videoProvider` inconsistente (`cloudflare` vs YouTube)
- [ ] remover scripts de debug soltos na raiz (`*.py`, `*.mjs`)
- [ ] remover do git `chaveJWT.txt` e `SENHA_RENDER-ARQUIVOS.txt`
- [ ] atualizar o `README.md` principal (ainda cita MySQL e Manus OAuth; o real é Postgres e Google OAuth)
- [ ] decidir o destino de `course_modules`/`lessons.moduleId` (legado)
- [ ] unificar financeiro/admin na mesma fonte de verdade de assinaturas
- [ ] roteiro futuro de gestão: módulos/seções, quizzes, materiais, desfazer/refazer, virtualização de listas, favoritos/arquivamento

---

## 13. Ordem recomendada para próximas manutenções

1. ~~valores do webhook do Stripe~~ (corrigido, ver 11.2). **Continua em aberto:** nenhuma assinatura de plano foi paga em produção até hoje (ver "Validação de pagamentos em produção (31/10/2026)"); a primeira cobrança real de plano precisa ser acompanhada de ponta a ponta;
2. ~~Asaas~~ **validado em produção em 29/10/2026** (webhook com token, chave de produção, compra de R$ 19,90 por PIX ativando o passe). Detalhes na seção abaixo.
3. publicar o `Courses.tsx` com `OptimizedImage` (`motion`/`priority`) e conferir as capas no desktop;
4. fechar os erros de `pnpm check` e deixar o comando em zero;
5. compra avulsa (UI + checkout);
6. limpeza do repositório (scripts de debug, arquivos sensíveis, README).

## Vídeo-convite da Shadia na oferta de 1 aula (27/10/2026)
- `client/src/components/ConviteShadiaVideo.tsx`, dentro de `TrialOfferSection` entre a oferta e os cards (só quando `canBuy`).
- Mesmo vídeo do anúncio em vídeo da campanha 804. Termina com "clica no botão abaixo e escolha o seu tema": o botão "Escolher meu tema" rola até `#aulas-de-entrada`, cujo título passou a ser "Escolha o seu tema".
- Sem autoplay: até o play só baixa a capa (`/midia/shadia-convite-capa.jpg`, ~55 KB); o vídeo 720p (`/midia/shadia-convite-720.mp4`, ~7 MB) carrega no toque. Eventos GA4 `video_play` e `video_complete`.
- `/midia/anuncio-shadia-aula.mp4` (1080x1920, 15 MB) existe só para a Meta buscar por URL ao criar o anúncio; não é usado na página.
- 27/10/2026: o aviso flutuante "Instale o app" (`InstallAppButton mode="floating"` em App.tsx) foi removido a pedido, para a página da oferta ficar limpa. A instalação continua no cabeçalho (botão no desktop e item no menu do celular).
- 27/10/2026: ordem da seção da oferta refeita: título com o preço ("Experimente uma aula por R$ 19,90") → vídeo da Shadia → preço grande + "Escolher meu tema" → cards "Escolha o seu tema" → garantias. Saiu o bloco antigo com o segundo preço grande e o botão "Quero experimentar" (fica só quando não há compra possível, levando a /courses). Com uma única aula de entrada, "Escolher meu tema" abre o pagamento direto.

## E-mails: visual da marca, avisos de assinatura e caixa contato@ (27/10/2026)

**DNS (Cloudflare, zona shadiahasan.com):** DKIM `resend._domainkey`, `send` (MX + SPF), `_dmarc` e **MX @ → inbound-smtp.sa-east-1.amazonaws.com (10)**. Envio verificado no Resend (conta mixavier31). Antes não havia MX: contato@ não recebia nada.

**Layout único** (`server/_core/emailLayout.ts`): azul #0B3354, verde #23686C, papel #F5F2EC, título em serifa, logo em `client/public/email/logo-email.png`, assinatura "Shadia Hasan · Psicóloga · CRP 12/27052". Todo envio leva versão em texto e `replyTo` = `EMAIL_CONTATO` (padrão contato@shadiahasan.com): resposta do aluno cai na caixa do admin.

**Avisos automáticos** (`server/emailAvisos.ts`), uma vez por fato via tabela `emailAvisosEnviados` (chave reservada antes do envio, desfeita se falhar):

| Fato | Onde | Chave |
|---|---|---|
| Assinatura ativada (1ª cobrança) | Asaas `activate`, Stripe `invoice.paid` subscription_create | `pago:asaas:<payment>` / `pago:stripe:<invoice>` |
| Pagamento recebido / acesso voltou | idem, renovação ou volta de pausa | mesma chave (CONFIRMED+RECEIVED = 1 e-mail) |
| Mensalidade em aberto | Asaas `PAYMENT_OVERDUE`, Stripe `invoice.payment_failed` (só renovação) | `atraso:...` |
| Acesso pausado | `pauseOverdueAccounts` | `pausa:asaas:<conta>:<dia do atraso>` |
| Cancelamento pelo aluno | `cancelAsaasSubscription` | `cancelamento:asaas:<assinatura>` |
| Fim do período / estorno | `endCancelledSubscriptions`, `PAYMENT_REFUNDED`, Stripe `subscription.deleted` | `fim:...` / `estorno:...` |

Chargeback não gera e-mail. Opcional: `EMAIL_AVISOS_ADMIN` recebe "[Painel] Nova assinatura" e "Mensagem nova em contato@" (não pode ser o próprio contato@, senão vira laço).

**Caixa de e-mail** `/admin/emails` (`server/caixaEmail.ts`, `server/routers/caixaEmail.ts`, `client/src/pages/AdminEmails.tsx`): Entrada, Arquivadas, Enviados, Lixeira; responder (cita original, sai de contato@ com assinatura), encaminhar (passthrough com anexos), escrever novo, anexos por link gerado na hora, "Buscar novas" (lista no Resend o que o webhook não entregou, ex.: Render dormindo). Tabelas `emailRecebidos` / `emailEnviados`, criadas sozinhas na primeira chamada (também no `drizzle/schema.ts`). HTML recebido abre em iframe sandbox sem scripts.

**Webhook** `POST /api/webhooks/resend` (evento `email.received`, cadastrado no Resend em 27/10), montado **antes** do `express.json()`. Valida assinatura se `RESEND_WEBHOOK_SECRET` existir; sem ela funciona, porque o conteúdo é sempre buscado na API do Resend pelo id.

Variáveis: `RESEND_API_KEY` (obrigatória), `RESEND_WEBHOOK_SECRET` (signing secret do webhook no Resend), `EMAIL_CONTATO`, `EMAIL_CONTATO_REMETENTE`, `EMAIL_AVISOS_ADMIN`, `EMAIL_CAIXA_DOMINIO`, `FROM_EMAIL`, `SITE_URL` (padrão agora `https://shadiahasan.com`).

Pendência vista: FAQ cita WhatsApp 47 99142-6662 e o resto do site 47 99166-5536. (O `shadiahasan.club` do SEO foi corrigido em 31/10, ver "SEO e domínio".)

### Caixas por setor (27/10/2026)

Tabela `emailCaixas` (`endereco` = parte antes do @, `nome`, `nomeRemetente`, `copiaPara`, `padrao`). O MX aponta para o Resend, que aceita qualquer endereço @shadiahasan.com: criar caixa nova (financeiro@, rh@, ti@, diretoria@...) é só no painel, sem DNS. A mensagem entra na caixa do destinatário (aceita `setor+algo@`); sem correspondência, vai para a padrão (criada sozinha como contato@ na primeira subida, e adota as mensagens antigas). Resposta e e-mail novo saem do endereço da caixa, com o nome do setor na assinatura (a padrão assina como a psicóloga). `copiaPara` encaminha tudo que chega (com anexos) para um e-mail fora do domínio; dentro do domínio é recusado para não virar laço. Excluir caixa move as mensagens para a padrão; a padrão não pode ser excluída. Endereços reservados: noreply, no-reply, postmaster, abuse, mailer-daemon, bounce(s), send. Ainda não há permissão por caixa: todo admin vê todas.

## Auditoria: compra de R$ 19,90 sem login por quem já tem conta (27/10/2026)

Testado de ponta a ponta com Postgres local (`server/trialGuest.vinculo.test.ts`, roda com `TEST_DATABASE_URL`) e servidor rodando. Já funcionava: mesmo e-mail, maiúsculas/espaços, CONFIRMED+RECEIVED (1 passe, 1 lançamento), webhook e conferência ao mesmo tempo (sem conta duplicada). Corrigido:

1. **Gmail com/sem pontos criava conta duplicada.** Compra com `mariasilva@gmail.com` e conta Google `maria.silva@gmail.com` (mesma caixa) → a aula caía numa conta nova e o login com Google abria a outra. Agora `server/emailConta.ts` (`encontrarContaPorEmail`) acha a conta sem diferença de maiúscula e, só no Gmail/googlemail, ignorando pontos e `+etiqueta`. Usado em `materializarCompra`, na checagem "já tem conta" do checkout e no login com Google (`findOrCreateUserByProvider`).
2. **Já logado na conta certa, a tela pedia para entrar de novo.** `guestStatus` só considerava logado quem a compra tinha criado. Agora compara com o dono da compra (`donoId`).
3. **Conta Google + navegador do Facebook = sem como entrar.** Conta existente nunca entra sozinha (segurança), e lá o Google bloqueia o login. Agora o e-mail "Sua aula está liberada" leva um **link de acesso de uso único** (`server/linkDeAcesso.ts`, tabela `linksDeAcesso`, 7 dias; reenvio 24 h). `GET /api/auth/link` só mostra um botão e o `POST` entra (antivírus de e-mail que abrem links não gastam o link). Sessão normal, marca o e-mail como confirmado. Tela de pagamento confirmado: "Enviar de novo" (`trial.guestEnviarLink`, 3/h por compra), "Entrar com Google e assistir" (some no navegador do Facebook) e "Entrar com e-mail e senha".
4. **Depois do login a pessoa caía em /courses, não na aula.** `/login?next=/lesson/12` e `/api/auth/google?next=...` (vai no `state` do OAuth, porque o callback cai no domínio do Render). Só caminhos internos (`destinoSeguro`).
5. **Tela de entrar:** "Entrar sem senha (link no e-mail)" (`POST /api/auth/enviar-link`, resposta igual com ou sem conta, 3/h por e-mail, 10/h por IP) e aviso no navegador do Facebook/Instagram.
6. `createCheckout` usava `shadiahasan.club` como origem padrão; agora `.com`.

Continua por desenho: quem digita o e-mail de OUTRA pessoa paga a aula para a conta dela (o e-mail é a identidade). A tela mostra o e-mail mascarado para conferir antes de pagar.
- 28/10/2026: aviso de venda do teste de 1 aula. Na primeira ativação do passe (`processTrialEvent`, depois de `concluirCompra`), `avisarVendaAoAdmin` manda e-mail "[Painel] Venda confirmada: R$ 19,90" para `EMAIL_AVISOS_ADMIN` com aluno, aula, forma de pagamento, origem (UTM) e id da cobrança. Assinaturas novas já avisavam por `emailAvisos.ts`.

## Certificados: por aula e geral por Programa (30/10/2026)

Antes: existia só a tabela `certificates` e a mutation `certificates.generate`, que nenhuma tela chamava; não havia PDF nem página de verificação, e o link "Compartilhar" dava erro. Pedido do Michel: "um por aula e um geral".

**Regras** (`server/certificados.ts`, tabela nova `certificadosEmitidos`, criada em tempo de execução):
- **Certificado de aula:** emitido quando a aula cumpre os TRÊS requisitos (decisão do Michel, 31/10/2026): (1) assistida, 80% do tempo medido pelo servidor; (2) 3 perguntas ou exercícios da aula respondidos; (3) depoimento do curso, depois das respostas. Um por aluno e aula.
- **Certificado geral:** emitido quando TODAS as aulas publicadas de um Programa ativo (`contentCollections`). Programa com menos de 2 aulas não gera o geral. Um por aluno e Programa.
- **Anti-fraude (acesso):** o servidor só aceita a aula se ela é publicada, é do curso informado e o aluno tem acesso hoje (`checkUserHasAccess`: assinatura, compra ou teste de 1 aula dentro da validade). Mandar ids de aulas que não pode assistir não gera certificado. 
- **Número** `SH-AAAA-XXXXXXXX` aleatório (não dá para adivinhar o de outro aluno). O formato antigo `SH-<data>-<aluno>-<curso>` é recusado.
- **Nome impresso** é o do perfil na hora de baixar o PDF. Só sai com nome completo (`analisarNome`: nome e sobrenome, só letras, sem e-mail ou número; TUDO MAIÚSCULO ou tudo minúsculo é corrigido para "Maria Aparecida de Souza"). Nome incompleto: o botão de baixar fica desligado, a página mostra o cartão "Confirme seu nome completo" e o PDF responde 409. O aluno confirma ou corrige em `/certificates` (`certificados.salvarNome` grava em `users.name`, o mesmo nome do perfil). Não imprimimos CPF (LGPD).

**Onde dispara:** `enrollments.updateProgress` (server/routers.ts) compara as aulas concluídas antes e depois, emite e devolve `certificadosNovos`; `LessonView` mostra o aviso "Você ganhou o certificado desta aula" com botão para ver. Quem já tinha aulas concluídas antes recebe os atrasados ao abrir `/certificates` (`certificados.sincronizar`, idempotente, cada aula só vale no curso em que foi marcada).

**Peças:**
- PDF A4 paisagem (`server/certificadoPdf.ts`) no modelo de referência enviado pela Shadia (30/10/2026): fundo branco, moldura dupla azul vetorial, fita e árvore à esquerda e ramo no canto superior direito (`server/assets/certificado-arte.jpg`, extraída da referência), logo real com fundo transparente (`server/assets/logo-certificado.png`), título "Certificado de Conclusão", nome em azul, bloco de assinatura "Shadia Hasan" + identificação do certificado, shadiahasan.com e QR de verificação. Cormorant Garamond e Inter embutidas dos pacotes `@fontsource`. **Carga horária** só aparece quando todas as aulas envolvidas têm `lessons.duration` (segundos); aula = duração dela, Programa = soma das publicadas (`duracaoDoCertificado`). Sem registro profissional. Arquivos lidos de `process.cwd()/server/assets` (no Render o cwd é a raiz do repositório). Libs novas: `pdfkit`, `qrcode`.
- `GET /api/certificados/<numero>.pdf` (`server/routes/certificados.ts`): só o dono ou admin; visitante 401, outro aluno 404.
- `/certificado/<numero>` (`CertificadoVerificar.tsx`): pública, noindex, mostra aluno, aula ou Programa, data e número (nunca e-mail).
- `/certificates` (`MyCertificates.tsx`): gerais primeiro, depois por aula; baixar PDF, copiar link, ver verificação. Minha Área lista os 5 mais recentes.
- tRPC `certificados.meus | salvarNome | sincronizar | verificar`. Cadastro (`Signup`, compra sem conta) pede "Nome completo" e, na compra, exige nome e sobrenome.

**Limites e pendências:**
- A tabela e a mutation antigas (`certificates`, `certificates.generate`) continuam no código sem uso; a seção de certificados de `Profile.tsx` ainda lê a antiga e fica vazia.
- Não há e-mail ao ganhar certificado (só o aviso na aula e a página).
- Se o Programa mudar depois (aula nova publicada), quem já tem o geral continua com ele; quem não tem passa a precisar da aula nova.
- Mononímia: quem tem nome de uma palavra só não consegue baixar (o certificado exige nome e sobrenome). Se aparecer o caso, afrouxar `analisarNome`.
- Testes: `server/certificados.test.ts` (15, regras, nome e PDF). O fluxo com banco e a rota do PDF foram testados à mão em Postgres local (emissão, fraude, backfill, dono/admin/visitante/outro aluno), não estão na suíte.

### Auditoria 31/10/2026: certificado só depois de assistir

**Achado:** o certificado era emitido a partir de `enrollments.completedLessons`, lista enviada pelo navegador em `enrollments.updateProgress`. Dava para ganhar certificado (de aula e geral do Programa) sem assistir: (1) arrastando a barra do vídeo até o fim (o player marca conclusão com posição > 90%), ou (2) chamando a API na mão com os ids de todas as aulas a que o aluno tem acesso. O geral também usava a lista do navegador para decidir se o Programa fechou.

**Correção (`server/assistido.ts`, tabela `aulaAssistida`, criada em tempo de execução):**
- O player (`VideoPlayer` nativo/HLS e YouTube, com handshake `listening`) conta só avanço contínuo de reprodução (pular a barra, pausar e voltar não contam) e `useAssistido` manda o total a cada ~15 s (`certificados.registrarAssistido`).
- O servidor limita cada envio pelo tempo real desde o anterior (até 2,1x de velocidade), teto de 40 s por envio e 20 s no primeiro. Rajada de chamadas rende ~0. Linha travada na transação: duas abas não contam em dobro.
- A aula só vale com 80% da duração acumulada (`MIN_FRACAO`). Duração = `lessons.duration`; sem ela usa a informada pelo player, entre 30 s e 6 h.
- `emitirParaAulas` filtra pelas aulas assistidas e o geral do Programa só fecha com todas assistidas. `completedLessons` continua existindo, mas só para o progresso na tela. O envio que fecha os 80% já emite e avisa na aula.
- Acesso: `registrarAssistido` exige acesso à aula (`validarAulas`), senão FORBIDDEN.

**Limites conhecidos:** quem automatizar um navegador e esperar o tempo real (>= ~38% da duração a 2x) ainda passa; não há prova de atenção, só de tempo tocado. Aula sem `duration` cadastrada depende da duração que o player informa (preencher `duration` fecha esse buraco). Quem concluiu aulas antes desta regra não recebe certificado retroativo: precisa assistir de novo (80%). Certificados emitidos antes de 31/10 pelo backfill (`sincronizar`) continuam no banco; em 31/10 eram 6 de aula, de 1 aluno, emitidos no mesmo segundo. Revogar é decisão do Michel.
**Testes:** `server/assistido.test.ts` (6, regras puras). O fluxo com banco (forja via updateProgress/sincronizar, rajada, sem acesso, aula sem duração, geral do Programa) foi testado em Postgres local, não está na suíte.

### Requisitos: 3 perguntas + depoimento (31/10/2026) e revogação

**Regra** (`server/requisitos.ts`): aula libera certificado com assistida (80%) + pelo menos 3 respostas + depoimento do curso. Perguntas são as de `aulaPerguntas` publicadas mais os `lessonExercises` publicados da aula (resposta em `exerciseResponses` conta). Aula com menos de 3 itens publicados ainda não gera certificado (a tela do aluno diz que as perguntas estão sendo preparadas). Resposta válida: 30+ caracteres, 4+ palavras, 3+ palavras diferentes (barra "aaaa" e "ok"). Responder exige ter assistido; o depoimento exige as 3 respostas (`certificados.enviarDepoimento`). O depoimento é um por curso (tabela `testimonials`, entra como pendente na moderação) e vale para todas as aulas do curso: depois do primeiro, as outras aulas só pedem assistir + 3 respostas. Rejeitado na moderação ainda conta como feito. O geral do Programa exige todas as aulas dele liberadas.

**Perguntas (Shadia):** `/admin/perguntas` (menu "Perguntas"): lista as aulas por curso com selo Pronta/Revisar/Sem perguntas, editor com publicar/despublicar, excluir (só sem respostas) e "Publicar todas". Na primeira criação da tabela o sistema deixou 3 rascunhos-modelo por aula, NÃO publicados (genéricos de propósito; a Shadia ajusta ao conteúdo). "Criar rascunhos nas aulas sem perguntas" refaz isso para aulas novas. Enquanto uma aula não tiver 3 publicadas, ninguém ganha o certificado dela.

**Aluno:** cartão "Certificado desta aula" (`CertificadoPassos`) na página da aula: 1 assistir (barra de progresso), 2 responder as perguntas, 3 depoimento com autorização de publicação; ao fechar, botão para os certificados. Endpoints: `certificados.passos | responder | enviarDepoimento`; admin: `adminResumo | adminPerguntas | adminSalvarPergunta | adminExcluirPergunta | adminCriarRascunhos`.

**Revogação:** `certificadosEmitidos` ganhou `revogadoEm` e `motivoRevogacao`. Na primeira subida com este código (coluna ainda inexistente) todos os certificados que já estavam emitidos são revogados, uma única vez (em produção eram 6, de 1 aluno, emitidos pelo preenchimento automático). A linha é mantida (nada é apagado); revogado some da lista, do PDF e da verificação pública (aparece como "não encontrado"). Os índices únicos agora ignoram revogados, então o aluno pode ganhar o certificado de novo cumprindo os requisitos.

**Testes:** `server/requisitos.test.ts` (5, regras puras). O fluxo completo em Postgres local (revogação da tabela antiga, rascunhos, publicar, respostas válidas e inválidas, depoimento antes da hora recusado, sincronizar e updateProgress forjados, aula 2 e geral, excluir pergunta respondida) passou, mas não está na suíte.

### Auditoria 31/10/2026: vídeo inicia e para de exibir

**Estrutura:** aula protegida (41 das 42 publicadas, todas no Cloudflare Stream) -> `videos.getPlaybackUrl` (checa acesso e trilha) -> `resolveVideoUrl` -> `generateSignedStreamUrl` (JWT RS256, validade 1 h, token no caminho: `customer-xxx.cloudflarestream.com/<token>/manifest/video.m3u8`) -> `VideoPlayer` (hls.js). O vídeo sai direto do Cloudflare para o navegador, sem passar pelo Render. Maior aula: 37 min. Não há CSP no site que bloqueie o Cloudflare.

**Causas encontradas (confirmadas em navegador, com HLS local):**
1. **O player era destruído e recriado a cada renderização da página da aula.** O efeito do HLS dependia de `onProgress` e `onComplete`, que são funções novas a cada renderização do `LessonView` (dependem de `updateProgressMutation` e outros objetos recriados). Qualquer atualização da página (consulta, mutação, contagem regressiva, ao passar de 90% e gravar o progresso) fazia `hls.destroy()` + novo `loadSource`, voltando ao início ou deixando a tela parada. No teste: 15 recargas em 14 s e o vídeo nunca saiu do segundo 0. A regra de "assistido" (31/10, 2cd8f19) piorou, porque o envio a cada 15 s também re-renderiza a aula.
2. **Link vencido não era tratado.** O token vale 1 h e o link muda a cada pedido (`exp` novo). Link vencido fazia o hls.js tentar de novo por ~1 min, sem erro na tela, e o vídeo parava no fim do que já tinha carregado. Qualquer erro fatal ainda derrubava o player (`hls.destroy()`) sem tentar recuperar.
3. A consulta do link também era refeita ao reconectar/remontar, e cada link novo (string diferente) recriava o player.

**Correção:** `VideoPlayer` guarda funções e fonte em refs e só recria o player quando muda o vídeo (`chaveDoManifesto`, `client/src/lib/videoChave.ts`: ignora o token). Link novo do mesmo vídeo troca a fonte e continua do mesmo ponto. 401/403 ou falha sem código (recusa sem CORS) pedem link novo na hora (`onPrecisaNovaUrl`, até 3 vezes). Rede tenta de novo (até 5), erro de mídia se recupera (`recoverMediaError`). O `LessonView` renova o link a cada 40 min e não pede de novo à toa. Teste (Chromium + HLS VP9 local): com re-renderização a cada 1 s o vídeo tocou contínuo; troca de token no meio continuou de 11,7 s para 12,2 s; com o token "vencendo" aos 5 s o vídeo passou dos 36 s (onde antes parava) e seguiu.

**Não coberto:** YouTube (iframe, outro caminho); Safari/iOS (player HLS nativo): só a renovação por erro de rede foi tratada, não testei em Safari; não verifiquei se as chaves `CLOUDFLARE_SIGNING_KEY_*` estão no Render (sem elas o código cai no manifesto público e, com "Require signed URLs" ligado no Stream, o vídeo nem iniciaria).

### SEO e domínio (31/10/2026)

**Achado:** `sitemap.xml` e `robots.txt` eram arquivos estáticos de `client/public` apontando para `shadiahasan.club` (domínio antigo), com só 7 páginas fixas (sem cursos nem programas). `SEOHead` e `Breadcrumbs` usavam `.club` em canonical, og:url e trilha, o `og:image` apontava para um arquivo que não existia, e só a home tinha título/descrição próprios (todas as outras páginas herdavam o título do `index.html`). Fallbacks de origem do checkout (`routers.ts` x3, `subscriptions.ts` x2, `admin.ts` x1) também usavam `.club`.

**Correção:**
- `server/_core/seo.ts`: `GET /robots.txt` e `GET /sitemap.xml` gerados na hora, montados antes do `serveStatic` (os arquivos estáticos foram removidos). Endereço base = `urlCanonica()` (`CANONICAL_HOST`, padrão `shadiahasan.com`; de propósito NÃO usa `SITE_URL`, que em produção pode ainda estar com o domínio antigo). O sitemap lista as páginas fixas (home, courses, pricing, about, faq, contact, privacy, terms; sem login/cadastro) + cursos com `isPublished = 1` + programas (`contentCollections`) com `isActive = 1`. Cache de 10 min em memória; se o banco falhar, sai só com as fixas. `robots.txt` bloqueia admin, área logada, aulas, checkout e `/api/`.
- Os fallbacks de origem usam `urlCanonica()`. Mantido de propósito: `admin@shadiahasan.club` em `seed-superadmin.ts` (é identidade de conta, trocar quebraria login).
- Cliente: `client/src/lib/site.ts` (`SITE_URL`, `OG_IMAGE`, `urlAbsoluta`), `SEOHead` com canonical da própria página (antes sempre a home) e prop `noindex`, `SEOHead` agora em Courses, Pricing, About, Contact, FAQ, Terms, Privacy, CourseDetail (título e descrição do curso) e CollectionDetail. Mapa de textos: `client/src/lib/seo-meta-tags.ts` (entradas novas /pricing, /terms, /privacy).
- Dados estruturados (`client/src/lib/jsonld.ts`): Organization + WebSite no `index.html` estático (o teste `jsonld.test.ts` garante que bate com as funções), Course em cada curso (só emite com nome e descrição), FAQPage em /faq, BreadcrumbList já existente. `JsonLd.tsx` usa `<script>` direto, sem Helmet.
- Meta tags estáticas do `index.html` ganharam `data-rh="true"`: o Helmet substitui em vez de duplicar (antes saíam duas `description` e duas `og:image`). Páginas sem SEOHead (ex.: /ebooks) mantêm as estáticas.
- `client/public/og-image.jpg` (1200x630, logo oficial sobre fundo branco). `vite.config.ts`: `/sitemap.xml` e `/robots.txt` fora do `navigateFallback` do service worker.

**Verificado:** testes `server/seo.test.ts` (7) e `client/src/lib/jsonld.test.ts` (7); sitemap contra Postgres local (curso rascunho e programa inativo ficam de fora); `<head>` real de /, /faq, /courses, /courses/:slug, /ebooks em Chromium (um título, uma descrição, um canonical, um og:image por página).

**Limites:** o app é SPA, então WhatsApp/Facebook (que não executam JavaScript) sempre mostram as meta tags estáticas da home ao compartilhar um curso; só o Google vê as de cada página. Resolver isso exige injetar as tags no servidor por URL (não feito). Depois do deploy, enviar `https://shadiahasan.com/sitemap.xml` no Google Search Console e pedir inspeção da home. Se `SITE_URL` no Render ainda estiver com `.club`, e-mails e links que usam essa variável continuam com o domínio antigo (o código novo de SEO não depende dela).

### E-mail marketing: autorização, cancelamento e campanhas (31/10/2026)

**Achado:** o formulário da home (`LeadCapture`) prometia "acesso imediato a uma aula gratuita", mas só gravava o e-mail em `leads` (produção: 0 linhas): não enviava nada, não existe aula gratuita no site, não pedia autorização e não havia como sair da lista. Mandar oferta assim contraria a LGPD (a própria `/privacy` declara consentimento como base dos e-mails promocionais) e prejudica a reputação do domínio.

**Regras (`server/marketing.ts`):**
- Só entra quem marca a caixa "Quero receber novidades, conteúdos e ofertas..." (nunca vem marcada). Aparece na home, no cadastro (`Signup`) e na compra da aula experimental (`GuestCheckoutDialog`). Cliente antigo NÃO é importado: a autorização precisa ser da pessoa.
- Dupla confirmação em toda origem: a pessoa só fica "ativa" depois de clicar no link enviado ao e-mail (nenhum formulário prova que o e-mail é de quem digitou). O link abre uma tela com botão; só o POST confirma (antivírus e leitores de e-mail abrem links sozinhos).
- Tabela `marketingContatos` (criada em tempo de execução): e-mail único, origem (`home`/`cadastro`/`compra-aula`), token, `consentimentoEm`, `consentimentoTexto` (versão do texto lido, hoje `2026-10-31`), `confirmadoEm`, `descadastradoEm`. Ativo = confirmado e sem cancelamento. O texto da caixa existe no cliente (`client/src/lib/consentimento.ts`) e no servidor (`TEXTO_CONSENTIMENTO`); um teste garante que são iguais. Mudou o texto, mude a versão.
- Cancelar: `GET /api/marketing/sair?t=` mostra botão, `POST` cancela (idempotente). O POST também aceita o cancelamento de um clique do Gmail/Apple Mail (cabeçalho `List-Unsubscribe-Post`). Quem cancelou e se inscreve de novo precisa confirmar de novo. Reenvio do e-mail de confirmação: 1 a cada 10 min por endereço, e 6/h por IP; a resposta da tela é igual exista o e-mail ou não.
- E-mails de conta e pagamento (verificação, senha, cobrança) são transacionais e continuam saindo para quem cancelou o marketing.

**Campanhas (`server/marketingEnvio.ts`, tela `/admin/campanhas`, menu "Campanhas"):** nome interno, assunto, texto (parágrafos por linha em branco; o e-mail já abre com "Olá, [primeiro nome]." e fecha com assinatura e link de cancelar), botão opcional (só http/https), público por origem e "somente quem ainda não assina" (olha `user_subscriptions` active/trialing/past_due e `subscriptions` com plano pago). Prévia ao vivo, "Enviar teste para mim" (assunto com [TESTE]) e confirmação antes do envio. Envio em segundo plano, lotes de 50 pela API batch do Resend (pausa de 700 ms), com `List-Unsubscribe` em cada mensagem. Cada destinatário é uma linha em `marketingEnvios` (chave campanha+contato): ninguém recebe duas vezes, quem cancela no meio do envio sai da fila (`ignorado`), lote que falha é refeito um a um, linha "processando" parada volta à fila ao retomar, "Parar envio", "Continuar envio" (servidor reiniciou) e "Tentar de novo" (erros). Só rascunho pode ser editado ou excluído. Status "Não enviada" quando todos deram erro e "Enviada com erros" quando parte falhou.

**Testes:** `server/marketing.test.ts` (17) e `client/src/lib/consentimento.test.ts` (2). Fluxo completo em Postgres local (fora da suíte, passou): inscrição, confirmação, cancelamento, nova inscrição após cancelar, segmentos com e sem assinatura nos dois sistemas, envio sem repetir ninguém, cancelamento no meio do envio, queda de rede num lote, reenvio de erros, parar, retomada após reinício, público vazio e as páginas públicas (GET não muda nada, POST muda, token inválido). No navegador: caixa desmarcada e botão só libera com e-mail + autorização, confirmação em duas etapas, editor, prévia, teste, confirmação de envio e acompanhamento.

**Pendências / limites:**
- A sequência automática de boas-vindas existe (seção abaixo). Falta apenas uma segunda sequência, se a Shadia quiser (ex.: pós-compra).
- `leads.capture` (tRPC público) continua existindo e gravando em `leads`, mas nenhuma tela chama mais. Pode ser removido.
- O limite diário do plano do Resend vale para as campanhas (erros aparecem na tela do envio). Conferir o plano antes de listas grandes.
- Os 3 compradores de aula que já existem em `trialGuestCheckouts` não estão na lista (não houve autorização); entram se comprarem de novo marcando a caixa.
- `users.marketingEmails` (preferência do perfil) continua sem uso; a fonte da verdade é `marketingContatos`.
- WhatsApp: não implementado. Exige a API oficial da Meta (modelos aprovados, número validado, cobrança por conversa).
- Para a home ter uma isca de verdade (aula gratuita ou e-book), alguém precisa definir qual conteúdo será entregue; hoje o formulário só promete novidades.

### Sequência automática de boas-vindas (31/10/2026)

**O que é:** série de e-mails enviada sozinha a quem confirma a inscrição, em intervalos de dias. Aba "Sequência de boas-vindas" em `/admin/campanhas`. Código: `server/marketingSequencia.ts`, router `marketing.sequencia / salvarSequencia / ativarSequencia`, tela `client/src/components/SequenciaEmail.tsx`.

**Regras (todas cobertas por teste):**
- Nasce PAUSADA, com 3 rascunhos escritos para a Shadia revisar (boas-vindas no mesmo dia; "uma forma de começar" +3 dias; "qual plano combina" +4 dias). Sem preços e sem prometer gratuidade. Nada sai até alguém clicar em "Ativar sequência" (há confirmação na tela).
- Só entra quem confirmou a inscrição DEPOIS da primeira ativação (`confirmadoEm >= ativadaEm`). Quem já estava na lista nunca recebe a série: a autorização foi dada para novidades, não para uma sequência. Pausar e reativar mantém a data da primeira ativação; quem confirmou durante a pausa entra ao retomar.
- Cada e-mail sai `diasDepois` dias depois do anterior (o primeiro, depois da confirmação). Só entre 8h e 20h de Brasília; fora disso espera.
- Cancelou a inscrição: a série dela para na hora. Cada e-mail leva o link de cancelar e o `List-Unsubscribe` de um clique.
- E-mail marcado "não enviar a quem já assina" é registrado como `ignorado` e a série segue para o próximo; os rascunhos 2 e 3 usam isso.
- Falha de envio: nova tentativa depois de 1 h, até 3 tentativas; na terceira vira `falhou` e a série daquela pessoa para (não manda os próximos).
- Sem duplicidade: a reserva do envio é um `INSERT ... ON CONFLICT DO UPDATE WHERE` que só retoma `erro` com mais de 1 h ou `processando` com mais de 10 min. Três rodadas simultâneas enviam uma única vez. Roda a cada 5 min (primeira após 90 s) a partir de `server/_core/index.ts`.
- Edição: dá para mudar assunto, texto, botão, intervalo e a marca de "já assina", adicionar até 8 e-mails e remover. Apagar um e-mail que já foi enviado a alguém é recusado (o histórico não some). Mudança vale para quem ainda não recebeu aquele e-mail.
- Tabelas criadas em tempo de execução: `marketingSequencias`, `marketingSequenciaPassos`, `marketingSequenciaEnvios` (chave contato+passo).

**Testes:** `server/marketingSequencia.test.ts` (10: janela de horário, validação, rascunhos, descrição dos prazos). Fluxo com tempo simulado em Postgres local (fora da suíte, 30 verificações, passou): criação idempotente, pausada não envia, lista antiga não entra, intervalos de 3 e 4 dias, janela 8h-20h, cancelamento, pulo para quem assina, erro/nova tentativa/parada, rodadas simultâneas, edição, bloqueio de remoção, pausa e retomada. Tela no Chromium (desktop e celular): editar, prévia, adicionar, remover, ativar, pausar.

**Antes de ativar em produção:** a Shadia lê os 3 textos, manda um teste de cada para si e confere botões e links. Observação sobre a ativação: o relógio da série começa na confirmação de cada pessoa, então ativar de manhã ou à noite não muda nada para quem já se inscreveu antes.

### Validação de pagamentos em produção (31/10/2026)

Conferido com consulta somente leitura no Postgres de produção e nos logs do Render.

**Asaas (teste de 1 aula, R$ 19,90): funciona de ponta a ponta.**
- Compra por PIX em 29/10 (cobrança paga às 16:20): `trialGuestCheckouts` = paid, `trialPasses` = active (7 dias), `payment_history` = completed, R$ 19,90.
- O webhook `POST /api/webhooks/asaas` responde 200 para o agente `Asaas_Prod` (chave de produção) em 28 e 29/10. A confirmação das 16:20:56 chegou por ele e ativou o passe na sequência. Logo `ASAAS_WEBHOOK_TOKEN` e o cadastro do webhook estão certos.
- Uma venda real, uma só. Cartão e boleto ainda não passaram por compra real.

**Assinaturas de plano: nunca foram pagas em produção.** `user_subscriptions` está vazia e não há linha de Stripe em `payment_history`. As 3 linhas ativas em `subscriptions` são antigas (jun a ago), sem Stripe. Portanto não existe assinatura paga "órfã" de antes de 23/10 para ativar. A primeira cobrança real de plano (Stripe ou Asaas) deve ser acompanhada: financeiro, e-mail de aviso, ativação.

**Sobras de teste (sem efeito prático):** 4 linhas de `payment_history` (R$ 79,60 no total) seguem `pending` com `providerStatus = OVERDUE`; o financeiro as mostra como "Atrasado". Passes 1 e 2 (23 e 24/10) seguem `pending` por terem sido criados antes do roteamento do teste; a compra nova cancela passes pendentes antigos, então não bloqueiam ninguém. Desenho atual: cobrança vencida fica `pending` e só `PAYMENT_DELETED` vira `failed`.

**Indisponibilidade em 29/10:** o último log do serviço antes da parada foi `ELIFECYCLE Command failed` às 06:39 (UTC); de 07:54 a 11:54 o Asaas recebeu 503 em 8 tentativas do webhook (reenvio de hora em hora, sem perda: a cobrança vencida de 28/10 foi processada às 12:54) e o serviço só voltou às 12:08 com deploy de gatilho `service_resumed`. Plano Starter (sempre ligado), hoje sem suspensão. Sem `healthCheckPath` configurado no Render, um processo travado não é reiniciado sozinho. Recomendação (feita no painel do Render, não no código): definir um health check apontando para uma rota leve que consulte o banco.

### Funil Google Ads + autoavaliação + lista de e-mails (31/10/2026)

**Ideia:** o Google não entrega o e-mail de quem pesquisou. O caminho é anúncio de Pesquisa, página com uma isca, cadastro com autorização e acompanhamento por e-mail. Os passos de cadastro, confirmação, cancelamento e sequência já existiam; faltavam a isca e a página de entrada. A campanha no Google Ads NÃO foi criada (a conta não está conectada e envolve verba): está planejada abaixo.

**Página `/autoavaliacao`** (`client/src/pages/Autoavaliacao.tsx`, conteúdo e cálculo em `shared/autoavaliacao.ts`, endpoint `marketing.inscreverAutoavaliacao`):
- 8 situações do dia a dia, 4 respostas cada, uma por padrão de comunicação: guarda para si, fala com clareza, fala com força, diz sem dizer. A posição da resposta de cada padrão varia entre as perguntas. Resultado principal (empate desempata na ordem claro, evita, indireto, forte) e um segundo padrão só se tiver 3 respostas ou mais.
- O resultado aparece NA HORA, sem pedir e-mail. O convite de receber por e-mail vem depois. A autorização de marketing nunca é condição para ver o resultado (consentimento amarrado a benefício não é livre, LGPD). Custo: converte menos que travar o resultado atrás do e-mail; em troca, o contato que chega é de melhor qualidade e o risco jurídico é menor.
- Não é teste psicológico nem diagnóstico, e o texto diz isso. Teste psicológico é instrumento validado e de uso do profissional, então a página evita chamar isto de teste. Vale a Shadia conferir com o CRP se a forma como a página e os anúncios se apresentam está de acordo com as regras de publicidade da profissão (não verificado aqui). Os 8 cenários e os 4 textos de resultado são RASCUNHOS escritos por mim para a Shadia revisar.
- O servidor recalcula o perfil das respostas (não confia no que o navegador manda) e grava só o perfil, não as respostas. Nova origem `autoavaliacao` em `marketingContatos` ("Autoavaliação (anúncios)" nas campanhas), mesma dupla confirmação das outras.
- Colunas novas em `marketingContatos` (criadas por `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` na subida, sem mexer nos dados): `perfil`, `utmSource`, `utmCampaign`, `utmTerm`, gravadas só na primeira vez. Servem para medir quanto cada campanha e palavra-chave do Google traz de contatos. O e-mail de confirmação desta origem leva o resultado e o assunto "Seu resultado e a confirmação da sua inscrição".
- `/autoavaliacao` está no sitemap. A home (`LeadCapture`) ganhou um link para a página.
- Testes: `server/autoavaliacao.test.ts` (8). No navegador contra Postgres local com a tabela ANTIGA de contatos: colunas criadas, 8 perguntas, resultado, botão travado sem a caixa (que vem desmarcada), contato gravado com perfil e UTMs, pendente de confirmação.

**Medir custo por contato (SQL, somente leitura):**
```sql
SELECT "utmCampaign", "utmTerm", COUNT(*) AS cadastros, COUNT("confirmadoEm") AS confirmados
FROM "marketingContatos" WHERE "origem" = 'autoavaliacao'
GROUP BY 1, 2 ORDER BY confirmados DESC;
```
Custo por contato confirmado = gasto da campanha no Google Ads dividido por `confirmados`. Contato que não confirma não recebe nada e não conta.

**Plano da campanha (a criar no Google Ads, não criada):**
- Tipo: Pesquisa, objetivo Leads, rede de pesquisa sem parceiros de exibição, localização Brasil, idioma português.
- URL final: `https://shadiahasan.com/autoavaliacao?utm_source=google&utm_medium=cpc&utm_campaign=comunicacao-pesquisa&utm_term={keyword}`.
- Conversão: importar do GA4 o evento `generate_lead` (já disparado em `trackLead("autoavaliacao")`, depende de o GA4 estar vinculado ao Google Ads). Contar uma conversão por clique.
- Palavras-chave, começar em correspondência de frase e exata (sem ampla): "como se comunicar melhor", "comunicação assertiva", "como falar sem brigar", "dificuldade de comunicação no relacionamento", "como dizer não sem culpa", "como conversar sobre assuntos difíceis", "comunicação emocional".
- Negativas de partida: pdf, download, emprego, vaga, faculdade, tcc, resumo, slides, frases, memes, imagens, wikipedia, gratuito certificado, apostila, redação.
- Anúncio responsivo (limites 30 e 90 caracteres conferidos). Títulos: "Como Falar Sem Brigar", "Comunicação Assertiva", "Seu Jeito de Se Comunicar", "Autoavaliação em 2 Minutos", "Resultado na Hora", "Psicóloga Shadia Hasan", "Conversas Difíceis", "Aprenda a Dizer o que Sente", "Dizer Não Sem Culpa", "Descubra Seu Padrão". Descrições: "Responda 8 situações do dia a dia e veja como você age em conflitos. Resultado na hora." / "Elaborada pela psicóloga Shadia Hasan. Sem cadastro para ver o resultado." / "Entenda se você guarda, explode ou dá indiretas. E veja um primeiro passo prático." / "Convite à reflexão, não é diagnóstico. Leva 2 minutos e funciona no celular."
- Sem promessa de resultado nem de tratamento nos anúncios. Conferir as regras de publicidade do CRP e a política de serviços de saúde do Google antes de ativar.
- Verba: começar baixa, com teto diário, e olhar custo por contato confirmado depois de uns 7 a 10 dias. Não há valor recomendado aqui porque o custo por clique real só se conhece depois de rodar.

**Pendências:**
- A Shadia revisar as 8 situações e os 4 resultados; ela pode mudar tudo em `shared/autoavaliacao.ts`.
- A sequência de boas-vindas (ainda pausada) vale para quem confirmar vindo daqui. O primeiro e-mail dela não menciona o resultado da autoavaliação; dá para criar uma sequência por perfil usando a coluna `perfil`.
- Quem já está na lista e refaz a autoavaliação não recebe e-mail com o resultado (só vê na tela), porque a confirmação só é enviada a quem ainda não está ativo.
- Conectar a conta do Google Ads (Windsor ou outro) para acompanhar o gasto junto dos cadastros.

### Auditoria 01/11/2026: link da aula vinculado ao e-mail logado

**Pergunta:** dá para vincular o link da aula ao e-mail de quem está logado? Resultado de leitura do código, dados de produção (somente leitura) e logs do Render. Nada foi alterado no código.

**Já vinculado à conta:**
- A página `/lesson/ID` não libera nada por si: o servidor decide por usuário (`videos.getPlaybackUrl` aplica `checkUserHasAccess`, passe de 1 aula e liberação da trilha).
- O link de acesso por e-mail (`server/linkDeAcesso.ts`) tem `userId`, token guardado só como hash, uso único, validade de 7 dias e destino só interno. O GET mostra um botão e só o POST entra (antivírus de e-mail não gasta o link). Limite conhecido: quem tiver o e-mail encaminhado e usar o link antes da dona entra na conta dela, como em qualquer link mágico; e o POST substitui a sessão que já estiver aberta.

**Não vinculado (achados):**
1. Em produção NÃO há `CLOUDFLARE_SIGNING_KEY_ID`/`PEM`: o log repete "não configurados, retornando manifest público". `generateSignedStreamUrl` cai no fallback e devolve o manifest público (não expira, não exige login). Das 42 aulas em Cloudflare, 41 são restritas (`isAccessRestricted = 1`) e 1 é livre; todas têm `videoPlaybackUrl` público gravado.
2. Os vídeos aceitam endereço sem assinatura (inferido: tocam hoje por ele). `setSignedUrlRequired` (`cloudflare-stream.ts`) existe, mas nada a chama.
3. `lessons.listByCourse` e `lessons.getById` (`server/routers.ts`) devolvem `videoPlaybackUrl` a quem tem acesso comercial ao curso, SEM olhar a liberação da trilha (essa checagem só existe em `getPlaybackUrl`). Quem abre o inspetor consegue o endereço de aulas ainda bloqueadas e o link vale para sempre. O player (`LessonView.tsx`) usa `playbackData?.url || lesson?.videoPlaybackUrl`, e o cadeado da lista de aulas usa `!l.videoPlaybackUrl`: fechar o vazamento exige mexer nesses dois pontos.

**O que o Cloudflare permite:** o token (JWT RS256 com `sub`, `kid`, `exp`) não valida e-mail. Dá para limitar expiração e, com `accessRules`, país ou IP. IP é arriscado (IPv4/IPv6 ou Wi-Fi/4G mudam o IP e o aluno fica sem vídeo; testar antes). O vínculo que funciona na prática é visível: marca d'água com o e-mail do aluno no player.

**Plano recomendado (não executado):** (1) criar a Signing Key no Cloudflare e colocar `CLOUDFLARE_SIGNING_KEY_ID` e `CLOUDFLARE_SIGNING_KEY_PEM` no Render, testar uma aula e só então ligar a exigência de assinatura nos 41 vídeos (o endereço antigo deixa de funcionar); (2) parar de devolver `videoPlaybackUrl` nas duas listas e fazer o player usar só `getPlaybackUrl`, trocando o cadeado por `videos.hasAccess`; (3) marca d'água com o e-mail em posição que muda. Outras opções: limite de sessões simultâneas por conta (hoje a sessão é um cookie assinado de 1 ano, sem registro no servidor).

### Minha Área do aluno (30/10/2026, commit 7c90a1f)

Rota `/minha-area` (`client/src/pages/MinhaArea.tsx`, `server/areaAluno.ts`, router `areaAluno`, atalho em `UserMenu`). Junta o que o aluno comprou e pode assistir: **acesso** (plano ativo e testes de 1 aula: ativos, aguardando pagamento, vencidos, expirados), **cursos** (matrículas e o curso de cada teste, com progresso e "continuar"), **compras** (histórico de pagamentos com status legível e link quando ainda dá para pagar) e **certificados**. `montarAreaAluno` é pura e testada (`server/areaAluno.test.ts`); `carregarAreaAluno` só lê o banco. Nada nessa tela libera acesso: quem libera é o webhook do Asaas e `checkUserHasAccess`. É o destino padrão do link de acesso por e-mail (`DESTINO_PADRAO = "/minha-area"`) e da volta do checkout.

### E-mails por setor: Atendimento, Financeiro e Psicóloga (30/10/2026, commits 4699d9b e 214f9b8)

Cada e-mail automático diz quem fala (`server/_core/emailLayout.ts`, tipo `Departamento`): **Psicóloga** (só a Shadia, 1ª pessoa, com CRP: boas-vindas e conteúdo, incluindo as mensagens de marketing), **Atendimento ao aluno** (conta e acesso: confirmar e-mail, senha, link de acesso, aula liberada) e **Financeiro** (cobrança, pagamento, assinatura, atraso, pausa, cancelamento, estorno). O setor define o nome do remetente ("Shadia Hasan · Financeiro"), a etiqueta acima do título, a assinatura, o rodapé e o responder-para (`financeiro@` para o Financeiro). Setores falam no plural ("recebemos") e nunca levam o CRP. Assinatura única com nome, CRP, WhatsApp, e-mail, site e Instagram (`CONTATOS`); logo com largura e altura fixas e texto alternativo estilizado; rodapé com Minha Área, perguntas frequentes e política de privacidade. Testes em `server/email.templates.test.ts`.

### Acentos quebrados nos planos (30/10/2026, commit d96694b)

Os planos estavam gravados com UTF-8 lido como Latin-1 ("BÃ¡sico"). `shared/acentos.ts` (`consertarAcentos`, `consertarPlano`, `temAcentoQuebrado`) conserta só sequências de mojibake (texto correto, como "COMUNICAÇÃO", passa intacto). Os planos saem corrigidos na leitura (`server/db.ts`) e o banco é corrigido de vez na subida do servidor (`consertarPlanosNoBanco` em `server/textoCorrigido.ts`, idempotente). Minha Área também passa os textos por `consertarAcentos`. Testes em `server/textoCorrigido.test.ts`.

### Login: contraste no celular e Google em destaque (01/11/2026, commit 3cf13ba, PR #15)

`client/src/pages/Login.tsx`: campos e botões com fundo claro fixo no modo escuro do celular (antes ficavam ilegíveis), botão do Google em destaque e o botão "Continuar com Apple" removido da tela. Só a tela mudou; a rota do servidor `/api/auth/apple` não foi tocada neste commit. O acesso por link enviado ao e-mail continua disponível na mesma tela.

