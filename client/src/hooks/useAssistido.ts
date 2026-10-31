/**
 * Manda ao servidor, a cada ~15 s, quantos segundos do vídeo foram realmente tocados.
 * O certificado só sai depois de o servidor somar 80% da aula (server/assistido.ts).
 * Nada aqui decide nada: se o envio falhar, os segundos daquele trecho se perdem e o
 * aluno só precisa assistir mais um pouco.
 */
import { useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

export type CertificadoNovo = { numero: string; tipo: string; titulo: string };

const INTERVALO_MS = 15_000;

export function useAssistido(lessonId: number | undefined, ativo: boolean, aoGanhar: (novos: CertificadoNovo[]) => void) {
  const { mutate } = trpc.certificados.registrarAssistido.useMutation();
  const pendente = useRef(0);
  const duracao = useRef(0);
  const aula = useRef<number | undefined>(lessonId);
  const aoGanharRef = useRef(aoGanhar);
  aoGanharRef.current = aoGanhar;

  const enviar = useCallback((id: number | undefined) => {
    const seg = pendente.current;
    pendente.current = 0;
    if (!id || seg < 0.5) return;
    mutate(
      { lessonId: id, segundos: Math.min(120, Math.round(seg * 10) / 10), duracao: duracao.current > 0 ? Math.round(duracao.current) : undefined },
      { onSuccess: (r) => { if (r?.certificadosNovos?.length) aoGanharRef.current(r.certificadosNovos); } },
    );
  }, [mutate]);

  // Trocou de aula: fecha o que sobrou da anterior antes de começar a nova
  useEffect(() => {
    if (aula.current !== lessonId) {
      enviar(aula.current);
      duracao.current = 0;
      aula.current = lessonId;
    }
  }, [lessonId, enviar]);

  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => enviar(aula.current), INTERVALO_MS);
    const fechar = () => { if (document.visibilityState === "hidden") enviar(aula.current); };
    document.addEventListener("visibilitychange", fechar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", fechar);
      enviar(aula.current);
    };
  }, [ativo, enviar]);

  /** Para o `onWatchDelta` do player. */
  const somar = useCallback((segundos: number, duracaoTotal: number) => {
    pendente.current += segundos;
    if (duracaoTotal > 0) duracao.current = duracaoTotal;
  }, []);

  /** Fim do vídeo: manda o que falta na hora, sem esperar o próximo ciclo. */
  const fechar = useCallback(() => enviar(aula.current), [enviar]);

  return { somar, fechar };
}
