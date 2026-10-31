import { describe, expect, it } from "vitest";
import { chaveDoManifesto } from "./videoChave";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sub: string, exp: number) => `${b64({ alg: "RS256", kid: "k" })}.${b64({ sub, kid: "k", exp })}.assinatura${exp}`;
const url = (seg: string) => `https://customer-abc.cloudflarestream.com/${seg}/manifest/video.m3u8`;

describe("chave do vídeo (troca de token não recria o player)", () => {
  it("dois tokens do mesmo vídeo têm a mesma chave", () => {
    expect(chaveDoManifesto(url(jwt("UID123", 1000)))).toBe(chaveDoManifesto(url(jwt("UID123", 2000))));
  });
  it("vídeos diferentes têm chaves diferentes", () => {
    expect(chaveDoManifesto(url(jwt("UID123", 1000)))).not.toBe(chaveDoManifesto(url(jwt("OUTRO", 1000))));
  });
  it("link público (uid no caminho) usa o próprio uid", () => {
    expect(chaveDoManifesto(url("UID123"))).toBe("https://customer-abc.cloudflarestream.com/UID123");
  });
  it("URL que não é do Cloudflare fica como está", () => {
    expect(chaveDoManifesto("https://exemplo.com/video.mp4")).toBe("https://exemplo.com/video.mp4");
  });
});
