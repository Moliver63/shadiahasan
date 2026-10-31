import { useState } from "react";
import { Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutorizacaoEmail } from "@/components/AutorizacaoEmail";
import { trpc } from "@/lib/trpc";
import { trackLead } from "@/components/Analytics";
import { toast } from "sonner";

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.trim());

/**
 * LeadCapture: inscrição para receber novidades por e-mail (home).
 *
 * Antes (31/10/2026) o texto prometia "acesso imediato a uma aula gratuita", mas nada era
 * enviado e não existe aula gratuita no site. Agora o texto diz o que a pessoa realmente
 * recebe, exige a caixa de autorização (LGPD) e a inscrição só vale depois do clique no
 * link enviado ao e-mail (dupla confirmação). Ver server/marketing.ts.
 */
export default function LeadCapture() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [aceita, setAceita] = useState(false);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);

  const inscrever = trpc.marketing.inscrever.useMutation({
    onSuccess: () => {
      setEnviadoPara(email.trim().toLowerCase());
      trackLead("home-newsletter");
    },
    onError: (e) => {
      toast.error(e.message || "Não foi possível concluir. Tente novamente em instantes.");
    },
  });

  const pronto = emailOk(email) && aceita;

  const enviar = () => {
    if (!pronto || inscrever.isPending) return;
    inscrever.mutate({ email: email.trim(), nome: name.trim() || undefined, aceito: true });
  };

  if (enviadoPara) {
    return (
      <section className="py-16 bg-primary/5">
        <div className="container">
          <div className="max-w-xl mx-auto text-center space-y-3">
            <MailCheck className="h-12 w-12 text-primary mx-auto" />
            <h3 className="text-2xl font-bold">Falta só um passo</h3>
            <p className="text-muted-foreground">
              Enviamos um link para <strong className="[overflow-wrap:anywhere]">{enviadoPara}</strong>. Clique nele para ativar sua inscrição.
              Se não encontrar, olhe a caixa de spam.
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
            <Mail className="h-4 w-4" />
            Novidades da Shadia
          </div>

          <h2 className="text-3xl md:text-4xl font-bold">Receba conteúdos da Shadia no seu e-mail</h2>
          <p className="text-lg text-muted-foreground">
            Reflexões sobre maturidade emocional, aviso de novos programas e condições especiais, direto na sua caixa de entrada.
          </p>

          <form
            className="max-w-lg mx-auto space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="text"
                autoComplete="given-name"
                placeholder="Seu nome (opcional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="sm:max-w-[160px]"
              />
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Seu melhor e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
            </div>

            <AutorizacaoEmail id="homeNovidades" marcada={aceita} onChange={setAceita} />

            <Button type="submit" disabled={!pronto || inscrever.isPending} className="w-full sm:w-auto">
              <Mail className="h-4 w-4 mr-2" />
              {inscrever.isPending ? "Enviando..." : "Quero receber"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Você confirma a inscrição por um link que enviamos ao seu e-mail. Sem spam.
          </p>

          <p className="text-sm text-muted-foreground">
            Prefere começar pela prática?{" "}
            <a href="/autoavaliacao" className="font-medium text-primary underline underline-offset-4">
              Descubra como você se comunica quando o assunto é difícil
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
