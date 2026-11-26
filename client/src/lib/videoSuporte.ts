/**
 * Decisões do player que variam por aparelho.
 */

/**
 * HLS nativo só nos aparelhos da Apple (Safari e todos os navegadores do iPhone/iPad).
 * Chrome recente também diz que toca HLS, mas lá o hls.js tem recuperação de erro e troca de áudio.
 */
export function usarHlsNativo(temNativo: boolean, vendor: string): boolean {
  return temNativo && vendor.startsWith("Apple");
}

/**
 * Arquivo direto sem imagem (MP4/M4A de áudio). Em HLS a resposta é sempre "não": as aulas do
 * Cloudflare Stream têm vídeo, e a largura pode continuar 0 até depois do "loadedmetadata".
 */
export function ehSomenteAudio(src: string, largura: number, duracao: number): boolean {
  if (src.includes(".m3u8")) return false;
  return largura === 0 && duracao > 0;
}
