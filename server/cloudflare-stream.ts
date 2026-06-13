/**
 * Cloudflare Stream integration
 * Docs: https://developers.cloudflare.com/stream/
 *
 * Env vars necessárias (adicionar no Render):
 *   CLOUDFLARE_ACCOUNT_ID   — Account ID (dash.cloudflare.com → lado direito)
 *   CLOUDFLARE_API_TOKEN    — API Token com permissão "Stream:Edit"
 *   CLOUDFLARE_SIGNING_KEY_ID   — ID da chave de assinatura (opcional, para vídeos pagos)
 *   CLOUDFLARE_SIGNING_KEY_PEM  — Chave privada PEM (opcional, para vídeos pagos)
 */

const CF_BASE = "https://api.cloudflare.com/client/v4";

function getCFConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error(
      "Cloudflare Stream não configurado: adicione CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN no Render"
    );
  }
  return { accountId, apiToken };
}

function cfHeaders(apiToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };
}

// ─── Upload direto via URL (TUS) ─────────────────────────────────────────────

/**
 * Gera uma URL de upload direto (TUS) para o cliente enviar o vídeo
 * sem passar pelo servidor. Retorna { uploadUrl, uid }
 */
export async function createDirectUploadUrl(meta: {
  name: string;
  maxDurationSeconds?: number;
  requireSignedURLs?: boolean;
}): Promise<{ uploadUrl: string; uid: string }> {
  const { accountId, apiToken } = getCFConfig();

  const res = await fetch(
    `${CF_BASE}/accounts/${accountId}/stream/direct_upload`,
    {
      method: "POST",
      headers: cfHeaders(apiToken),
      body: JSON.stringify({
        maxDurationSeconds: meta.maxDurationSeconds ?? 7200,
        requireSignedURLs: meta.requireSignedURLs ?? false,
        meta: { name: meta.name },
      }),
    }
  );

  const data = await res.json() as any;
  if (!data.success) {
    throw new Error(
      `Cloudflare Stream erro: ${JSON.stringify(data.errors)}`
    );
  }

  return {
    uploadUrl: data.result.uploadURL,
    uid: data.result.uid,
  };
}

// ─── Detalhes de um vídeo ────────────────────────────────────────────────────

export interface CFVideoDetails {
  uid: string;
  status: { state: string };
  meta: { name?: string };
  duration: number;
  playback: { hls: string; dash: string };
  thumbnail: string;
  requireSignedURLs: boolean;
  readyToStream: boolean;
}

export async function getVideoDetails(uid: string): Promise<CFVideoDetails> {
  const { accountId, apiToken } = getCFConfig();

  const res = await fetch(
    `${CF_BASE}/accounts/${accountId}/stream/${uid}`,
    { headers: cfHeaders(apiToken) }
  );

  const data = await res.json() as any;
  if (!data.success) {
    throw new Error(`Cloudflare Stream erro: ${JSON.stringify(data.errors)}`);
  }

  return data.result as CFVideoDetails;
}

// ─── Listar vídeos ───────────────────────────────────────────────────────────

export async function listVideos(): Promise<CFVideoDetails[]> {
  const { accountId, apiToken } = getCFConfig();

  const res = await fetch(
    `${CF_BASE}/accounts/${accountId}/stream`,
    { headers: cfHeaders(apiToken) }
  );

  const data = await res.json() as any;
  if (!data.success) {
    throw new Error(`Cloudflare Stream erro: ${JSON.stringify(data.errors)}`);
  }

  return data.result as CFVideoDetails[];
}

// ─── Deletar vídeo ──────────────────────────────────────────────────────────

export async function deleteVideo(uid: string): Promise<void> {
  const { accountId, apiToken } = getCFConfig();

  await fetch(`${CF_BASE}/accounts/${accountId}/stream/${uid}`, {
    method: "DELETE",
    headers: cfHeaders(apiToken),
  });
}

// ─── Atualizar requireSignedURLs ─────────────────────────────────────────────

export async function setSignedUrlRequired(
  uid: string,
  required: boolean
): Promise<void> {
  const { accountId, apiToken } = getCFConfig();

  const res = await fetch(
    `${CF_BASE}/accounts/${accountId}/stream/${uid}`,
    {
      method: "POST",
      headers: cfHeaders(apiToken),
      body: JSON.stringify({ requireSignedURLs: required }),
    }
  );

  const data = await res.json() as any;
  if (!data.success) {
    throw new Error(`Cloudflare Stream erro: ${JSON.stringify(data.errors)}`);
  }
}

// ─── Signed URL (para vídeos pagos/protegidos) ───────────────────────────────

/**
 * Gera um token JWT assinado que permite assistir um vídeo protegido por 1 hora.
 * Requer CLOUDFLARE_SIGNING_KEY_ID e CLOUDFLARE_SIGNING_KEY_PEM no env.
 *
 * Como obter:
 *   dash.cloudflare.com → Stream → Signing Keys → Create a Key
 */
export async function generateSignedStreamUrl(
  uid: string,
  manifestUrl?: string | null,
  expiresInSeconds = 3600
): Promise<string> {
  const keyId = process.env.CLOUDFLARE_SIGNING_KEY_ID;
  const keyPem = process.env.CLOUDFLARE_SIGNING_KEY_PEM;

  const resolvedManifestUrl = manifestUrl || (await getVideoDetails(uid)).playback?.hls || null;

  if (!resolvedManifestUrl) {
    throw new Error("Cloudflare Stream: manifest HLS não disponível para este vídeo.");
  }

  if (!keyId || !keyPem) {
    // Fallback: retorna a URL pública real do manifest já fornecida pela API
    console.warn(
      "[Cloudflare Stream] CLOUDFLARE_SIGNING_KEY_ID / PEM não configurados — retornando manifest público"
    );
    return resolvedManifestUrl;
  }

  // Importar chave RSA/EC via Web Crypto API (disponível no Node 18+)
  const pemBody = keyPem
    .replace(/-----BEGIN[^-]+-----/, "")
    .replace(/-----END[^-]+-----/, "")
    .replace(/\s/g, "");

  const keyBuffer = Buffer.from(pemBody, "base64");

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const header = { alg: "RS256", kid: keyId };
  const payload = { sub: uid, kid: keyId, exp };

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    Buffer.from(signingInput)
  );

  const token = `${signingInput}.${Buffer.from(signature).toString("base64url")}`;

  const replacedManifestUrl = resolvedManifestUrl.replace(
    new RegExp(`/${uid}/manifest/video\\.m3u8(?:\\?.*)?$`),
    `/${token}/manifest/video.m3u8`
  );

  if (replacedManifestUrl !== resolvedManifestUrl) {
    return replacedManifestUrl;
  }

  const manifest = new URL(resolvedManifestUrl);
  manifest.pathname = `/${token}/manifest/video.m3u8`;
  manifest.search = "";
  return manifest.toString();
}

// ─── Helpers de provider ─────────────────────────────────────────────────────

export function isCloudflareConfigured(): boolean {
  return !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

/**
 * Retorna a URL de embed/player para uma aula com base no provider:
 *   - "youtube"    → embed do YouTube (não requer auth)
 *   - "cloudflare" → URL HLS direta (pública) ou Signed URL (protegida)
 */
export async function resolveVideoUrl(lesson: {
  videoProvider: string | null;
  videoAssetId: string | null;
  videoPlaybackUrl: string | null;
  isAccessRestricted: number;
}): Promise<string | null> {
  if (!lesson.videoProvider) return lesson.videoPlaybackUrl;

  if (lesson.videoProvider === "youtube") {
    return lesson.videoPlaybackUrl; // URL normal do YouTube
  }

  if (lesson.videoProvider === "cloudflare" && lesson.videoAssetId) {
    const manifestUrl =
      lesson.videoPlaybackUrl ||
      (await getVideoDetails(lesson.videoAssetId)).playback?.hls ||
      null;

    if (!manifestUrl) {
      return null;
    }

    if (lesson.isAccessRestricted) {
      return await generateSignedStreamUrl(lesson.videoAssetId, manifestUrl);
    }

    return manifestUrl;
  }

  return lesson.videoPlaybackUrl;
}
