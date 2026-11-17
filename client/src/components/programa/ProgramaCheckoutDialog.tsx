import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, FileText, Lock, QrCode, ShieldCheck, type LucideIcon } from "lucide-react";
import { isValidCpfCnpj, onlyDigits } from "@shared/br-document";
import { NOME_METODO, formatarReais, type MetodoPagamento } from "@shared/comercial";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { trackEvent, trackInitiateCheckout } from "@/components/Analytics";
import { atribuicaoAtual } from "@/lib/metaAttribution";
import { CHAVE_PROGRAMA, guardarCompra } from "@/lib/compraSemConta";
import { AutorizacaoEmail } from "@/components/AutorizacaoEmail";
import { cn } from "@/lib/utils";

function formatCpfCnpj(value: string) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.trim());

const ICONE: Record<MetodoPagamento, LucideIcon> = { pix: QrCode, cartao: CreditCard, boleto: FileText };
const DICA: Record<MetodoPagamento, string> = {
  pix: "Liberação em poucos minutos",
  cartao: "Liberação após a aprovação",
  boleto: "Liberação após a compensação (até 3 dias úteis)",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: number;
  titulo: string;
  priceCents: number;
  metodos: MetodoPagamento[];
  /** Sem login: compra sem conta (nome, e-mail e CPF); a conta nasce quando o pagamento cair. */
  logado: boolean;
};

/**
 * Compra avulsa de um Programa. O valor exibido é só informativo: o servidor
 * cobra o preço gravado no banco. O acesso é liberado pela confirmação do Asaas.
 */
export default function ProgramaCheckoutDialog({ open, onOpenChange, collectionId, titulo, priceCents, metodos, logado }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [aceitaNovidades, setAceitaNovidades] = useState(false);
  const [metodo, setMetodo] = useState<MetodoPagamento | null>(metodos[0] ?? null);
  const checkout = trpc.comercial.checkout.useMutation();
  const guest = trpc.comercial.guestCheckout.useMutation();
  const pendente = checkout.isPending || guest.isPending;

  useEffect(() => {
    if (!metodo || !metodos.includes(metodo)) setMetodo(metodos[0] ?? null);
  }, [metodos, metodo]);

  const emailLimpo = email.trim().toLowerCase();
  const nomeOk = nome.trim().length >= 3 && nome.trim().split(/\s+/).length >= 2;
  const pronto = !!metodo && isValidCpfCnpj(onlyDigits(cpfCnpj)) && (logado || (nomeOk && emailOk(emailLimpo)));

  const confirmar = async () => {
    if (!metodo) return;
    if (!logado && !nomeOk) return toast.error("Digite nome e sobrenome, como no seu documento.");
    if (!logado && !emailOk(emailLimpo)) return toast.error("Confira o e-mail digitado.");
    if (!isValidCpfCnpj(onlyDigits(cpfCnpj))) return toast.error("CPF ou CNPJ inválido. Confira os números.");
    trackInitiateCheckout({ contentId: `programa:${collectionId}`, contentName: titulo, value: priceCents / 100 });

    if (!logado) {
      // Sem conta: segue na mesma aba (no navegador do Facebook, aba nova se perde)
      try {
        const r = await guest.mutateAsync({
          collectionId, nome: nome.trim(), email: emailLimpo, cpfCnpj: onlyDigits(cpfCnpj), metodo, aceitaNovidades, atribuicao: atribuicaoAtual(),
        });
        if (!r) throw new Error("Não foi possível gerar o pagamento.");
        trackEvent("checkout_created_pending", { provider: "asaas", item_type: "programa", sem_conta: true });
        guardarCompra(r.token, Date.now(), CHAVE_PROGRAMA);
        window.location.assign(`/compra/programa#t=${r.token}`);
      } catch (e: any) {
        toast.error(e?.message || "Não foi possível gerar o pagamento. Tente de novo.");
      }
      return;
    }

    // Logado: a fatura abre em outra aba, aberta no próprio clique (navegadores bloqueiam depois de um await)
    const aba = window.open("about:blank", "_blank");
    try {
      const r = await checkout.mutateAsync({ collectionId, cpfCnpj: onlyDigits(cpfCnpj), metodo, atribuicao: atribuicaoAtual() });
      if (!r) throw new Error("Não foi possível gerar o pagamento.");
      trackEvent("checkout_created_pending", { provider: "asaas", item_type: "programa" });
      onOpenChange(false);
      if (aba) {
        aba.opener = null;
        aba.location.href = r.url;
      } else {
        window.location.assign(r.url);
      }
      toast.success("Abrindo a página de pagamento. Assim que o pagamento for confirmado, o programa aparece na Minha Área.");
    } catch (e: any) {
      aba?.close();
      toast.error(e?.message || "Erro ao criar o pagamento. Tente de novo.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="leading-snug">{titulo}</DialogTitle>
          <DialogDescription>
            {formatarReais(priceCents)} em pagamento único. O acesso é liberado assim que o pagamento for confirmado.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void confirmar(); }}>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2">Forma de pagamento</legend>
            <div className="grid gap-2">
              {metodos.map((m) => {
                const Icone = ICONE[m];
                const ativo = metodo === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetodo(m)}
                    aria-pressed={ativo}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                      ativo ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40",
                    )}
                  >
                    <Icone className={cn("h-5 w-5 shrink-0", ativo ? "text-primary" : "text-muted-foreground")} />
                    <span>
                      <span className="block text-sm font-medium">{NOME_METODO[m]}</span>
                      <span className="block text-xs text-muted-foreground">{DICA[m]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {!logado && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="progNome">Nome completo</Label>
                <Input id="progNome" data-clarity-mask="true" autoComplete="name" placeholder="Nome e sobrenome" className="h-11" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="progEmail">Seu e-mail</Label>
                <Input id="progEmail" data-clarity-mask="true" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
                {emailOk(emailLimpo) && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    O acesso vai para <strong className="[overflow-wrap:anywhere]">{emailLimpo}</strong>
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="programaCpf">{logado ? "CPF ou CNPJ" : "CPF"}</Label>
            <Input
              id="programaCpf"
              data-clarity-mask="true"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              className="h-11"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Exigido pelo Asaas para emitir a cobrança.</p>
          </div>

          {!logado && <AutorizacaoEmail id="progNovidades" marcada={aceitaNovidades} onChange={setAceitaNovidades} />}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            Pagamento processado pelo Asaas. Não guardamos dados do seu cartão.
          </p>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={pendente || !pronto}>
              {pendente ? "Gerando pagamento..." : `Pagar ${formatarReais(priceCents)}`}
            </Button>
          </DialogFooter>

          {!logado && (
            <div className="space-y-1 text-center">
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Você não precisa criar senha agora. A conta é criada quando o pagamento cair.
              </p>
              <p className="text-sm">
                Já tem conta?{" "}
                <a href={`/login?next=${encodeURIComponent(`/collections/${collectionId}?comprar=1`)}`} className="font-medium text-primary underline">Entrar</a>
              </p>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
