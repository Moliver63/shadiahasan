import { describe, expect, it } from "vitest";
import { ehSomenteAudio, usarHlsNativo } from "./videoSuporte";

describe("suporte de vídeo por aparelho", () => {
  it("HLS sem largura ainda (iPad) não vira tela de áudio", () => {
    expect(ehSomenteAudio("https://x.cloudflarestream.com/a/manifest/video.m3u8", 0, 372)).toBe(false);
  });
  it("arquivo direto sem imagem continua sendo áudio", () => {
    expect(ehSomenteAudio("https://x.com/aula.m4a", 0, 60)).toBe(true);
    expect(ehSomenteAudio("https://x.com/aula.mp4", 1280, 60)).toBe(false);
  });
  it("HLS nativo só na Apple", () => {
    expect(usarHlsNativo(true, "Apple Computer, Inc.")).toBe(true);
    expect(usarHlsNativo(true, "Google Inc.")).toBe(false);
    expect(usarHlsNativo(false, "Apple Computer, Inc.")).toBe(false);
  });
});
