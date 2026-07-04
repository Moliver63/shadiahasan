import { useState } from "react";
import { Mail, Gift, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { trackLead } from "@/components/Analytics";
import { toast } from "sonner";

/**
 * LeadCapture — captura de email na home (lead magnet)
 * Oferece a primeira aula gratuita em troca do email.
 * Leads ficam na tabela `leads` — exportáveis via trpc.leads.listAll (admin).
 */
export default function LeadCapture() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);

  const captureMutation = trpc.leads.capture.useMutation({
    onSuccess: () => {
      setDone(true);
      trackLead("home-lead-magnet");
    },
    onError: () => {
      toast.error("Não foi possível salvar seu email. Tente novamente em instantes.");
    },
  });

  const handleSubmit = () => {
    if (!email.includes("@")) return;
    captureMutation.mutate({ email, name: name || undefined, source: "home" });
  };

  if (done) {
    return (
      <section className="py-16 bg-primary/5">
        <div className="container">
          <div className="max-w-xl mx-auto text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h3 className="text-2xl font-bold">Pronto! Verifique seu email</h3>
            <p className="text-muted-foreground">
              Enviamos o acesso à sua aula gratuita. Se não encontrar, confira a
              caixa de spam.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-primary/5">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm font-medium">
            <Gift className="h-4 w-4" />
            Presente de boas-vindas
          </div>

          <h2 className="text-3xl md:text-4xl font-bold">
            Experimente uma aula completa, grátis
          </h2>
          <p className="text-lg text-muted-foreground">
            Deixe seu email e receba acesso imediato a uma aula da Shadia —
            sem cartão de crédito, sem compromisso.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <Input
              type="text"
              placeholder="Seu nome (opcional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sm:max-w-[160px]"
            />
            <Input
              type="email"
              placeholder="Seu melhor email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="flex-1"
            />
            <Button
              onClick={handleSubmit}
              disabled={captureMutation.isPending || !email.includes("@")}
              className="shrink-0"
            >
              <Mail className="h-4 w-4 mr-2" />
              {captureMutation.isPending ? "Enviando..." : "Quero minha aula"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Sem spam. Você pode cancelar quando quiser.
          </p>
        </div>
      </div>
    </section>
  );
}
