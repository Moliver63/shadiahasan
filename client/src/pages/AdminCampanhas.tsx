/**
 * Campanhas de e-mail (novidades e ofertas).
 * Só recebe quem marcou a caixa de autorização e confirmou pelo e-mail; toda mensagem leva o
 * link de cancelar. Regras em server/marketing.ts e server/marketingEnvio.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Loader2, MailCheck, MailX, Plus, Send, Square, UserCheck, UserX } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import SequenciaEmail from "@/components/SequenciaEmail";
import { trpc } from "@/lib/trpc";

type Origem = "home" | "cadastro" | "compra-aula";

const STATUS: Record<string, { rotulo: string; classe: string }> = {
  rascunho: { rotulo: "Rascunho", classe: "bg-slate-100 text-slate-700 border-slate-200" },
  enviando: { rotulo: "Enviando", classe: "bg-amber-50 text-amber-800 border-amber-200" },
  concluida: { rotulo: "Enviada", classe: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  cancelada: { rotulo: "Interrompida", classe: "bg-rose-50 text-rose-800 border-rose-200" },
};

/** "Enviada" em verde só quando de fato saiu. Tudo com erro não pode parecer sucesso. */
function statusDe(c: { status: string; enviados: number; erros: number }) {
  if (c.status === "concluida" && c.enviados === 0 && c.erros > 0) return { rotulo: "Não enviada", classe: "bg-rose-50 text-rose-800 border-rose-200" };
  if (c.status === "concluida" && c.erros > 0) return { rotulo: "Enviada com erros", classe: "bg-amber-50 text-amber-800 border-amber-200" };
  return STATUS[c.status] ?? { rotulo: c.status, classe: "" };
}

const dataHora = (d: unknown) => (d ? new Date(d as any).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "");

function Indicador({ icone, titulo, valor, ajuda }: { icone: React.ReactNode; titulo: string; valor: number; ajuda: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{icone}</div>
        <div>
          <p className="text-3xl font-semibold tabular-nums leading-none">{valor}</p>
          <p className="mt-1.5 text-sm font-medium">{titulo}</p>
          <p className="text-xs text-muted-foreground">{ajuda}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Editor (rascunho) ───────────────────────────────────────────────────────

function Editor({ id, onClose }: { id: number | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const existente = trpc.marketing.campanha.useQuery({ id: id ?? 0 }, { enabled: !!id });
  const origens = trpc.marketing.origens.useQuery();

  const [carregou, setCarregou] = useState(!id);
  const [idAtual, setIdAtual] = useState<number | null>(id);
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [botaoTexto, setBotaoTexto] = useState("");
  const [botaoUrl, setBotaoUrl] = useState("");
  const [sel, setSel] = useState<Origem[]>([]);
  const [semAssinatura, setSemAssinatura] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    const c = existente.data?.campanha;
    if (!id || !c || carregou) return;
    setNome(c.nome); setAssunto(c.assunto); setCorpo(c.corpo); setBotaoTexto(c.botaoTexto ?? ""); setBotaoUrl(c.botaoUrl ?? "");
    setSel(c.origens as Origem[]); setSemAssinatura(c.semAssinatura); setCarregou(true);
  }, [existente.data, id, carregou]);

  const segmento = useMemo(() => ({ origens: sel, semAssinatura }), [sel, semAssinatura]);
  const contagem = trpc.marketing.contar.useQuery(segmento);
  const total = contagem.data?.total ?? 0;

  const conteudo = { assunto, corpo, botaoTexto: botaoTexto || null, botaoUrl: botaoUrl || null };
  const previa = trpc.marketing.previa.useQuery(conteudo, { enabled: corpo.trim().length > 0 && assunto.trim().length > 0, staleTime: 2000 });

  const refrescar = () => { utils.marketing.campanhas.invalidate(); if (idAtual) utils.marketing.campanha.invalidate({ id: idAtual }); };
  const salvar = trpc.marketing.salvar.useMutation({ onError: (e) => toast.error(e.message) });
  const testar = trpc.marketing.testar.useMutation({ onSuccess: (r) => toast.success(`Teste enviado para ${r.para}`), onError: (e) => toast.error(e.message) });
  const enviar = trpc.marketing.enviar.useMutation({
    onSuccess: (r) => { toast.success(`Envio iniciado para ${r.total} pessoas`); refrescar(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const salvarAgora = async () => {
    const r = await salvar.mutateAsync({ id: idAtual, nome, ...conteudo, segmento });
    setIdAtual(r.id); refrescar();
    return r.id;
  };

  const alternar = (o: Origem) => setSel((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]));
  const ocupado = salvar.isPending || enviar.isPending;

  const pedirEnvio = async () => {
    try { await salvarAgora(); setConfirmar(true); } catch { /* o erro já aparece */ }
  };

  if (id && !carregou) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent><DialogTitle className="sr-only">Carregando</DialogTitle><div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div></DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && !ocupado && onClose()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{idAtual ? "Editar campanha" : "Nova campanha"}</DialogTitle>
            <DialogDescription>Escreva o e-mail, escolha quem recebe, mande um teste para você e só então envie.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="cNome">Nome interno</Label>
                <Input id="cNome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Oferta de novembro" maxLength={160} />
                <p className="text-xs text-muted-foreground">Só você vê. Serve para achar a campanha depois.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cAssunto">Assunto</Label>
                <Input id="cAssunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="O que a pessoa lê na caixa de entrada" maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cCorpo">Texto</Label>
                <Textarea id="cCorpo" rows={10} value={corpo} onChange={(e) => setCorpo(e.target.value)} placeholder={"Escreva como se falasse com uma pessoa.\n\nSepare os parágrafos com uma linha em branco."} />
                <p className="text-xs text-muted-foreground">O e-mail já começa com “Olá, [primeiro nome].” e termina com a assinatura e o link para cancelar. Não precisa escrever isso.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cBt">Texto do botão (opcional)</Label>
                  <Input id="cBt" value={botaoTexto} onChange={(e) => setBotaoTexto(e.target.value)} placeholder="Ex.: Ver os planos" maxLength={60} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cBu">Endereço do botão</Label>
                  <Input id="cBu" value={botaoUrl} onChange={(e) => setBotaoUrl(e.target.value)} placeholder="https://shadiahasan.com/pricing" maxLength={500} />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">Quem recebe</p>
                <p className="text-xs text-muted-foreground">Só entram pessoas que autorizaram e confirmaram o e-mail. Sem nenhuma marcada, vale para todas.</p>
                <div className="space-y-2">
                  {(origens.data ?? []).map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <Checkbox checked={sel.includes(o.id as Origem)} onCheckedChange={() => alternar(o.id as Origem)} />
                      {o.rotulo}
                    </label>
                  ))}
                </div>
                <label className="flex cursor-pointer items-center justify-between gap-3 border-t pt-3 text-sm">
                  <span>Somente quem ainda não assina nenhum plano</span>
                  <Switch checked={semAssinatura} onCheckedChange={setSemAssinatura} />
                </label>
                <p className="text-sm">
                  <span className="font-semibold tabular-nums">{contagem.isLoading ? "..." : total}</span> {total === 1 ? "pessoa recebe" : "pessoas recebem"} agora.
                </p>
              </div>
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
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={ocupado} onClick={async () => { try { const i = await salvarAgora(); if (i) toast.success("Rascunho salvo"); } catch { /* erro já exibido */ } }}>
                {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar rascunho
              </Button>
              <Button variant="outline" disabled={ocupado || testar.isPending || !assunto || !corpo} onClick={() => testar.mutate(conteudo)}>
                {testar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}Enviar teste para mim
              </Button>
            </div>
            <Button disabled={ocupado || total === 0 || !assunto || !corpo || !nome} onClick={pedirEnvio}>
              <Send className="mr-2 h-4 w-4" />Enviar para {total} {total === 1 ? "pessoa" : "pessoas"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar agora para {total} {total === 1 ? "pessoa" : "pessoas"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Assunto: “{assunto}”. O envio começa na hora e não dá para desfazer o que já saiu. Você pode parar o envio em andamento. Se ainda não mandou um teste para você, vale cancelar e fazer isso antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => idAtual && enviar.mutate({ id: idAtual })}>Enviar agora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Acompanhamento (campanha já enviada) ────────────────────────────────────

function Acompanhar({ id, onClose }: { id: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const q = trpc.marketing.campanha.useQuery({ id }, { refetchInterval: (query) => (query.state.data?.campanha.status === "enviando" ? 3000 : false) });
  const refrescar = () => { utils.marketing.campanha.invalidate({ id }); utils.marketing.campanhas.invalidate(); };
  const continuar = trpc.marketing.continuar.useMutation({ onSuccess: () => { toast.success("Envio retomado"); refrescar(); }, onError: (e) => toast.error(e.message) });
  const parar = trpc.marketing.cancelar.useMutation({ onSuccess: () => { toast.success("Envio interrompido"); refrescar(); }, onError: (e) => toast.error(e.message) });
  const reenviar = trpc.marketing.reenviarErros.useMutation({ onSuccess: (r) => { toast.success(`Tentando de novo para ${r.total} pessoas`); refrescar(); }, onError: (e) => toast.error(e.message) });
  const [pararAberto, setPararAberto] = useState(false);

  const c = q.data?.campanha;
  const r = q.data?.resumo;
  const rodando = !!q.data?.emAndamentoNoServidor;
  const processados = r ? r.enviados + r.erros + r.ignorados : 0;
  const pct = r && r.total ? Math.round((processados / r.total) * 100) : 0;

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{c?.nome ?? "Campanha"}</DialogTitle>
            <DialogDescription>{c ? `${c.assunto} · iniciada em ${dataHora(c.iniciadoEm)}` : ""}</DialogDescription>
          </DialogHeader>
          {!c || !r ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Badge variant="outline" className={statusDe({ status: c.status, enviados: r.enviados, erros: r.erros }).classe}>{statusDe({ status: c.status, enviados: r.enviados, erros: r.erros }).rotulo}</Badge>
                  <span className="tabular-nums text-muted-foreground">{processados} de {r.total}</span>
                </div>
                <Progress value={pct} />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Enviados", r.enviados],
                  ["Na fila", r.pendentes],
                  ["Com erro", r.erros],
                  ["Cancelaram antes", r.ignorados],
                ].map(([t, v]) => (
                  <div key={t as string} className="rounded-lg border p-3">
                    <p className="text-2xl font-semibold tabular-nums">{v as number}</p>
                    <p className="text-xs text-muted-foreground">{t}</p>
                  </div>
                ))}
              </div>

              {c.status === "enviando" && !rodando && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-2">
                    <p>O envio parou (o servidor foi reiniciado no meio). Quem já recebeu não recebe de novo.</p>
                    <Button size="sm" onClick={() => continuar.mutate({ id })} disabled={continuar.isPending}>Continuar envio</Button>
                  </div>
                </div>
              )}

              {r.erros > 0 && c.status !== "enviando" && (
                <div className="space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{r.erros} {r.erros === 1 ? "envio com erro" : "envios com erro"}</p>
                    <Button size="sm" variant="outline" onClick={() => reenviar.mutate({ id })} disabled={reenviar.isPending}>Tentar de novo</Button>
                  </div>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {(q.data?.erros ?? []).map((e) => <li key={e.email}><span className="font-medium text-foreground">{e.email}</span>: {e.erro}</li>)}
                  </ul>
                </div>
              )}

              {c.status === "enviando" && (
                <Button variant="outline" onClick={() => setPararAberto(true)}><Square className="mr-2 h-4 w-4" />Parar envio</Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={pararAberto} onOpenChange={setPararAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parar este envio?</AlertDialogTitle>
            <AlertDialogDescription>Quem ainda está na fila não recebe. Quem já recebeu continua com o e-mail. Não dá para retomar depois.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => parar.mutate({ id })}>Parar envio</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function AdminCampanhas() {
  const resumo = trpc.marketing.resumo.useQuery();
  const campanhas = trpc.marketing.campanhas.useQuery(undefined, { refetchInterval: (q) => (q.state.data?.some((c) => c.status === "enviando") ? 4000 : false) });
  const utils = trpc.useUtils();
  const [aba, setAba] = useState("campanhas");
  const [editando, setEditando] = useState<{ id: number | null } | null>(null);
  const [vendo, setVendo] = useState<number | null>(null);
  const [excluir, setExcluir] = useState<number | null>(null);
  const excluirMut = trpc.marketing.excluir.useMutation({ onSuccess: () => { toast.success("Rascunho excluído"); utils.marketing.campanhas.invalidate(); setExcluir(null); }, onError: (e) => toast.error(e.message) });

  const r = resumo.data;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Campanhas de e-mail</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">Novidades e ofertas para quem autorizou receber. Cada mensagem leva o link para cancelar a inscrição.</p>
          </div>
          {aba === "campanhas" && <Button onClick={() => setEditando({ id: null })}><Plus className="mr-2 h-4 w-4" />Nova campanha</Button>}
        </div>

        <Tabs value={aba} onValueChange={setAba} className="space-y-8">
          <TabsList>
            <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
            <TabsTrigger value="sequencia">Sequência de boas-vindas</TabsTrigger>
          </TabsList>

          <TabsContent value="sequencia" className="mt-0"><SequenciaEmail /></TabsContent>

          <TabsContent value="campanhas" className="mt-0 space-y-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Indicador icone={<UserCheck className="h-5 w-5" />} titulo="Recebem suas ofertas" valor={r?.ativos ?? 0} ajuda="Autorizaram e confirmaram o e-mail" />
          <Indicador icone={<Clock className="h-5 w-5" />} titulo="Aguardando confirmação" valor={r?.pendentes ?? 0} ajuda="Ainda não clicaram no link do e-mail" />
          <Indicador icone={<UserX className="h-5 w-5" />} titulo="Cancelaram" valor={r?.descadastrados ?? 0} ajuda="Nunca mais recebem, a menos que peçam" />
        </div>
        {r && r.ativos > 0 && (
          <p className="-mt-4 text-sm text-muted-foreground">
            De onde vieram: {r.porOrigem.map((o) => `${o.rotulo} (${o.ativos})`).join(", ")}.
          </p>
        )}

        {r && r.ativos === 0 && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Sua lista ainda está vazia</CardTitle>
              <CardDescription>
                Entram na lista as pessoas que marcam “Quero receber novidades e ofertas” no formulário da home, no cadastro ou na compra da aula experimental, e depois confirmam pelo link enviado ao e-mail.
                Quem já era cliente antes dessa caixa existir não entra automaticamente, porque a autorização precisa ser dada pela própria pessoa.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Campanhas</h2>
          {campanhas.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (campanhas.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma campanha ainda. Crie a primeira e mande um teste para você antes de enviar.</p>
          ) : (
            <div className="divide-y rounded-lg border bg-card">
              {(campanhas.data ?? []).map((c) => {
                const processados = c.enviados + c.erros + c.ignorados;
                return (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{c.nome}</p>
                        <Badge variant="outline" className={statusDe(c).classe}>{statusDe(c).rotulo}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">{c.assunto}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.status === "rascunho" ? `Criada em ${dataHora(c.criadoEm)}` : `${c.enviados} enviados${c.erros ? `, ${c.erros} com erro` : ""}${c.status === "enviando" ? ` (${processados} de ${c.total})` : ""} · ${dataHora(c.iniciadoEm)}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {c.status === "rascunho" ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditando({ id: c.id })}>Editar</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setExcluir(c.id)}><MailX className="h-4 w-4" /></Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setVendo(c.id)}>
                          {c.status === "concluida" ? <CheckCircle2 className="mr-1.5 h-4 w-4" /> : null}Acompanhar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
          </TabsContent>
        </Tabs>
      </div>

      {editando && <Editor id={editando.id} onClose={() => setEditando(null)} />}
      {vendo && <Acompanhar id={vendo} onClose={() => setVendo(null)} />}
      <AlertDialog open={excluir !== null} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este rascunho?</AlertDialogTitle>
            <AlertDialogDescription>Nada foi enviado. O texto será apagado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluir && excluirMut.mutate({ id: excluir })}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
