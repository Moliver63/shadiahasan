import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, FileText, QrCode, ShieldCheck, type LucideIcon } from "lucide-react";
import { isValidCpfCnpj, onlyDigits } from "@shared/br-document";
import { NOME_METODO, formatarReais, type MetodoPagamento } from "@shared/comercial";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { trackEvent, trackInitiateCheckout } from "@/components/Analytics";
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
};

/**
 * Compra avulsa de um Programa. O valor exibido é só informativo: o servidor
 * cobra o preço gravado no banco. O acesso é liberado pelo webhook do Asaas.
 */
export default function ProgramaCheckoutDialog({ open, onOpenChange, collectionId, titulo, priceCents, metodos }: Props) {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [metodo, setMetodo] = useState<MetodoPagamento | null>(metodos[0] ?? null);
  const checkout = trpc.comercial.checkout.useMutation();

  useEffect(() => {
    if (!metodo || !metodos.includes(metodo)) setMetodo(metodos[0] ?? null);
  }, [metodos, metodo]);

  const confirmar = async () => {
    if (!metodo) return;
    if (!isValidCpfCnpj(cpfCnpj)) {
      toast.error("CPF ou CNPJ inválido. Confira os números.");
      return;
    }
    // Abre a aba no próprio clique: navegadores bloqueiam window.open depois de um await.
    const aba = window.open("about:blank", "_blank");
    try {
      trackInitiateCheckout({ contentId: `programa:${collectionId}`, contentName: titulo, value: priceCents / 100 });
      const r = await checkout.mutateAsync({ collectionId, cpfCnpj: onlyDigits(cpfCnpj), metodo });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="leading-snug">{titulo}</DialogTitle>
          <DialogDescription>
            {formatarReais(priceCents)} em pagamento único. O acesso é liberado na sua conta assim que o pagamento for confirmado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor="programaCpf">CPF ou CNPJ</Label>
            <Input
              id="programaCpf"
              data-clarity-mask="true"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Exigido pelo Asaas para emitir a cobrança.</p>
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            Pagamento processado pelo Asaas. Não guardamos dados do seu cartão.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={checkout.isPending || !metodo}>
            {checkout.isPending ? "Gerando pagamento..." : `Pagar ${formatarReais(priceCents)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
