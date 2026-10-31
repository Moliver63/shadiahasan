/**
 * Sequência automática de e-mails de boas-vindas (painel admin).
 *
 * Quem confirma a inscrição DEPOIS que a sequência é ativada recebe os e-mails nos
 * intervalos definidos aqui. Quem já estava na lista nunca entra (a autorização foi dada
 * para novidades, não para uma série automática começando agora). Regras no servidor em
 * server/marketingSequencia.ts.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Clock, Loader2, MailCheck, Pause, Pencil, Play, Plus, Trash2, Users } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type PassoForm = {
  id?: number | null;
  diasDepois: number;
  assunto: string;
  corpo: string;
  botaoTexto: string | null;
  botaoUrl: string | null;
  pularSeAssina: boolean;
};

const dataHora = (d: unknown) => (d ? new Date(d as any).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "");

const PASSO_NOVO: PassoForm = { diasDepois: 3, assunto: "", corpo: "", botaoTexto: null, botaoUrl: null, pularSeAssina: true };

// ─── Edição de um e-mail da sequência ────────────────────────────────────────

function EditorPasso({
  inicial, ordem, maxDias, salvando, onSalvar, onClose,
}: {
  inicial: PassoForm; ordem: number; maxDias: number; salvando: boolean;
  onSalvar: (p: PassoForm) => void; onClose: () => void;
}) {
  const [p, setP] = useState<PassoForm>(inicial);
  const conteudo = { assunto: p.assunto, corpo: p.corpo, botaoTexto: p.botaoTexto || null, botaoUrl: p.botaoUrl || null };
  const previa = trpc.marketing.previa.useQuery(conteudo, { enabled: p.corpo.trim().length > 0 && p.assunto.trim().length > 0, staleTime: 2000 });
  const testar = trpc.marketing.testar.useMutation({
    onSuccess: (r) => toast.success(`Teste enviado para ${r.para}`),
    onError: (e) => toast.error(e.message),
  });
  const atualizar = (parcial: Partial<PassoForm>) => setP((x) => ({ ...x, ...parcial }));
  const completo = p.assunto.trim().length > 0 && p.corpo.trim().length > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && !salvando && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{inicial.id ? `E-mail ${ordem} da sequência` : "Novo e-mail da sequência"}</DialogTitle>
          <DialogDescription>Escreva como se falasse com uma pessoa. O e-mail já começa com “Olá, [primeiro nome].” e termina com a assinatura e o link para cancelar.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="sDias">{ordem === 1 ? "Quando sai o primeiro e-mail" : "Quando sai"}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="sDias" type="number" min={0} max={maxDias} className="w-24"
                  value={p.diasDepois}
                  onChange={(e) => atualizar({ diasDepois: Math.max(0, Math.min(maxDias, Math.floor(Number(e.target.value) || 0))) })}
                />
                <span className="text-sm text-muted-foreground">
                  {ordem === 1 ? "dias depois de a pessoa confirmar a inscrição (0 = logo em seguida)" : "dias depois do e-mail anterior"}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sAssunto">Assunto</Label>
              <Input id="sAssunto" value={p.assunto} onChange={(e) => atualizar({ assunto: e.target.value })} maxLength={200} placeholder="O que a pessoa lê na caixa de entrada" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sCorpo">Texto</Label>
              <Textarea id="sCorpo" rows={10} value={p.corpo} onChange={(e) => atualizar({ corpo: e.target.value })} placeholder={"Separe os parágrafos com uma linha em branco."} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sBt">Texto do botão (opcional)</Label>
                <Input id="sBt" value={p.botaoTexto ?? ""} onChange={(e) => atualizar({ botaoTexto: e.target.value })} maxLength={60} placeholder="Ex.: Ver os cursos" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sBu">Endereço do botão</Label>
                <Input id="sBu" value={p.botaoUrl ?? ""} onChange={(e) => atualizar({ botaoUrl: e.target.value })} maxLength={500} placeholder="https://shadiahasan.com/courses" />
              </div>
            </div>
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-4 text-sm">
              <span>
                <span className="font-medium">Não enviar a quem já assina um plano</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Use nos e-mails que convidam a conhecer ou assinar. Quem já é aluna pula este e continua recebendo os demais.</span>
              </span>
              <Switch checked={p.pularSeAssina} onCheckedChange={(v) => atualizar({ pularSeAssina: v })} />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Como vai aparecer (exemplo com o nome “Maria”)</p>
            {previa.data ? (
              <iframe title="Prévia do e-mail" srcDoc={previa.data.html} sandbox="" className="h-[620px] w-full rounded-lg border bg-white" />
            ) : (
              <div className="flex h-[620px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">Preencha o assunto e o texto para ver a prévia.</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button variant="outline" disabled={!completo || testar.isPending} onClick={() => testar.mutate(conteudo)}>
            {testar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}Enviar teste para mim
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={salvando} onClick={onClose}>Cancelar</Button>
            <Button disabled={!completo || salvando} onClick={() => onSalvar({ ...p, botaoTexto: p.botaoTexto || null, botaoUrl: p.botaoUrl || null })}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar e-mail
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Painel ──────────────────────────────────────────────────────────────────

export default function SequenciaEmail() {
  const utils = trpc.useUtils();
  const q = trpc.marketing.sequencia.useQuery(undefined, { refetchInterval: 30_000 });
  const [editando, setEditando] = useState<{ indice: number | null } | null>(null);
  const [removerIndice, setRemoverIndice] = useState<number | null>(null);
  const [confirmarAtivar, setConfirmarAtivar] = useState(false);
  const [confirmarPausar, setConfirmarPausar] = useState(false);

  const refrescar = () => utils.marketing.sequencia.invalidate();
  const salvar = trpc.marketing.salvarSequencia.useMutation({
    onSuccess: () => { toast.success("Sequência salva"); refrescar(); setEditando(null); setRemoverIndice(null); },
    onError: (e) => toast.error(e.message),
  });
  const ativar = trpc.marketing.ativarSequencia.useMutation({
    onSuccess: (_r, v) => { toast.success(v.ativa ? "Sequência ativada" : "Sequência pausada"); refrescar(); setConfirmarAtivar(false); setConfirmarPausar(false); },
    onError: (e) => { toast.error(e.message); setConfirmarAtivar(false); setConfirmarPausar(false); },
  });

  if (q.isLoading || !q.data) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const { sequencia, estatisticas, naSequencia, janela, limites } = q.data;
  const passos = sequencia.passos;
  const statsDe = (id: number) => estatisticas.find((e) => e.passoId === id) ?? { enviados: 0, erros: 0, ignorados: 0 };
  const jaEnviou = (id: number) => { const s = statsDe(id); return s.enviados + s.erros + s.ignorados > 0; };
  const nuncaAtivada = !sequencia.ativadaEm;

  const paraForm = (i: number): PassoForm => {
    const p = passos[i];
    return { id: p.id, diasDepois: p.diasDepois, assunto: p.assunto, corpo: p.corpo, botaoTexto: p.botaoTexto, botaoUrl: p.botaoUrl, pularSeAssina: p.pularSeAssina };
  };
  const todos = (): PassoForm[] => passos.map((_, i) => paraForm(i));

  const salvarPasso = (indice: number | null, p: PassoForm) => {
    const lista = todos();
    if (indice === null) lista.push({ ...p, id: null });
    else lista[indice] = p;
    salvar.mutate({ passos: lista });
  };
  const removerPasso = (indice: number) => salvar.mutate({ passos: todos().filter((_, i) => i !== indice) });

  return (
    <div className="space-y-6">
      <Card className={`py-0 ${sequencia.ativa ? "border-emerald-200" : ""}`}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">{sequencia.nome}</h2>
              <Badge variant="outline" className={sequencia.ativa ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-700"}>
                {sequencia.ativa ? "Ativa" : "Pausada"}
              </Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Quando alguém confirma a inscrição, recebe estes e-mails sozinha, um depois do outro. Só sai entre {janela.inicio}h e {janela.fim}h (horário de Brasília) e quem cancelar para de receber na hora.
            </p>
            <p className="flex items-center gap-1.5 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold tabular-nums">{naSequencia}</span>
              <span className="text-muted-foreground">{naSequencia === 1 ? "pessoa entrou" : "pessoas entraram"} na sequência{sequencia.ativadaEm ? ` desde ${dataHora(sequencia.ativadaEm)}` : ""}</span>
            </p>
          </div>
          {sequencia.ativa ? (
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setConfirmarPausar(true)}><Pause className="mr-2 h-4 w-4" />Pausar</Button>
          ) : (
            <Button className="w-full sm:w-auto" onClick={() => setConfirmarAtivar(true)}><Play className="mr-2 h-4 w-4" />Ativar sequência</Button>
          )}
        </CardContent>
      </Card>

      {nuncaAtivada && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Os textos abaixo são rascunhos para a Shadia revisar.</p>
          <p className="mt-0.5">Nada é enviado enquanto a sequência estiver pausada. Leia cada e-mail, ajuste o que quiser, mande um teste para você e só então ative.</p>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-medium">E-mails da sequência</h3>
          <Button size="sm" variant="outline" disabled={passos.length >= limites.maxPassos} onClick={() => setEditando({ indice: null })}>
            <Plus className="mr-1.5 h-4 w-4" />Adicionar e-mail
          </Button>
        </div>

        <ol className="space-y-3">
          {passos.map((p, i) => {
            const s = statsDe(p.id);
            const bloqueado = jaEnviou(p.id);
            return (
              <li key={p.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{p.ordem}</span>
                    <div className="min-w-0">
                      <p className="font-medium [overflow-wrap:anywhere]">{p.assunto}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 shrink-0" />{p.quando}</span>
                        {p.pularSeAssina && <span>Não vai para quem já assina</span>}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                        {s.enviados} enviados{s.ignorados ? ` · ${s.ignorados} pulados` : ""}{s.erros ? ` · ${s.erros} com erro` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pl-10 sm:pl-0">
                    <Button size="sm" variant="outline" onClick={() => setEditando({ indice: i })}><Pencil className="mr-1.5 h-4 w-4" />Editar</Button>
                    <Button
                      size="sm" variant="ghost" className="text-destructive"
                      disabled={passos.length <= 1 || bloqueado}
                      title={bloqueado ? "Este e-mail já foi enviado para alguém e não pode ser apagado" : passos.length <= 1 ? "A sequência precisa ter pelo menos um e-mail" : "Remover e-mail"}
                      aria-label="Remover e-mail"
                      onClick={() => setRemoverIndice(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-muted-foreground">Até {limites.maxPassos} e-mails. Mudanças valem para quem ainda não recebeu aquele e-mail.</p>
      </section>

      {editando && (
        <EditorPasso
          key={editando.indice ?? "novo"}
          inicial={editando.indice === null ? PASSO_NOVO : paraForm(editando.indice)}
          ordem={editando.indice === null ? passos.length + 1 : passos[editando.indice].ordem}
          maxDias={limites.maxDias}
          salvando={salvar.isPending}
          onSalvar={(p) => salvarPasso(editando.indice, p)}
          onClose={() => setEditando(null)}
        />
      )}

      <AlertDialog open={confirmarAtivar} onOpenChange={setConfirmarAtivar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar a sequência?</AlertDialogTitle>
            <AlertDialogDescription>
              Quem confirmar a inscrição a partir de agora recebe os {passos.length} e-mails, nos prazos combinados. Quem já está na lista não recebe a sequência.
              Só sai entre {janela.inicio}h e {janela.fim}h (Brasília) e quem cancelar a inscrição para de receber. Se ainda não mandou um teste de cada e-mail para você, vale fazer isso antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={ativar.isPending} onClick={(e) => { e.preventDefault(); ativar.mutate({ ativa: true }); }}>
              {ativar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ativar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarPausar} onOpenChange={setConfirmarPausar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pausar a sequência?</AlertDialogTitle>
            <AlertDialogDescription>
              Nenhum e-mail sai enquanto estiver pausada. Quem já recebeu continua com o que recebeu. Ao ativar de novo, cada pessoa segue de onde parou.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={ativar.isPending} onClick={(e) => { e.preventDefault(); ativar.mutate({ ativa: false }); }}>
              {ativar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Pausar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={removerIndice !== null} onOpenChange={(o) => !o && setRemoverIndice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este e-mail da sequência?</AlertDialogTitle>
            <AlertDialogDescription>
              {removerIndice !== null ? `“${passos[removerIndice]?.assunto}” ainda não foi enviado para ninguém. O texto será apagado e os próximos e-mails sobem uma posição.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={salvar.isPending} onClick={(e) => { e.preventDefault(); if (removerIndice !== null) removerPasso(removerIndice); }}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
