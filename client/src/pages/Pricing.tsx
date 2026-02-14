import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import UserMenu from "@/components/UserMenu";

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const createCheckout = trpc.subscriptions.createCheckoutSession.useMutation();

  const plans = [
    {
      name: "Gratuito",
      slug: "free",
      price: "R$ 0",
      description: "Primeiro passo na sua jornada de expansão consciente",
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
      description: "Aprofunde sua evolução com ferramentas estruturadas",
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
      description: "Transformação integral com acompanhamento contínuo",
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
      description: "Mentoria estratégica personalizada para sua expansão",
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

  const handleSubscribe = async (planSlug: string) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    if (planSlug === "free") {
      window.location.href = "/courses";
      return;
    }

    try {
      toast.loading("Redirecionando para o checkout...");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <a href="/">
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/KQbMXrKxSjIsEkev.png" 
              alt="Shadia Hasan - Psicologia & Desenvolvimento Humano" 
              className="h-36 w-auto"
            />
          </a>
          <nav className="flex items-center gap-6">
            <a href="/courses" className="text-sm font-medium hover:text-purple-600 transition-colors">
              Cursos
            </a>
            <a href="/pricing" className="text-sm font-medium text-purple-600">
              Planos
            </a>
            {isAuthenticated ? (
              <Button asChild variant="default">
                <a href="/my-courses">Meus Cursos</a>
              </Button>
            ) : (
              <Button asChild variant="default">
                <a href={getLoginUrl()}>Entrar</a>
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <h1 className="text-5xl font-bold mb-6">
            Escolha o Plano Ideal para{" "}
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Sua Transformação
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Invista no seu desenvolvimento pessoal e emocional com acesso a cursos imersivos em realidade virtual
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.slug}
                className={`relative flex flex-col ${
                  plan.popular
                    ? "border-purple-500 border-2 shadow-xl scale-105"
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
                    onClick={() => handleSubscribe(plan.slug)}
                    disabled={createCheckout.isPending}
                  >
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

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
            <a href="https://wa.me/5547991426662" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 transition-colors">
              WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
