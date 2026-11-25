# TikTok Pixel e Events API (25/11/2026)

## O que o site envia ao TikTok

| Evento | Origem | Quando |
|---|---|---|
| PageView | Pixel (navegador) | Entrada e cada troca de rota, só com consentimento |
| ViewContent | Pixel (navegador) | Mesmo gatilho do ViewContent da Meta (`trackViewContent`) |
| InitiateCheckout | Pixel (navegador) | Mesmo gatilho da Meta (`trackInitiateCheckout`), com o mesmo `event_id` |
| Purchase | Events API (servidor) | Só depois do webhook do Asaas confirmar o pagamento |

O navegador nunca dispara Purchase no TikTok (há teste de código-fonte garantindo isso). Assim a mesma compra não chega por duas fontes, e Pix/boleto pagos sem voltar ao site também contam.

## Idempotência (nenhuma compra em duplicidade)

1. `event_id` = id da cobrança no Asaas. PAYMENT_CONFIRMED e PAYMENT_RECEIVED compartilham o id.
2. Tabela `tiktokPurchases` (uma linha por cobrança): reserva atômica (`claimedAt`) antes de enviar, `sentAt` depois do aceite. Duas execuções simultâneas enviam uma vez só; recusa do TikTok libera a reserva para nova tentativa.
3. Só a primeira ativação dispara (mesma regra da Meta e do GA4).

## LGPD

- Pixel e envio só existem com consentimento de cookies de análise (mesma chave `cookie-consent` do GA4 e da Meta). O texto do banner cita o TikTok Pixel.
- `ttclid` fica só em memória até a pessoa aceitar. Sem aceite, o navegador não manda `ttclid`, `_ttp` nem a marca `tiktokConsent`.
- O servidor só grava atribuição (e portanto só envia) quando `tiktokConsent === true`. Sem registro, nenhum dado vai ao TikTok.
- E-mail, telefone e id do aluno vão com SHA-256. `ttclid`, `_ttp`, IP e user-agent vão sem hash, como a especificação exige.
- Quem aceita e depois recusa: o Pixel chama `disableCookie`, o navegador deixa de enviar o que era do TikTok e o servidor deixa de receber a marca de consentimento.

## Preservação do rastreamento existente

Meta Pixel, Meta CAPI e GA4 não foram alterados (os testes `metaCapi`, `ga4`, `pixelCarregamento` e `metaAttribution` seguem passando). O TikTok entra ao lado, em chamadas separadas.

## Variáveis (Render, nunca no código)

| Variável | Onde | Para quê |
|---|---|---|
| `VITE_TIKTOK_PIXEL_ID` | build do cliente | Código do Pixel. Sem ela o Pixel não existe |
| `TIKTOK_PIXEL_ID` | servidor | Mesmo código do Pixel |
| `TIKTOK_EVENTS_ACCESS_TOKEN` | servidor | Token da Events API (Events Manager > Pixel > Configurações > Events API) |
| `TIKTOK_EVENTS_TEST_CODE` | servidor, opcional | Evento aparece só em "Test Events" e não conta como conversão |

Sem `TIKTOK_PIXEL_ID` e token, o servidor não envia nada (no-op).

## Como validar sem gerar conversão falsa

1. Defina `TIKTOK_EVENTS_TEST_CODE` com o código da aba Test Events do Pixel.
2. Faça uma compra de teste (ou reprocesse uma cobrança de teste). O evento aparece só na aba Test Events.
3. Remova a variável para valer em produção.

Os testes automatizados nunca tocam a rede nem o banco.

## Ainda manual

- Criar o Pixel da Shadia no TikTok (Events Manager) e gerar o token da Events API.
- Definir as variáveis acima no Render e fazer um novo build do cliente.
- Atualizar a política de privacidade com o TikTok como destinatário dos dados, se o jurídico pedir.
