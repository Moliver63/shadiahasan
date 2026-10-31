/**
 * Perguntas por aula (requisito do certificado: o aluno responde 3 antes do depoimento).
 * A Shadia escreve, revisa e publica aqui. Só pergunta PUBLICADA conta; aula com menos de
 * 3 publicadas (somando exercícios publicados) ainda não gera certificado.
 */
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type Aula = { id: number; titulo: string; curso: string; publicadas: number; rascunhos: number; exercicios: number; prontas: boolean };

function Editor({ aula, onClose }: { aula: Aula; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.certificados.adminPerguntas.useQuery({ lessonId: aula.id });
  const [edits, setEdits] = useState<Record<number, { texto?: string; publicada?: boolean }>>({});
  const [novo, setNovo] = useState("");
  const refrescar = () => { utils.certificados.adminPerguntas.invalidate({ lessonId: aula.id }); utils.certificados.adminResumo.invalidate(); };
  const salvar = trpc.certificados.adminSalvarPergunta.useMutation({ onSuccess: refrescar, onError: (e) => toast.error(e.message) });
  const excluir = trpc.certificados.adminExcluirPergunta.useMutation({ onSuccess: () => { toast.success("Pergunta excluída"); refrescar(); }, onError: (e) => toast.error(e.message) });

  const valor = (p: { id: number; texto: string; publicada: boolean }) => ({ texto: edits[p.id]?.texto ?? p.texto, publicada: edits[p.id]?.publicada ?? p.publicada });
  const salvarUma = async (p: { id: number; texto: string; ordem: number; publicada: boolean }) => {
    const v = valor(p);
    await salvar.mutateAsync({ id: p.id, lessonId: aula.id, texto: v.texto, ordem: p.ordem, publicada: v.publicada });
    setEdits((e) => { const { [p.id]: _, ...resto } = e; return resto; });
    toast.success("Pergunta salva");
  };
  const publicarTodas = async () => {
    for (const p of data ?? []) {
      const v = valor(p);
      if (!v.publicada || v.texto !== p.texto) await salvar.mutateAsync({ id: p.id, lessonId: aula.id, texto: v.texto, ordem: p.ordem, publicada: true });
    }
    setEdits({});
    toast.success("Todas as perguntas desta aula foram publicadas");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{aula.titulo}</DialogTitle>
          <DialogDescription>{aula.curso}. O aluno precisa responder pelo menos 3 perguntas ou exercícios publicados para liberar o certificado.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pergunta ainda. Adicione abaixo.</p>}
            {(data ?? []).map((p) => {
              const v = valor(p);
              const sujo = v.texto !== p.texto || v.publicada !== p.publicada;
              return (
                <div key={p.id} className="space-y-2 rounded-lg border p-3">
                  <Textarea value={v.texto} rows={2} maxLength={500} onChange={(e) => setEdits((x) => ({ ...x, [p.id]: { ...x[p.id], texto: e.target.value } }))} aria-label="Texto da pergunta" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={v.publicada} onCheckedChange={(c) => setEdits((x) => ({ ...x, [p.id]: { ...x[p.id], publicada: c } }))} />
                      {v.publicada ? "Publicada" : "Rascunho (aluno não vê)"}
                    </label>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="text-destructive" disabled={excluir.isPending} onClick={() => { if (confirm("Excluir esta pergunta?")) excluir.mutate({ id: p.id }); }}>
                        <Trash2 className="mr-1 h-4 w-4" /> Excluir
                      </Button>
                      <Button size="sm" disabled={!sujo || salvar.isPending || v.texto.trim().length < 10} onClick={() => salvarUma(p)}>Salvar</Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <Textarea value={novo} rows={2} maxLength={500} onChange={(e) => setNovo(e.target.value)} placeholder="Nova pergunta (reflexiva, sobre o tema da aula)" aria-label="Nova pergunta" />
              <Button size="sm" variant="outline" disabled={novo.trim().length < 10 || salvar.isPending} onClick={async () => {
                await salvar.mutateAsync({ lessonId: aula.id, texto: novo, ordem: (data?.length ?? 0) + 1, publicada: false });
                setNovo("");
                toast.success("Pergunta adicionada como rascunho");
              }}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar como rascunho
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={publicarTodas} disabled={!(data ?? []).length || salvar.isPending}>Publicar todas</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPerguntas() {
  const utils = trpc.useUtils();
  const { data: aulas, isLoading } = trpc.certificados.adminResumo.useQuery();
  const [aberta, setAberta] = useState<Aula | null>(null);
  const rascunhos = trpc.certificados.adminCriarRascunhos.useMutation({
    onSuccess: (r) => { toast.success(r.criadas ? `${r.criadas} rascunhos criados` : "Todas as aulas já têm perguntas"); utils.certificados.adminResumo.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const lista = (aulas ?? []) as Aula[];
  const prontas = lista.filter((a) => a.prontas).length;
  const comRascunho = lista.filter((a) => !a.prontas && a.rascunhos > 0).length;
  const sem = lista.length - prontas - comRascunho;
  const cursos = Array.from(new Set(lista.map((a) => a.curso)));

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Perguntas das aulas</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Para ganhar o certificado, o aluno assiste à aula, responde a 3 perguntas e faz o depoimento. Escreva e publique as perguntas de cada aula. Aula com menos de 3 publicadas ainda não gera certificado.
            </p>
          </div>
          <Button variant="outline" onClick={() => rascunhos.mutate({})} disabled={rascunhos.isPending}>
            {rascunhos.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Criar rascunhos nas aulas sem perguntas
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardDescription>Prontas para certificado</CardDescription><CardTitle className="text-3xl">{prontas}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Só com rascunhos (revisar e publicar)</CardDescription><CardTitle className="text-3xl">{comRascunho}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Sem perguntas</CardDescription><CardTitle className="text-3xl">{sem}</CardTitle></CardHeader></Card>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          cursos.map((curso) => (
            <section key={curso} className="space-y-3">
              <h2 className="text-lg font-semibold">{curso || "Sem curso"}</h2>
              <Card>
                <CardContent className="divide-y p-0">
                  {lista.filter((a) => a.curso === curso).map((a) => (
                    <div key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{a.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.publicadas} publicadas · {a.rascunhos} rascunhos{a.exercicios ? ` · ${a.exercicios} exercício(s) publicado(s)` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {a.prontas ? (
                          <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3" /> Pronta</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-amber-300 text-amber-800"><CircleAlert className="h-3 w-3" /> {a.rascunhos > 0 ? "Revisar" : "Sem perguntas"}</Badge>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setAberta(a)}><FileText className="mr-1 h-4 w-4" /> Editar</Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          ))
        )}
      </div>
      {aberta && <Editor aula={aberta} onClose={() => setAberta(null)} />}
    </DashboardLayout>
  );
}
