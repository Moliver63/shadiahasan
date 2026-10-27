import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { trackEvent } from "@/components/Analytics";

/**
 * Vídeo-convite da Shadia na oferta de 1 aula (27/10/2026).
 *
 * O mesmo vídeo roda como anúncio na campanha 804. Na página ele acolhe quem
 * chegou pelos carrosséis e ainda não viu a Shadia, e termina com "clica no
 * botão abaixo e escolha o seu tema", por isso o botão fica logo embaixo e
 * leva aos cards das aulas.
 *
 * Desempenho: a maior perda da campanha é entre o clique e a página carregar.
 * Até o play só baixa a capa (~55 KB); o vídeo (720p, ~7 MB) carrega quando a
 * pessoa toca. Nada de autoplay.
 */
const VIDEO = "/midia/shadia-convite-720.mp4";
const CAPA = "/midia/shadia-convite-capa.jpg";

export default function ConviteShadiaVideo({
  price,
  validDays,
  onEscolher,
}: {
  price: string;
  validDays: number;
  onEscolher: () => void;
}) {
  const [tocando, setTocando] = useState(false);
  const playRegistrado = useRef(false);

  const tocar = () => {
    setTocando(true);
    if (!playRegistrado.current) {
      playRegistrado.current = true;
      trackEvent("video_play", { video_name: "convite_shadia_aula", placement: "oferta_1_aula" });
    }
  };

  return (
    <div className="mt-12 grid items-center gap-8 md:grid-cols-[minmax(0,300px)_1fr] md:gap-12 lg:gap-16">
      <div className="mx-auto w-full max-w-[300px]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-[#d9b27c]/30 bg-[#1d1410] shadow-2xl">
          {tocando ? (
            <video
              src={VIDEO}
              poster={CAPA}
              controls
              autoPlay
              playsInline
              preload="auto"
              className="h-full w-full object-cover"
              onEnded={() => trackEvent("video_complete", { video_name: "convite_shadia_aula" })}
            />
          ) : (
            <button
              type="button"
              onClick={tocar}
              aria-label="Assistir ao convite da Shadia"
              className="group absolute inset-0 h-full w-full"
            >
              <img src={CAPA} alt="Shadia Hasan" loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-[#1d1410]/80 via-transparent to-transparent" />
              <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#f0d3a4]/95 shadow-lg transition group-hover:scale-105">
                <Play className="ml-1 h-7 w-7 fill-[#2b1d16] text-[#2b1d16]" />
              </span>
              <span className="absolute bottom-4 left-0 right-0 text-center text-xs uppercase tracking-[0.25em] text-[#f4ece4]">
                Assista · 42s
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 text-center md:text-left">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[#d9b27c]">Um convite da Shadia</p>
        <p className="font-serif text-2xl leading-snug sm:text-3xl">
          Você não precisa adquirir o curso inteiro
          <span className="block italic text-[#e8c48f]">para começar.</span>
        </p>
        <p className="mx-auto max-w-md text-base text-[#d8cabd] md:mx-0">
          Escolha uma aula do tema que mais fala com você, por {price} em pagamento único, e assista em até {validDays} dias.
        </p>
        <button
          type="button"
          onClick={onEscolher}
          className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#d9b27c] to-[#f0d3a4] px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-[#2b1d16] shadow-lg transition hover:brightness-105 sm:w-auto"
        >
          Escolher meu tema
        </button>
      </div>
    </div>
  );
}
