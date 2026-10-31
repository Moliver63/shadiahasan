/**
 * Identidade do vídeo, sem o token. O link assinado do Cloudflare Stream muda a cada pedido
 * (o token leva a data de validade), mas o vídeo é o mesmo. Só quando esta chave muda o
 * player é recriado; troca de token só troca a fonte, sem perder o ponto em que o aluno está.
 */
export function chaveDoManifesto(src: string): string {
  const m = src.match(/^(https?:\/\/[^/]+)\/([^/?#]+)\/manifest\/video\.m3u8/);
  if (!m) return src;
  const partes = m[2].split(".");
  if (partes.length === 3) {
    try {
      const p = JSON.parse(atob(partes[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (p?.sub) return `${m[1]}/${p.sub}`;
    } catch { /* não é JWT: usa o trecho como está */ }
  }
  return `${m[1]}/${m[2]}`;
}

