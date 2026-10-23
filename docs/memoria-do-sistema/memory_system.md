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

`courseGroups`, `courseGroupLessons`, `contentCollections*`, `asaasAccounts` e `asaasWebhookEvents` têm `CREATE TABLE IF NOT EXISTS` no próprio router/módulo (autocorreção), além de estarem em `drizzle/schema.ts`. Funciona com ou sem `pnpm db:push`.

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
| `PAYMENT_OVERDUE` | pausa o acesso (`paused`); pagamento posterior reativa |
| `PAYMENT_REFUNDED` | marca a cobrança `refunded` e revoga (`free`/`cancelled`) |
| `PAYMENT_CHARGEBACK_REQUESTED`, `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED` | revoga |
| `PAYMENT_DELETED`, `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED` | só registra |

Decisões: não há carência configurável (o Asaas marca vencida no dia seguinte ao vencimento); assinatura Asaas cancelada **não derruba** plano ativo gerenciado pelo Stripe. Tabelas: `asaasAccounts` (usuário ↔ assinatura) e `asaasWebhookEvents`.

**Cadastro do webhook no Asaas:** URL `https://shadiahasan-2ngl.onrender.com/api/webhooks/asaas`, API v3, envio sequencial, eventos da tabela acima. Teste antes no sandbox, com webhook separado. No plano gratuito do Render o serviço hiberna e o primeiro webhook pode dar timeout; o Asaas reenvia.

---

## 8. Capas dos cursos — "Motion Poster"

`OptimizedImage` aceita a prop `motion` (`"none"`, `"hover"`, `"always"`): zoom lento e brilho leve em CSS (`.motion-poster*` em `index.css`), desligado em `prefers-reduced-motion`. A prop `priority` carrega a imagem na hora (sem esperar o IntersectionObserver) e nunca deixa a capa invisível.

- `CourseDetail.tsx` usa `motion="always" priority`.
- `Courses.tsx` (grade) **no `main` não usa `OptimizedImage`**. A versão com `<OptimizedImage motion="hover" priority />` na capa ainda precisa ser publicada.
- Histórico: capas apareciam cinza no desktop em produção. Depois de qualquer ajuste nessa área, validar no desktop e no celular.

---

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
```

`drizzle.config.ts` lê o `.env` local; `pnpm db:push` precisa de `DATABASE_URL`.

---

## 10. Segurança e operação

- Nunca commitar tokens, senhas, JWTs ou arquivos de acesso.
- Nunca registrar chaves reais neste documento.
- Usar sempre a External Database URL do Render com `sslmode=require`.
- Não reverter a proteção que remove `videoPlaybackUrl` de respostas públicas (vale para aulas, programas e qualquer rota nova).
- Ausência de `CLOUDFLARE_SIGNING_KEY_*` não quebra playback (fallback público), mas signed URLs são o recomendado para produção.

---

## 11. Problemas conhecidos (abertos em 2026-10-23)

1. **Webhook do Stripe provavelmente nunca valida.** O `server/_core/index.ts` aplica `express.json()` antes de montar `/api/stripe/webhook`, e a rota precisa do corpo cru. Reproduzido em teste local: com `express.json()` antes, a resposta é 400 "payload must be provided as a string or a Buffer"; sem ele, 200. Correção: montar a rota do Stripe **antes** do `express.json()`. Conferir nos logs do Render por "Falha na verificação da assinatura".
2. **Valores no webhook do Stripe:** a ativação grava `amount: 0`; a falha divide por 100 sendo que o financeiro já divide (valor sai 100x menor).
3. **`pnpm check` com 17 erros de tipo no `main`** (Analytics, AdminAppointments, AdminCollections, CourseDetail, Courses, LessonView, materials). Parte das correções feitas localmente pode não ter sido publicada. Não barra o build.
4. **Capas cinza no desktop:** confirmar em produção após publicar o `Courses.tsx` atualizado.
5. **Render:** houve quedas cerca de 60s depois da subida (`ELIFECYCLE`). Falta o stack trace anterior à linha do `ELIFECYCLE` para diagnosticar.

---

## 12. Pendências

### Já concluído

- [x] ativar/desativar assinatura para qualquer usuário no admin
- [x] manifest HLS do Cloudflare e upload grande via TUS
- [x] sincronização de duração e vídeos pendentes
- [x] ordenar cursos e aulas (drag & drop + ↑↓), duplicar e ações em lote
- [x] agrupamento: grupos só do próprio curso, cascata ao excluir, cópia de grupos ao duplicar, `collections.getById` sem URL de vídeo
- [x] pagamento via Asaas (PIX, boleto, cartão) com webhook idempotente

### Ainda pendente

- [ ] corrigir a ordem do `express.json()` x webhook do Stripe (item 11.1)
- [ ] corrigir valores gravados pelo webhook do Stripe (item 11.2)
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

1. corrigir o webhook do Stripe (11.1 e 11.2) e validar uma assinatura real de ponta a ponta;
2. cadastrar as variáveis do Asaas, testar no sandbox e só então usar a chave de produção;
3. publicar o `Courses.tsx` com `OptimizedImage` (`motion`/`priority`) e conferir as capas no desktop;
4. fechar os erros de `pnpm check` e deixar o comando em zero;
5. compra avulsa (UI + checkout);
6. limpeza do repositório (scripts de debug, arquivos sensíveis, README).
