import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode } from "lucide-react";
import { isValidCpfCnpj, onlyDigits } from "@shared/br-document";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { trackInitiateCheckout } from "@/components/Analytics";
import { atribuicaoAtual } from "@/lib/metaAttribution";

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: number;
  priceCents: number;
  validDays: number;
};

/** Pagamento do teste de 1 aula (PIX, boleto ou cartão na fatura do Asaas). */
export default function TrialPassDialog({ open, onOpenChange, lessonId, priceCents, validDays }: Props) {
  const [cpfCnpj, setCpfCnpj] = useState("");
  const createCheckout = trpc.trial.createCheckout.useMutation();

  const confirm = async () => {
    if (!isValidCpfCnpj(cpfCnpj)) {
      toast.error("CPF ou CNPJ inválido. Confira os números.");
      return;
    }
    // Abre a aba no gesto do clique; navegadores podem bloquear window.open após o await.
    const paymentWindow = window.open("about:blank", "_blank");
    try {
      /**
       * InitiateCheckout aqui, não na abertura do diálogo: este é o clique que
       * efetivamente cria a cobrança. Este fluxo é o do produto anunciado
       * (a aula por R$ 19,90) e não disparava evento nenhum.
       *
       * A atribuição vai junto porque o pagamento acontece na fatura do Asaas,
       * fora do site: sem `_fbp`/`_fbc` guardados agora, o `Purchase` que o
       * servidor manda depois não tem como ser ligado ao clique no anúncio.
       */
      trackInitiateCheckout({
        contentId: `lesson:${lessonId}`,
        contentName: "Teste de 1 aula",
        value: priceCents / 100,
      });
      const result = await createCheckout.mutateAsync({
        lessonId,
        cpfCnpj: onlyDigits(cpfCnpj),
        atribuicao: atribuicaoAtual(),
      });
      onOpenChange(false);
      if (paymentWindow) {
        paymentWindow.opener = null;
        paymentWindow.location.href = result.url;
      } else {
        // Fallback para navegadores que bloquearam a aba: continua o checkout na aba atual.
        window.location.assign(result.url);
      }
      toast.success("Abrindo página de pagamento...");
    } catch (error: any) {
      paymentWindow?.close();
      toast.error(error?.message || "Erro ao criar pagamento. Tente novamente.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assistir esta aula por {formatBRL(priceCents)}</DialogTitle>
          <DialogDescription>
            Pagamento único, sem renovação. Você assiste à aula completa por {validDays} dias depois que o pagamento for confirmado.
            Se gostar, é só assinar um plano mensal para continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-purple-600 bg-purple-50 p-4">
            <QrCode className="h-5 w-5 mt-0.5 shrink-0 text-purple-600" />
            <span>
              <span className="block font-medium">PIX, boleto ou cartão</span>
              <span className="block text-sm text-muted-foreground">Você escolhe na próxima tela</span>
            </span>
          </div>

          <div className="space-y-2 pt-1">
            <Label htmlFor="trialCpfCnpj">CPF ou CNPJ</Label>
            <Input
              id="trialCpfCnpj"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Exigido para emitir PIX e boleto.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={createCheckout.isPending}>
            {createCheckout.isPending ? "Gerando pagamento..." : `Pagar ${formatBRL(priceCents)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
