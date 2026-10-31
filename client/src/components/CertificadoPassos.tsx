/**
 * Cartão "Certificado desta aula" na página da aula.
 * Três passos, nesta ordem: assistir (80%), responder 3 perguntas, fazer o depoimento do curso.
 * Quem libera o certificado é o servidor (server/requisitos.ts); aqui só se mostra o caminho.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Award, CheckCircle2, Circle, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type Novo = { tipo: string };

function Passo({ n, feito, bloqueado, titulo, children }: { n: number; feito: boolean; bloqueado?: boolean; titulo: string; children?: React.ReactNode }) {
  const Icone = feito ? CheckCircle2 : bloqueado ? Lock : Circle;
  return (
    <li className="flex gap-3">
      <Icone className={`mt-0.5 h-5 w-5 shrink-0 ${feito ? "text-green-600" : "text-muted-foreground"}`} aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className={`font-medium ${bloqueado && !feito ? "text-muted-foreground" : ""}`}>{n}. {titulo}</p>
        {children}
      </div>
    </li>
  );
}

function CampoResposta({ lessonId, p, travado, aoSalvar }: { lessonId: number; p: { id: number; texto: string; resposta: string | null }; travado: boolean; aoSalvar: (n: Novo[]) => void }) {
  const [texto, setTexto] = useState(p.resposta ?? "");
  useEffect(() => { setTexto(p.resposta ?? ""); }, [p.resposta]);
  const utils = trpc.useUtils();
  const responder = trpc.certificados.responder.useMutation({
    onSuccess: (r) => {
      toast.success("Resposta salva");
      utils.certificados.passos.invalidate({ lessonId });
      aoSalvar(r.certificadosNovos);
    },
    onError: (e) => toast.error(e.message),
  });
  const mudou = texto.trim() !== (p.resposta ?? "").trim();
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm">{p.texto}</p>
      <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} disabled={travado} rows={3} maxLength={4000} placeholder="Escreva com suas palavras" aria-label={p.texto} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{p.resposta ? "Respondida" : "Pelo menos 30 caracteres"}</span>
        <Button size="sm" variant={p.resposta && !mudou ? "outline" : "default"} disabled={travado || !mudou || texto.trim().length < 10 || responder.isPending} onClick={() => responder.mutate({ lessonId, perguntaId: p.id, texto })}>
          {responder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {p.resposta ? "Atualizar" : "Salvar resposta"}
        </Button>
      </div>
    </div>
  );
}

export default function CertificadoPassos({ lessonId, aoGanhar }: { lessonId: number; aoGanhar: (novos: Novo[]) => void }) {
  const utils = trpc.useUtils();
  // Reconsulta de tempos em tempos enquanto a pessoa assiste, para o passo 1 andar sozinho
  const { data } = trpc.certificados.passos.useQuery({ lessonId }, { refetchInterval: (q) => (q.state.data?.liberado ? false : 20_000), retry: false });
  const [depoimento, setDepoimento] = useState("");
  const [autoriza, setAutoriza] = useState(false);
  const enviar = trpc.certificados.enviarDepoimento.useMutation({
    onSuccess: (r) => {
      toast.success("Depoimento enviado. Obrigada!");
      utils.certificados.passos.invalidate({ lessonId });
      aoGanhar(r.certificadosNovos);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!data) return null;
  const respondidas = Math.min(data.respondidas, data.minimo);

  return (
    <Card className={data.liberado ? "border-green-300 bg-green-50/50" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Award className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden />
          <div>
            <CardTitle className="text-lg">Certificado desta aula</CardTitle>
            <CardDescription>Assista, responda às perguntas e conte como foi para você. Quando os três passos estiverem feitos, o certificado é liberado.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-5">
          <Passo n={1} feito={data.assistida} titulo="Assistir à aula">
            {!data.assistida && (
              <div className="space-y-1">
                <Progress value={Math.round(data.fracaoAssistida * 100)} className="h-2" />
                <p className="text-xs text-muted-foreground">Conta quando você assiste de verdade, pelo menos 80% do vídeo. Pular trechos não conta.</p>
              </div>
            )}
          </Passo>

          <Passo n={2} feito={data.perguntasOk} bloqueado={!data.assistida} titulo={`Responder ${data.minimo} perguntas (${respondidas}/${data.minimo})`}>
            {!data.perguntasProntas ? (
              <p className="text-sm text-muted-foreground">As perguntas desta aula ainda estão sendo preparadas. O certificado fica disponível quando estiverem prontas.</p>
            ) : (
              <div className="space-y-3">
                {data.perguntas.map((p) => (
                  <CampoResposta key={p.id} lessonId={lessonId} p={p} travado={!data.assistida} aoSalvar={aoGanhar} />
                ))}
                {!data.assistida && <p className="text-xs text-muted-foreground">Termine de assistir à aula para liberar as perguntas.</p>}
              </div>
            )}
          </Passo>

          <Passo n={3} feito={data.depoimento} bloqueado={!data.perguntasOk} titulo="Fazer o depoimento">
            {data.depoimento ? (
              <p className="text-sm text-muted-foreground">Depoimento enviado. Ele vale para todas as aulas deste curso.</p>
            ) : (
              <div className="space-y-2">
                <Textarea value={depoimento} onChange={(e) => setDepoimento(e.target.value)} disabled={!data.perguntasOk} rows={4} maxLength={1200} placeholder="Como foi essa experiência para você? O que mudou?" aria-label="Depoimento" />
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={autoriza} onCheckedChange={(v) => setAutoriza(v === true)} disabled={!data.perguntasOk} className="mt-0.5" />
                  <span>Autorizo a publicação do meu depoimento no site, com meu nome.</span>
                </label>
                <Button disabled={!data.perguntasOk || !autoriza || depoimento.trim().length < 30 || enviar.isPending} onClick={() => enviar.mutate({ lessonId, texto: depoimento, autorizaPublicacao: true })}>
                  {enviar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enviar depoimento
                </Button>
                <p className="text-xs text-muted-foreground">Mínimo de 30 caracteres. Só aparece no site depois da aprovação da equipe.</p>
              </div>
            )}
          </Passo>
        </ol>

        {data.liberado && (
          <div className="mt-5 flex flex-col gap-2 rounded-lg border border-green-300 bg-green-100/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-green-900">Certificado liberado. Você já pode baixar o PDF.</p>
            <Button asChild size="sm"><Link href="/certificates">Ver meus certificados</Link></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
