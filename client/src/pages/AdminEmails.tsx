import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Forward,
  Inbox,
  Mail,
  MailOpen,
  Paperclip,
  PenLine,
  RefreshCw,
  Reply,
  Search,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Pasta = "entrada" | "arquivadas" | "enviados" | "lixeira";

const PASTAS: Array<{ id: Pasta; rotulo: string; icone: typeof Inbox }> = [
  { id: "entrada", rotulo: "Entrada", icone: Inbox },
  { id: "arquivadas", rotulo: "Arquivadas", icone: Archive },
  { id: "enviados", rotulo: "Enviados", icone: Send },
  { id: "lixeira", rotulo: "Lixeira", icone: Trash2 },
];

/** "Maria Souza <maria@x.com>" → { nome: "Maria Souza", email: "maria@x.com" } */
function separarRemetente(remetente: string) {
  const m = remetente.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { nome: m[1].trim() || m[2], email: m[2].trim() };
  return { nome: remetente.trim(), email: remetente.trim() };
}

function iniciais(nome: string) {
  const partes = nome.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((partes[0]?.[0] || "?") + (partes[1]?.[0] || "")).toUpperCase();
}

function dataCurta(valor: string | Date) {
  const d = new Date(valor);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const mesmoAno = d.getFullYear() === hoje.getFullYear();
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", ...(mesmoAno ? {} : { year: "numeric" }) });
}

function dataLonga(valor: string | Date) {
  return new Date(valor).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Corpo HTML do e-mail num iframe isolado: sem scripts (sandbox sem
 * allow-scripts), links abrem em nova aba e o estilo do e-mail não vaza para o
 * painel. allow-same-origin só serve para medir a altura do conteúdo.
 */
function CorpoHtml({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [altura, setAltura] = useState(240);
  const doc = useMemo(
    () =>
      `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">` +
      `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; frame-src 'none'">` +
      `<style>body{margin:0;padding:4px 2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:#24303A;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}blockquote{margin:8px 0;padding-left:12px;border-left:2px solid #E3DDD3;color:#5B6770}</style>` +
      `</head><body>${html}</body></html>`,
    [html],
  );

  const medir = () => {
    const b = ref.current?.contentDocument?.body;
    if (b) setAltura(Math.min(Math.max(b.scrollHeight + 16, 120), 20000));
  };

  return (
    <iframe
      ref={ref}
      title="Conteúdo do e-mail"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
      onLoad={() => {
        medir();
        // Imagens carregam depois do onload do documento.
        setTimeout(medir, 400);
        setTimeout(medir, 1500);
      }}
      className="w-full rounded-md border-0 bg-white"
      style={{ height: altura }}
    />
  );
}

function CorpoTexto({ texto }: { texto: string }) {
  return <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">{texto}</div>;
}

export default function AdminEmails() {
  const utils = trpc.useUtils();
  const [pasta, setPasta] = useState<Pasta>("entrada");
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [respondendo, setRespondendo] = useState(false);
  const [resposta, setResposta] = useState("");
  const [encaminharAberto, setEncaminharAberto] = useState(false);
  const [encaminharPara, setEncaminharPara] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const [novo, setNovo] = useState({ para: "", assunto: "", corpo: "" });

  const status = trpc.caixaEmail.status.useQuery();
  const naoLidas = trpc.caixaEmail.contarNaoLidas.useQuery(undefined, { refetchInterval: 60_000 });
  const recebidos = trpc.caixaEmail.listar.useQuery(
    { pasta: pasta === "enviados" ? "entrada" : pasta },
    { enabled: pasta !== "enviados", refetchInterval: pasta === "entrada" ? 60_000 : false },
  );
  const enviados = trpc.caixaEmail.listarEnviados.useQuery(undefined, { enabled: pasta === "enviados" });
  const mensagem = trpc.caixaEmail.obter.useQuery(
    { id: selecionado ?? 0 },
    { enabled: pasta !== "enviados" && selecionado !== null },
  );

  const atualizar = async () => {
    await Promise.all([
      utils.caixaEmail.listar.invalidate(),
      utils.caixaEmail.contarNaoLidas.invalidate(),
      utils.caixaEmail.listarEnviados.invalidate(),
      utils.caixaEmail.obter.invalidate(),
    ]);
  };

  // Abrir marca como lida no servidor: atualiza lista e contador.
  useEffect(() => {
    if (mensagem.data) {
      void utils.caixaEmail.listar.invalidate();
      void utils.caixaEmail.contarNaoLidas.invalidate();
    }
  }, [mensagem.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSelecionado(null);
    setRespondendo(false);
    setBusca("");
  }, [pasta]);

  useEffect(() => {
    setRespondendo(false);
    setResposta("");
  }, [selecionado]);

  const sincronizar = trpc.caixaEmail.sincronizar.useMutation({
    onSuccess: async (r) => {
      await atualizar();
      toast.success(r.novas ? `${r.novas} ${r.novas === 1 ? "mensagem nova" : "mensagens novas"}` : "Nenhuma mensagem nova");
    },
    onError: (e) => toast.error(e.message),
  });
  const marcarLida = trpc.caixaEmail.marcarLida.useMutation({ onSuccess: atualizar, onError: (e) => toast.error(e.message) });
  const arquivar = trpc.caixaEmail.arquivar.useMutation({ onSuccess: atualizar, onError: (e) => toast.error(e.message) });
  const excluir = trpc.caixaEmail.excluir.useMutation({ onSuccess: atualizar, onError: (e) => toast.error(e.message) });
  const excluirDeVez = trpc.caixaEmail.excluirDeVez.useMutation({ onSuccess: atualizar, onError: (e) => toast.error(e.message) });
  const linkAnexo = trpc.caixaEmail.linkAnexo.useMutation({
    onSuccess: (r) => window.open(r.url, "_blank", "noopener"),
    onError: (e) => toast.error(e.message),
  });
  const responder = trpc.caixaEmail.responder.useMutation({
    onSuccess: async () => {
      toast.success("Resposta enviada");
      setRespondendo(false);
      setResposta("");
      await atualizar();
    },
    onError: (e) => toast.error(e.message),
  });
  const encaminhar = trpc.caixaEmail.encaminhar.useMutation({
    onSuccess: () => {
      toast.success("Mensagem encaminhada");
      setEncaminharAberto(false);
      setEncaminharPara("");
    },
    onError: (e) => toast.error(e.message),
  });
  const enviarNovo = trpc.caixaEmail.enviarNovo.useMutation({
    onSuccess: async () => {
      toast.success("E-mail enviado");
      setNovoAberto(false);
      setNovo({ para: "", assunto: "", corpo: "" });
      await atualizar();
    },
    onError: (e) => toast.error(e.message),
  });

  const termo = busca.trim().toLowerCase();
  const listaRecebidos = useMemo(
    () =>
      (recebidos.data ?? []).filter(
        (m) => !termo || `${m.remetente} ${m.assunto ?? ""} ${m.previa ?? ""}`.toLowerCase().includes(termo),
      ),
    [recebidos.data, termo],
  );
  const listaEnviados = useMemo(
    () =>
      (enviados.data ?? []).filter(
        (m) => !termo || `${m.destinatario} ${m.assunto ?? ""} ${m.corpo}`.toLowerCase().includes(termo),
      ),
    [enviados.data, termo],
  );
  const enviadoSelecionado = pasta === "enviados" ? (enviados.data ?? []).find((m) => m.id === selecionado) : undefined;

  const carregandoLista = pasta === "enviados" ? enviados.isLoading : recebidos.isLoading;
  const vazio = pasta === "enviados" ? listaEnviados.length === 0 : listaRecebidos.length === 0;
  const m = mensagem.data;

  // ─── Lista ─────────────────────────────────────────────────────────────────
  const lista = (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, assunto ou texto"
            className="pl-9"
            aria-label="Buscar mensagens"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {carregandoLista ? (
          <div className="space-y-px p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-md p-3">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : vazio ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <MailOpen className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">{termo ? "Nada encontrado" : "Nada por aqui"}</p>
            <p className="text-xs text-muted-foreground">
              {termo
                ? "Tente outra palavra."
                : pasta === "entrada"
                  ? "Mensagens enviadas para o e-mail de contato aparecem aqui."
                  : pasta === "enviados"
                    ? "Respostas e e-mails escritos aqui ficam guardados nesta pasta."
                    : "Pasta vazia."}
            </p>
          </div>
        ) : pasta === "enviados" ? (
          <ul className="divide-y">
            {listaEnviados.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelecionado(e.id)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                    selecionado === e.id && "bg-muted",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">Para: {e.destinatario}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{dataCurta(e.criadoEm)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm">{e.assunto || "(sem assunto)"}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{e.corpo}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y">
            {listaRecebidos.map((r) => {
              const { nome } = separarRemetente(r.remetente);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelecionado(r.id)}
                    className={cn(
                      "relative w-full px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                      selecionado === r.id && "bg-muted",
                    )}
                  >
                    {!r.lida && <span className="absolute left-1.5 top-[1.15rem] h-2 w-2 rounded-full bg-primary" aria-label="Não lida" />}
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={cn("truncate text-sm", r.lida ? "text-foreground/80" : "font-semibold")}>{nome}</span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {r.temAnexo && <Paperclip className="h-3 w-3" aria-label="Com anexo" />}
                        {r.respondida && <Reply className="h-3 w-3" aria-label="Respondida" />}
                        {dataCurta(r.recebidoEm)}
                      </span>
                    </div>
                    <p className={cn("mt-0.5 truncate text-sm", !r.lida && "font-medium")}>{r.assunto || "(sem assunto)"}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{r.previa}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  // ─── Leitura ───────────────────────────────────────────────────────────────
  const voltar = (
    <Button variant="ghost" size="sm" className="-ml-2 md:hidden" onClick={() => setSelecionado(null)}>
      <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
    </Button>
  );

  const leituraVazia = (
    <div className="hidden h-full flex-col items-center justify-center gap-2 text-center md:flex">
      <Mail className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Selecione uma mensagem para ler</p>
    </div>
  );

  let leitura: React.ReactNode = leituraVazia;

  if (pasta === "enviados" && enviadoSelecionado) {
    leitura = (
      <div className="space-y-5 p-5 md:p-8">
        {voltar}
        <div>
          <h2 className="font-serif text-2xl leading-snug">{enviadoSelecionado.assunto || "(sem assunto)"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Para <span className="text-foreground">{enviadoSelecionado.destinatario}</span> · {dataLonga(enviadoSelecionado.criadoEm)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <CorpoTexto texto={enviadoSelecionado.corpo} />
        </div>
      </div>
    );
  } else if (pasta !== "enviados" && selecionado !== null) {
    if (mensagem.isLoading || !m) {
      leitura = (
        <div className="space-y-4 p-5 md:p-8">
          {voltar}
          <Skeleton className="h-7 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-48 w-full" />
        </div>
      );
    } else {
      const { nome, email } = separarRemetente(m.remetente);
      const naLixeira = m.excluida;
      leitura = (
        <div className="space-y-5 p-5 md:p-8">
          {voltar}
          <h2 className="font-serif text-2xl leading-snug">{m.assunto || "(sem assunto)"}</h2>

          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {iniciais(nome)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{nome}</p>
              <p className="truncate text-xs text-muted-foreground">
                {email !== nome ? `${email} · ` : ""}
                {dataLonga(m.recebidoEm)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!naLixeira && (
              <>
                <Button size="sm" onClick={() => setRespondendo(true)}>
                  <Reply className="mr-1.5 h-4 w-4" /> Responder
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEncaminharAberto(true)}>
                  <Forward className="mr-1.5 h-4 w-4" /> Encaminhar
                </Button>
                <Button size="sm" variant="outline" onClick={() => arquivar.mutate({ id: m.id, arquivada: !m.arquivada })}>
                  {m.arquivada ? <ArchiveRestore className="mr-1.5 h-4 w-4" /> : <Archive className="mr-1.5 h-4 w-4" />}
                  {m.arquivada ? "Voltar para entrada" : "Arquivar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    marcarLida.mutate({ id: m.id, lida: false });
                    setSelecionado(null);
                  }}
                >
                  <Mail className="mr-1.5 h-4 w-4" /> Não lida
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    excluir.mutate({ id: m.id, excluida: true });
                    setSelecionado(null);
                  }}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
                </Button>
              </>
            )}
            {naLixeira && (
              <>
                <Button size="sm" variant="outline" onClick={() => excluir.mutate({ id: m.id, excluida: false })}>
                  <Undo2 className="mr-1.5 h-4 w-4" /> Restaurar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (!window.confirm("Apagar esta mensagem de vez? Não dá para desfazer.")) return;
                    excluirDeVez.mutate({ id: m.id });
                    setSelecionado(null);
                  }}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Apagar de vez
                </Button>
              </>
            )}
          </div>

          {m.anexos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {m.anexos.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => linkAnexo.mutate({ id: m.id, anexoId: a.id })}
                  disabled={linkAnexo.isPending}
                  className="inline-flex max-w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-60"
                  title="Baixar anexo"
                >
                  <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{a.filename}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{tamanho(a.size)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="rounded-lg border bg-white p-4 md:p-5">
            {m.corpoHtml ? (
              <CorpoHtml html={m.corpoHtml} />
            ) : m.corpoTexto ? (
              <CorpoTexto texto={m.corpoTexto} />
            ) : (
              <p className="text-sm text-muted-foreground">Mensagem sem texto.</p>
            )}
          </div>

          {m.respostas.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suas respostas</p>
              {m.respostas.map((r) => (
                <div key={r.id} className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Para {r.destinatario} · {dataLonga(r.criadoEm)}
                  </p>
                  <CorpoTexto texto={r.corpo} />
                </div>
              ))}
            </div>
          )}

          {respondendo && (
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                Para <span className="text-foreground">{email}</span>. Sai de {status.data?.endereco ?? "contato@"} com a assinatura da marca e a mensagem
                original citada.
              </p>
              <Textarea
                autoFocus
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                rows={8}
                placeholder="Escreva sua resposta"
                className="min-h-40 text-[15px]"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setRespondendo(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => responder.mutate({ id: m.id, corpo: resposta })}
                  disabled={!resposta.trim() || responder.isPending}
                >
                  <Send className="mr-1.5 h-4 w-4" />
                  {responder.isPending ? "Enviando..." : "Enviar resposta"}
                </Button>
              </div>
            </div>
          )}
        </div>
      );
    }
  }

  const contador = naoLidas.data ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">E-mails</h1>
            <p className="text-muted-foreground">
              Caixa de {status.data?.endereco ?? "contato@shadiahasan.com"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => sincronizar.mutate()}
              disabled={sincronizar.isPending || status.data?.resendConfigurado === false}
              title="Busca no Resend mensagens que ainda não apareceram aqui"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", sincronizar.isPending && "animate-spin")} />
              {sincronizar.isPending ? "Buscando..." : "Buscar novas"}
            </Button>
            <Button onClick={() => setNovoAberto(true)} disabled={status.data?.resendConfigurado === false}>
              <PenLine className="mr-2 h-4 w-4" /> Escrever
            </Button>
          </div>
        </div>

        {status.data && !status.data.resendConfigurado && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            A chave do Resend (<code>RESEND_API_KEY</code>) não está configurada no servidor. Sem ela a caixa não recebe nem envia.
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Pastas">
          {PASTAS.map(({ id, rotulo, icone: Icone }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pasta === id}
              onClick={() => setPasta(id)}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
                pasta === id
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone className="h-4 w-4" />
              {rotulo}
              {id === "entrada" && contador > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary-foreground">
                  {contador}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border bg-card md:grid md:h-[calc(100vh-15rem)] md:min-h-[520px] md:grid-cols-[minmax(300px,380px)_1fr]">
          <div className={cn("h-[calc(100vh-17rem)] min-h-[420px] md:h-auto md:border-r", selecionado !== null && "hidden md:block")}>
            {lista}
          </div>
          <div className={cn("min-h-0 overflow-y-auto bg-background/40", selecionado === null && "hidden md:block")}>{leitura}</div>
        </div>
      </div>

      <Dialog open={encaminharAberto} onOpenChange={setEncaminharAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encaminhar mensagem</DialogTitle>
            <DialogDescription>A mensagem original vai inteira, com os anexos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="encaminhar-para">Para</Label>
            <Input
              id="encaminhar-para"
              type="email"
              value={encaminharPara}
              onChange={(e) => setEncaminharPara(e.target.value)}
              placeholder="nome@exemplo.com"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEncaminharAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => m && encaminhar.mutate({ id: m.id, para: encaminharPara })}
              disabled={!m || !/^\S+@\S+\.\S+$/.test(encaminharPara) || encaminhar.isPending}
            >
              {encaminhar.isPending ? "Encaminhando..." : "Encaminhar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo e-mail</DialogTitle>
            <DialogDescription>
              Sai de {status.data?.endereco ?? "contato@shadiahasan.com"} com a assinatura da marca. As respostas chegam nesta caixa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="novo-para">Para</Label>
              <Input
                id="novo-para"
                type="email"
                value={novo.para}
                onChange={(e) => setNovo({ ...novo, para: e.target.value })}
                placeholder="nome@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-assunto">Assunto</Label>
              <Input id="novo-assunto" value={novo.assunto} onChange={(e) => setNovo({ ...novo, assunto: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novo-corpo">Mensagem</Label>
              <Textarea
                id="novo-corpo"
                rows={10}
                value={novo.corpo}
                onChange={(e) => setNovo({ ...novo, corpo: e.target.value })}
                className="min-h-48 text-[15px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovoAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => enviarNovo.mutate(novo)}
              disabled={
                !/^\S+@\S+\.\S+$/.test(novo.para) || !novo.assunto.trim() || !novo.corpo.trim() || enviarNovo.isPending
              }
            >
              <Send className="mr-1.5 h-4 w-4" />
              {enviarNovo.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
