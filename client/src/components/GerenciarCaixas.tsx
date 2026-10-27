import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type CaixaForm = {
  id?: number;
  endereco: string;
  nome: string;
  nomeRemetente: string;
  copiaPara: string;
  padrao?: boolean;
};

const VAZIO: CaixaForm = { endereco: "", nome: "", nomeRemetente: "", copiaPara: "" };

/** Atalhos para os setores mais comuns. */
const SUGESTOES: Array<{ endereco: string; nome: string }> = [
  { endereco: "financeiro", nome: "Financeiro" },
  { endereco: "rh", nome: "RH" },
  { endereco: "ti", nome: "TI" },
  { endereco: "diretoria", nome: "Diretoria" },
  { endereco: "atendimento", nome: "Atendimento" },
  { endereco: "agenda", nome: "Agenda" },
];

function semAcento(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "")
    .slice(0, 64);
}

export default function GerenciarCaixas({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const utils = trpc.useUtils();
  const caixas = trpc.caixaEmail.caixas.useQuery(undefined, { enabled: aberto });
  const status = trpc.caixaEmail.status.useQuery(undefined, { enabled: aberto });
  const dominio = status.data?.dominio ?? "shadiahasan.com";

  const [form, setForm] = useState<CaixaForm | null>(null);
  const [remetenteEditado, setRemetenteEditado] = useState(false);

  useEffect(() => {
    if (!aberto) setForm(null);
  }, [aberto]);

  const atualizar = () =>
    Promise.all([
      utils.caixaEmail.caixas.invalidate(),
      utils.caixaEmail.listar.invalidate(),
      utils.caixaEmail.contarNaoLidas.invalidate(),
    ]);

  const criar = trpc.caixaEmail.criarCaixa.useMutation({
    onSuccess: async (c) => {
      toast.success(`Caixa ${c.endereco}@${dominio} criada`);
      setForm(null);
      await atualizar();
    },
    onError: (e) => toast.error(e.message),
  });
  const editar = trpc.caixaEmail.editarCaixa.useMutation({
    onSuccess: async () => {
      toast.success("Caixa atualizada");
      setForm(null);
      await atualizar();
    },
    onError: (e) => toast.error(e.message),
  });
  const excluir = trpc.caixaEmail.excluirCaixa.useMutation({
    onSuccess: async () => {
      toast.success("Caixa excluída. As mensagens dela foram para a caixa padrão.");
      await atualizar();
    },
    onError: (e) => toast.error(e.message),
  });

  const abrirNova = (sugestao?: { endereco: string; nome: string }) => {
    setRemetenteEditado(false);
    setForm(
      sugestao
        ? { ...VAZIO, endereco: sugestao.endereco, nome: sugestao.nome, nomeRemetente: `${sugestao.nome} · Shadia Hasan` }
        : { ...VAZIO },
    );
  };

  const salvar = () => {
    if (!form) return;
    const dados = {
      endereco: form.endereco,
      nome: form.nome,
      nomeRemetente: form.nomeRemetente || `${form.nome} · Shadia Hasan`,
      copiaPara: form.copiaPara || null,
    };
    if (form.id) editar.mutate({ ...dados, id: form.id, padrao: form.padrao });
    else criar.mutate(dados);
  };

  const existentes = new Set((caixas.data ?? []).map((c) => c.endereco));
  const sugestoesLivres = SUGESTOES.filter((s) => !existentes.has(s.endereco));
  const salvando = criar.isPending || editar.isPending;
  const enderecoValido = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(form?.endereco ?? "");

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-lg [&>*]:min-w-0">
        {form === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Caixas de e-mail</DialogTitle>
              <DialogDescription>
                Cada caixa é um endereço @{dominio} com entrada própria. Não precisa mexer no DNS: o domínio já recebe qualquer
                endereço.
              </DialogDescription>
            </DialogHeader>

            <ul className="divide-y rounded-lg border">
              {(caixas.data ?? []).map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {c.nome}
                      {c.padrao && (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                          <Star className="h-3 w-3" /> padrão
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.enderecoCompleto}
                      {c.copiaPara ? ` · cópia para ${c.copiaPara}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${c.nome}`}
                    onClick={() => {
                      setRemetenteEditado(true);
                      setForm({
                        id: c.id,
                        endereco: c.endereco,
                        nome: c.nome,
                        nomeRemetente: c.nomeRemetente,
                        copiaPara: c.copiaPara ?? "",
                        padrao: c.padrao,
                      });
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!c.padrao && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Excluir ${c.nome}`}
                      disabled={excluir.isPending}
                      onClick={() => {
                        if (window.confirm(`Excluir a caixa ${c.enderecoCompleto}? As mensagens dela vão para a caixa padrão.`)) {
                          excluir.mutate({ id: c.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            {sugestoesLivres.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Criar rápido</p>
                <div className="flex flex-wrap gap-2">
                  {sugestoesLivres.map((s) => (
                    <Button key={s.endereco} variant="outline" size="sm" onClick={() => abrirNova(s)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> {s.endereco}@
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => abrirNova()}>
                <Plus className="mr-1.5 h-4 w-4" /> Nova caixa
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <button type="button" onClick={() => setForm(null)} className="rounded p-1 hover:bg-muted" aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                {form.id ? "Editar caixa" : "Nova caixa"}
              </DialogTitle>
              <DialogDescription>Mensagens enviadas para este endereço entram na caixa, e as respostas saem dele.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="caixa-nome">Nome do setor</Label>
                <Input
                  id="caixa-nome"
                  value={form.nome}
                  placeholder="Financeiro"
                  onChange={(e) => {
                    const nome = e.target.value;
                    setForm({
                      ...form,
                      nome,
                      endereco: form.id ? form.endereco : semAcento(nome),
                      nomeRemetente: remetenteEditado ? form.nomeRemetente : nome ? `${nome} · Shadia Hasan` : "",
                    });
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="caixa-endereco">Endereço</Label>
                <div className="flex items-stretch overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring">
                  <input
                    id="caixa-endereco"
                    value={form.endereco}
                    onChange={(e) => setForm({ ...form, endereco: semAcento(e.target.value) })}
                    placeholder="financeiro"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                  />
                  <span className="flex items-center border-l bg-muted px-3 text-sm text-muted-foreground">@{dominio}</span>
                </div>
                {form.endereco && !enderecoValido && (
                  <p className="text-xs text-destructive">Use só letras minúsculas, números, ponto, hífen ou sublinhado.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="caixa-remetente">Nome que aparece para quem recebe</Label>
                <Input
                  id="caixa-remetente"
                  value={form.nomeRemetente}
                  placeholder="Financeiro · Shadia Hasan"
                  onChange={(e) => {
                    setRemetenteEditado(true);
                    setForm({ ...form, nomeRemetente: e.target.value });
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="caixa-copia">Enviar cópia para (opcional)</Label>
                <Input
                  id="caixa-copia"
                  type="email"
                  value={form.copiaPara}
                  placeholder="responsavel@gmail.com"
                  onChange={(e) => setForm({ ...form, copiaPara: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Tudo que chegar nesta caixa também vai, com anexos, para este e-mail. Útil para quem não entra no painel.
                </p>
              </div>

              {form.id && !form.padrao && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.padrao}
                    onChange={(e) => setForm({ ...form, padrao: e.target.checked })}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  Tornar padrão (recebe o que for para endereços sem caixa)
                </label>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={!form.nome.trim() || !enderecoValido || salvando}>
                {salvando ? "Salvando..." : form.id ? "Salvar" : "Criar caixa"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

