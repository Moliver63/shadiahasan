import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { isValidCpfCnpj, onlyDigits } from "@shared/br-document";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { trackEvent, trackInitiateCheckout } from "@/components/Analytics";
import { atribuicaoAtual } from "@/lib/metaAttribution";
import { formatBRL } from "@/components/TrialPassDialog";
import { guardarCompra } from "@/lib/compraSemConta";
import { getLoginUrl } from "@/const";
import { guardarIntencao } from "@/lib/trialIntent";

function formatCpf(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.trim());

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: number;
  priceCents: number;
  validDays: number;
};

/**
 * Compra do teste de 1 aula para quem NÃO tem conta: uma tela só, sem senha.
 * A conta é criada quando o Pix for pago (ver server/trialGuest.ts).
 */
export default function GuestCheckoutDialog({ open, onOpenChange, lessonId, priceCents, validDays }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const comprar = trpc.trial.guestCheckout.useMutation();

  const emailLimpo = email.trim().toLowerCase();
  const pronto = nome.trim().length >= 3 && nome.trim().split(/\s+/).length >= 2 && emailOk(emailLimpo) && isValidCpfCnpj(onlyDigits(cpf));

  const confirmar = async () => {
    if (nome.trim().length < 3 || nome.trim().split(/\s+/).length < 2) return toast.error("Digite nome e sobrenome, como no seu documento.");
    if (!emailOk(emailLimpo)) return toast.error("Confira o e-mail digitado.");
    if (!isValidCpfCnpj(onlyDigits(cpf))) return toast.error("CPF inválido. Confira os números.");
    trackInitiateCheckout({ contentId: `lesson:${lessonId}`, contentName: "Teste de 1 aula", value: priceCents / 100 });
    try {
      const r = await comprar.mutateAsync({
        lessonId,
        nome: nome.trim(),
        email: emailLimpo,
        cpfCnpj: onlyDigits(cpf),
        atribuicao: atribuicaoAtual(),
      });
      trackEvent("checkout_created_pending", { provider: "asaas", item_type: "lesson_trial" });
      guardarCompra(r.token);
      // Mesma aba: no navegador do Facebook, abrir aba nova se perde com facilidade
      window.location.assign(`/compra/aguardando#t=${r.token}`);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível gerar o Pix. Tente de novo.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Assistir esta aula por {formatBRL(priceCents)}</DialogTitle>
          <DialogDescription className="text-base">
            Pagamento único, sem renovação. A aula fica liberada por {validDays} dias assim que o Pix cair.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); void confirmar(); }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="guestNome" className="text-base">Nome completo</Label>
            <Input id="guestNome" data-clarity-mask="true" autoComplete="name" placeholder="Nome e sobrenome" className="h-12 text-base" value={nome} onChange={(e) => setNome(e.target.value)} />
            <p className="text-xs text-muted-foreground">Como no seu documento. É o nome que sai no seu certificado.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guestEmail" className="text-base">Seu e-mail</Label>
            <Input
              id="guestEmail"
              data-clarity-mask="true"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              className="h-12 text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {emailOk(emailLimpo) && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Confira: o acesso vai para <strong className="[overflow-wrap:anywhere]">{emailLimpo}</strong>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guestCpf" className="text-base">CPF</Label>
            <Input
              id="guestCpf"
              data-clarity-mask="true"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              className="h-12 text-base"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">O banco exige o CPF para emitir o Pix.</p>
          </div>

          <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={!pronto || comprar.isPending}>
            {comprar.isPending ? "Gerando o Pix..." : `Gerar Pix de ${formatBRL(priceCents)}`}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Você não precisa criar senha agora.
          </p>
          <p className="text-center text-sm">
            Já tem conta?{" "}
            <a href={getLoginUrl()} onClick={() => guardarIntencao(lessonId)} className="font-medium text-purple-700 underline">Entrar</a>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
