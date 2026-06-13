# Upload de Vídeos (Cloudflare Stream) — Runbook

## Problema recorrente

Aulas mostram **"Vídeo não disponível para esta aula"** mesmo após o upload
ter sido concluído no Cloudflare Stream.

### Causa raiz

1. O admin faz upload de um vídeo (`videos.admin.createUploadUrl` →
   upload direto ao Cloudflare via `AdminCourseLessons.tsx`).
2. O Cloudflare leva de **30s a poucos minutos** para processar o vídeo
   (`readyToStream: false` → `true`).
3. Se o admin **salvar/atualizar a aula antes** desse processamento
   terminar, o campo `videoPlaybackUrl` fica vazio (`NULL`) no banco,
   mesmo com `videoAssetId` (UID do Cloudflare) já preenchido.
4. O frontend (`LessonView.tsx`) só renderiza o player se
   `videoPlaybackUrl` existir → aula fica sem vídeo.

## Solução implementada (autocorretiva)

### 1. Sincronização automática (self-healing)

A página `/admin/courses/:id/lessons` chama automaticamente
`videos.admin.syncPendingVideos` ao carregar. Esse endpoint:

- Busca todas as aulas com `videoProvider = "cloudflare"` e
  `videoAssetId` preenchido.
- Para cada uma, consulta `getVideoDetails(uid)` no Cloudflare.
- Se `readyToStream = true`, preenche `videoPlaybackUrl` (HLS manifest)
  e `duration` automaticamente.

**Resultado**: basta o admin (re)abrir a tela de aulas do curso depois
de alguns minutos para que vídeos "pendentes" sejam corrigidos sozinhos.

### 2. Sincronização manual

Botão **"Sincronizar vídeos pendentes"** no topo de
`/admin/courses/:id/lessons` — roda o mesmo processo on-demand.

### 3. Sincronização ao salvar a aula

`createMutation`/`updateMutation` (em `AdminCourseLessons.tsx`) chamam
`checkUploadStatus` com o `lessonId` imediatamente após criar/atualizar
a aula, cobrindo o caso em que o vídeo já ficou pronto durante o
preenchimento do formulário.

## Diagnóstico manual (se algo ainda falhar)

```sql
-- Ver aulas com vídeo "órfão" (asset sem playback URL)
SELECT id, title, "videoAssetId", "videoPlaybackUrl", duration
FROM lessons
WHERE "videoProvider" = 'cloudflare'
  AND "videoAssetId" IS NOT NULL
  AND ("videoPlaybackUrl" IS NULL OR "videoPlaybackUrl" = '');
```

```powershell
# Consultar status de um vídeo específico no Cloudflare
curl.exe -X GET "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/stream/<UID>" `
  -H "Authorization: Bearer <CLOUDFLARE_API_TOKEN>"
```

Se `readyToStream: true` mas o banco está vazio, clique em
**"Sincronizar vídeos pendentes"** no admin, ou rode:

```sql
UPDATE lessons SET
  "videoPlaybackUrl" = '<playback.hls do JSON acima>',
  duration = <duration do JSON acima>
WHERE id = <lessonId>;
```

## Variáveis de ambiente necessárias (Render)

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (permissão "Edit Cloudflare Stream")
- Cloudflare Stream precisa estar **ativado** na conta (plano
  "Images & Stream", $0/mês base + uso).
