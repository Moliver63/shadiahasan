# Auditoria — Campanha 804 (Meta Ads) e rastreamento de compra

Data da apuração: 25/10/2026, 12:20 UTC.
Período analisado: 18/10 a 25/10/2026.
Serviço: `srv-d7cedcosfn5c73cevgqg` · Banco: `shadia-db` (`dpg-d7ci5vn7f7vs739gel50-a`).

Documento de acompanhamento (linguagem não técnica, compartilhado):
https://claude.ai/artifact/BFNYMDyYVvKNKQpoK7p93j

---

## 1. Resumo

Três camadas de rastreamento de compra. Uma funciona, duas estão desligadas,
e a segunda depende da primeira:

| Camada | Estado | Bloqueio |
| --- | --- | --- |
| Pixel no navegador (PageView / LPV) | Funciona | — |
| Webhook do Asaas | Nunca disparou | URL/token no painel do Asaas |
| Evento `Purchase` via CAPI | No-op silencioso | `META_PIXEL_ID` e `META_CAPI_ACCESS_TOKEN` ausentes no Render |

Nenhuma compra de terceiro aconteceu até agora. O gargalo atual não é o
pagamento nem o rastreamento: é que nenhum visitante chega ao checkout.

## 2. Números (7 dias, R$ 6/dia)

| Etapa | Quantidade |
| --- | --- |
| Impressões | 3.340 |
| Cliques no link | 83 |
| Visualizações da página | 31 |
| Checkouts iniciados por terceiros | 0 |
| Compras pagas | 0 |

Gasto: R$ 10,49. Entrega concentrada no Feed do Facebook em celular
(3.299 de 3.340 impressões).

## 3. Confusão de medição — importante para leituras futuras

Duas mudanças entraram na mesma janela de análise:

| Quando (UTC) | Mudança |
| --- | --- |
| 24/10 14:25 | Deploy `753416b` — pixel movido para o `<head>`, code splitting |
| 25/10 00:55 | Segmentação do ad set `120250140183970375`: 18-65 → 45-65+ |

Visualização de página é **medida pelo próprio pixel**. Antes do deploy, o
pixel era injetado por `useEffect` e só nascia após ~890 kB de JS — ver o
cabeçalho de `server/pixelCarregamento.test.ts`, que documenta 19 cliques no
link para 1 visualização (5,26%) em 24/10.

Consequência: a queda do custo por visualização de página de R$ 0,366 para
R$ 0,300, e a subida da taxa de visualização de 31,58% para 50%, **não podem
ser atribuídas à mudança de faixa etária**. São, em boa parte, medição melhor.

O que se sustenta: a mudança de idade pegou. Nas 10 horas seguintes, a faixa
abaixo de 45 anos recebeu 6 impressões em 1.285 (0,47%) e R$ 0,02 de gasto,
contra R$ 0,63 sem nenhuma visualização antes.

Para separar os efeitos é preciso comparar períodos inteiramente posteriores
a 24/10 14:25.

## 4. Webhook do Asaas — evidências de que nunca disparou

Rota: `POST /api/webhooks/asaas` (`server/routes/asaas-webhook.ts`),
autenticada pelo header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`.

1. `asaasWebhookEvents` tem zero linhas.
2. Nenhum POST para esse caminho nos logs de 20/10 a 25/10. Os únicos acessos
   são GET de navegador e crawler, que caem no fallback da SPA e respondem
   200 com ~107 KB de HTML — ou seja, uma validação de URL por GET parece
   bem-sucedida sem o endpoint ter sido exercitado.
3. Três cobranças criadas (23, 24 e 25/10) e nenhum `PAYMENT_CREATED` chegou.

Indício de URL malformada: acesso a `/api/webhooks/asaas%60` em 24/10 18:00
(crase no fim, típico de cópia de bloco markdown). Conferir o valor salvo
no painel.

Efeito: o acesso do comprador é liberado por webhook. Sem ele, compra paga
não libera a aula automaticamente. A rotina de conferência de cobranças
pendentes introduzida em `1789101` é rede de segurança, não substituto —
roda por intervalo, não no momento do pagamento.

## 5. CAPI — no-op por projeto

`server/metaCapi.ts` exige `META_PIXEL_ID` e `META_CAPI_ACCESS_TOKEN`.
Sem elas, `capiConfigurado()` é falso e `enviarCompra()` retorna sem enviar.
A decisão é correta — o acesso do aluno não pode depender de rastreamento —
mas tem um efeito colateral de diagnóstico:

> Nos relatórios, "nenhuma compra aconteceu" e "o rastreamento está desligado"
> produzem o mesmo número: zero.

Não há sinal no painel que distinga os dois casos. A conferência tem de ser
feita em `course_purchases` e `payment_history`.

**Sugestão:** um aviso de inicialização quando `capiConfigurado()` for falso,
ou uma linha no diagnóstico admin. Hoje o desligamento é invisível.

## 6. Correção de atribuição — registro de um erro cometido nesta análise

O checkout de 25/10 09:19 UTC foi inicialmente classificado como primeira
compra real, com base no IP divergir do IP administrativo habitual. **Estava
errado.** O registro era um teste interno: nome e e-mail do próprio operador,
com transposições de letras no domínio. O IP divergente era iCloud Private
Relay (faixa 172.225.x.x), que troca o endereço de saída e mascara a
localização.

Regra para análises futuras: IP divergente não prova terceiro. Confirmar nome
e e-mail contra as contas internas conhecidas antes de declarar urgência.
Localização não é inferível de IP sob Private Relay, VPN ou CGNAT.

## 7. Achado colateral — validação de e-mail

O campo de e-mail do checkout aceita qualquer texto com arroba. Um domínio
digitado errado faz a cobrança ser criada normalmente e o e-mail com o link
da aula voltar como não entregue: a pessoa paga e não recebe acesso.

Para público 50+ digitando em celular dentro do navegador do app do Facebook,
isso vai acontecer. Sugestão: checagem dos domínios mais errados
(`gamil.com`, `gmai.com`, `hotmai.com`, `outlok.com`) sugerindo correção antes
do envio.

## 8. Pendências, em ordem de dependência

1. Cadastrar chave Pix na conta do Asaas. Verificação: fatura de teste exibe
   opção Pix.
2. Registrar `https://shadiahasan.com/api/webhooks/asaas` no painel do Asaas
   com o header `asaas-access-token`. Verificação: `asaasWebhookEvents`
   deixa de estar vazia.
3. Definir `META_PIXEL_ID` e `META_CAPI_ACCESS_TOKEN` no Render.
   Verificação: `Purchase` visível no Gerenciador de Eventos.
4. Investigar por que nenhum visitante chega ao checkout. 31 visualizações
   de página, zero formulários. Validar a página em celular, dentro do
   navegador do app do Facebook.
