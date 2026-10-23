import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Sparkles, CreditCard, QrCode } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidCpfCnpj, onlyDigits } from "@shared/br-document";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PublicHeader from "@/components/PublicHeader";
import { trackCheckoutStart } from "@/components/Analytics";

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const createCheckout = trpc.subscriptions.createCheckout.useMutation();
  const createAsaasCheckout = trpc.subscriptions.createAsaasCheckout.useMutation();
  const { data: providers } = trpc.subscriptions.paymentProviders.useQuery();
  const { data: trialInfo } = trpc.trial.info.useQuery();

  // Escolha do método de pagamento (só aparece quando o Asaas está configurado)
  type PaidSlug = "basic" | "premium" | "vip";
  const [chosenPlan, setChosenPlan] = useState<PaidSlug | null>(null);
  const [method, setMethod] = useState<"stripe" | "asaas">("asaas");
  const [cpfCnpj, setCpfCnpj] = useState("");

  const formatCpfCnpj = (value: string) => {
    const d = onlyDigits(value).slice(0, 14);
    if (d.length <= 11) {
      return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
  };

  const plans = [
    {
      name: "Gratuito",
      slug: "free",
      price: "R$ 0",
      description: "Comece sua jornada com apoio inicial",
      features: [
        { text: "1 curso gratuito completo", included: true },
        { text: "Acesso a conteúdos básicos", included: true },
        { text: "Certificado de conclusão", included: true },
        { text: "Acesso à comunidade", included: true },
        { text: "Experiência VR", included: false },
        { text: "Suporte prioritário", included: false },
        { text: "Lives exclusivas", included: false },
      ],
      cta: "Começar Grátis",
      popular: false,
    },
    {
      name: "Básico",
      slug: "basic",
      price: "R$ 49,90",
      period: "/mês",
      description: "Mais recursos para sua transformação pessoal",
      features: [
        { text: "Até 3 cursos simultâneos", included: true },
        { text: "Todos os conteúdos da plataforma", included: true },
        { text: "Certificados de conclusão", included: true },
        { text: "Experiência VR completa", included: true },
        { text: "Material complementar em PDF", included: true },
        { text: "Suporte prioritário", included: false },
        { text: "Lives exclusivas", included: false },
      ],
      cta: "Assinar Básico",
      popular: false,
    },
    {
      name: "Premium",
      slug: "premium",
      price: "R$ 99,90",
      period: "/mês",
      description: "Apoio completo para sua evolução consciente",
      features: [
        { text: "Acesso ilimitado a todos os cursos", included: true },
        { text: "Todos os conteúdos da plataforma", included: true },
        { text: "Certificados de conclusão", included: true },
        { text: "Experiência VR completa", included: true },
        { text: "Material complementar completo", included: true },
        { text: "Suporte prioritário via WhatsApp", included: true },
        { text: "Lives mensais com Shadia", included: true },
      ],
      cta: "Assinar Premium",
      popular: true,
    },
    {
      name: "VIP",
      slug: "vip",
      price: "R$ 299,90",
      period: "/mês",
      description: "Atenção individual dedicada para você",
      features: [
        { text: "Tudo do plano Premium", included: true },
        { text: "Sessão individual mensal com Shadia", included: true },
        { text: "Grupo VIP exclusivo no WhatsApp", included: true },
        { text: "Acesso antecipado a novos cursos", included: true },
        { text: "Conteúdos exclusivos VIP", included: true },
        { text: "Plano de desenvolvimento personalizado", included: true },
        { text: "Certificado especial VIP", included: true },
      ],
      cta: "Assinar VIP",
      popular: false,
    },
  ];

  const handleSubscribe = async (planSlug: "basic" | "premium" | "vip" | "free") => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    if (planSlug === "free") {
      window.location.href = "/courses";
      return;
    }

    // Com Asaas disponível, o aluno escolhe como pagar
    if (providers?.asaas) {
      setMethod(providers.stripe ? "stripe" : "asaas");
      setChosenPlan(planSlug);
      return;
    }

    await startStripeCheckout(planSlug);
  };

  const startStripeCheckout = async (planSlug: PaidSlug) => {
    try {
      toast.loading("Redirecionando para o checkout...");
      trackCheckoutStart(planSlug, 0);
      const result = await createCheckout.mutateAsync({ planSlug });
      
      if (result.url) {
        window.open(result.url, "_blank");
        toast.success("Abrindo página de pagamento...");
      }
    } catch (error) {
      toast.error("Erro ao criar checkout. Tente novamente.");
      console.error(error);
    }
  };

  const confirmPayment = async () => {
    if (!chosenPlan) return;
    if (method === "stripe") {
      const plan = chosenPlan;
      setChosenPlan(null);
      await startStripeCheckout(plan);
      return;
    }
    if (!isValidCpfCnpj(cpfCnpj)) {
      toast.error("CPF ou CNPJ inválido. Confira os números.");
      return;
    }
    try {
      trackCheckoutStart(chosenPlan, 0);
      const result = await createAsaasCheckout.mutateAsync({ planSlug: chosenPlan, cpfCnpj: onlyDigits(cpfCnpj) });
      setChosenPlan(null);
      window.open(result.url, "_blank");
      toast.success("Abrindo página de pagamento...");
    } catch (error: any) {
      toast.error(error?.message || "Erro ao criar pagamento. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <PublicHeader
        items={[
          { label: "Programas", href: "/courses" },
          { label: "Planos", href: "/pricing" },
          { label: "Sobre", href: "/about" },
          { label: "Contato", href: "/contact" },
          { label: "Comunidade", href: "/community/explore", match: "prefix" },
        ]}
      />

      {/* Hero Section */}
      <section className="px-4 py-16 md:py-20">
        <div className="container mx-auto text-center max-w-3xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Escolha o Plano Ideal para{" "}
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Sua Transformação
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8">
            Apoio individual para sua evolução. Escolha o plano que melhor atende suas necessidades.
          </p>
        </div>
      </section>

      {/* Teste de 1 aula (Asaas) */}
      {providers?.asaas && trialInfo && (
        <section className="px-4 pb-10">
          <div className="container mx-auto max-w-3xl">
            <div className="flex flex-col gap-4 rounded-xl border border-purple-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-lg">Quer sentir antes de assinar?</p>
                <p className="text-sm text-muted-foreground">
                  Assista a 1 aula completa por {(trialInfo.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}, pagamento único.
                  Se gostar, é só assinar um plano mensal.
                </p>
              </div>
              <Link href="/courses">
                <Button variant="outline" className="shrink-0">Escolher minha aula</Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Pricing Cards */}
      <section className="pb-20 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.slug}
                className={`relative flex flex-col ${
                  plan.popular
                    ? "border-purple-500 border-2 shadow-xl lg:scale-105"
                    : "border-gray-200"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <Sparkles className="h-4 w-4" />
                    Mais Popular
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-sm">{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-gray-500">{plan.period}</span>}
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        {feature.included ? (
                          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={feature.included ? "text-gray-700" : "text-gray-400 line-through"}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan.slug as "basic" | "premium" | "vip" | "free")}
                    disabled={createCheckout.isPending}
                  >
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <Dialog open={chosenPlan !== null} onOpenChange={(open) => { if (!open) setChosenPlan(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Como você prefere pagar?</DialogTitle>
                <DialogDescription>
                  A assinatura é mensal e o acesso é liberado assim que o pagamento é confirmado.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {providers?.stripe && (
                  <button
                    type="button"
                    onClick={() => setMethod("stripe")}
                    className={`w-full flex items-start gap-3 rounded-lg border p-4 text-left transition ${method === "stripe" ? "border-purple-600 bg-purple-50" : "hover:bg-muted/50"}`}
                  >
                    <CreditCard className="h-5 w-5 mt-0.5 shrink-0 text-purple-600" />
                    <span>
                      <span className="block font-medium">Cartão de crédito</span>
                      <span className="block text-sm text-muted-foreground">Renovação automática todo mês</span>
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMethod("asaas")}
                  className={`w-full flex items-start gap-3 rounded-lg border p-4 text-left transition ${method === "asaas" ? "border-purple-600 bg-purple-50" : "hover:bg-muted/50"}`}
                >
                  <QrCode className="h-5 w-5 mt-0.5 shrink-0 text-purple-600" />
                  <span>
                    <span className="block font-medium">PIX, boleto ou cartão</span>
                    <span className="block text-sm text-muted-foreground">Você escolhe na próxima tela</span>
                  </span>
                </button>

                {method === "asaas" && (
                  <div className="space-y-2 pt-1">
                    <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
                    <Input
                      id="cpfCnpj"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="000.000.000-00"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">Exigido para emitir PIX e boleto.</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setChosenPlan(null)}>Cancelar</Button>
                <Button onClick={confirmPayment} disabled={createAsaasCheckout.isPending || createCheckout.isPending}>
                  {createAsaasCheckout.isPending ? "Gerando pagamento..." : "Continuar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* FAQ Section */}
          <div className="mt-20 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10">Perguntas Frequentes</h2>
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-lg mb-2">Posso cancelar a qualquer momento?</h3>
                <p className="text-gray-600">
                  Sim! Você pode cancelar sua assinatura a qualquer momento sem taxas ou multas. Seu acesso continuará até o final do período pago.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-lg mb-2">Como funciona a experiência VR?</h3>
                <p className="text-gray-600">
                  Você pode acessar os cursos em modo VR usando óculos Meta Quest. A experiência imersiva potencializa o aprendizado e torna as aulas mais envolventes.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="font-semibold text-lg mb-2">Posso mudar de plano depois?</h3>
                <p className="text-gray-600">
                  Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento através da sua área de assinatura.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-12">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; 2026 Shadia Hasan. Todos os direitos reservados.</p>
          <div className="mt-4 flex justify-center gap-6">
            <a href="https://instagram.com/shadia_hasan" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 transition-colors">
              Instagram
            </a>
            <a href="https://wa.me/5547991665536" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 transition-colors">
              WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
