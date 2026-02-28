import { useAuth } from "@/_core/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Crown,
  Calendar,
  CreditCard,
  TrendingUp,
  TrendingDown,
  X,
  Check,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const PLAN_LABELS: Record<string, string> = {
  free: "Gratuito",
  basic: "Básico",
  premium: "Premium",
  vip: "VIP",
};

const PLAN_PRICES: Record<string, string> = {
  free: "R$ 0,00",
  basic: "R$ 49,90",
  premium: "R$ 99,90",
  vip: "R$ 299,90",
};

export default function MySubscription() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const { data: subscription, isLoading: loadingSubscription } =
    trpc.subscriptions.getByUserId.useQuery(
      { userId: user?.id ?? 0 },
      { enabled: !!user?.id }
    );

  const { data: paymentHistory, isLoading: loadingPayments } =
    trpc.subscriptions.getPaymentHistory.useQuery(
      { userId: user?.id ?? 0 },
      { enabled: !!user?.id }
    );

  const getPortalUrl = trpc.subscriptions.getPortalUrl.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
    },
    onError: (err) => {
      toast.error("Erro ao abrir portal de pagamento: " + err.message);
    },
  });

  // Aguarda resolução do estado de autenticação
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    navigate("/");
    return null;
  }

  const plan = subscription?.plan ?? user.plan ?? "free";
  const isPaid = plan !== "free";
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const planPrice = PLAN_PRICES[plan] ?? "—";
  const isActive = subscription?.status === "active";

  const handleUpgrade = () => navigate("/pricing");

  const handleManagePortal = () => {
    if (!subscription?.stripeCustomerId) {
      toast.error(
        "Nenhuma assinatura ativa encontrada. Faça upgrade primeiro."
      );
      return;
    }
    toast.loading("Abrindo portal de pagamento...");
    getPortalUrl.mutate();
  };

  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <img src="/logo.png" alt="Shadia Hasan" className="h-36" />
          </Link>
          <Link href="/profile">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Perfil
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Minha Assinatura</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie seu plano e pagamentos
            </p>
          </div>

          <div className="space-y-6">
            {/* Plano Atual */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {isPaid && (
                        <Crown className="h-5 w-5 text-yellow-500" />
                      )}
                      Plano Atual
                    </CardTitle>
                    <CardDescription>
                      {isPaid
                        ? "Você tem acesso completo à plataforma"
                        : "Acesso limitado aos recursos básicos"}
                    </CardDescription>
                  </div>
                  {loadingSubscription ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isPaid ? "default" : "secondary"}
                        className="text-lg px-4 py-2"
                      >
                        {planLabel}
                      </Badge>
                      {isActive && (
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-300"
                        >
                          Ativo
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingSubscription ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-5 w-48" />
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Valor Mensal
                      </p>
                      <p className="text-2xl font-bold">{planPrice}</p>
                    </div>
                    {isPaid && subscription?.endDate && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Próxima Cobrança
                        </p>
                        <p className="text-lg font-semibold flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formatDate(subscription.endDate)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <Separator />

                <div>
                  <h4 className="font-semibold mb-3">Recursos Inclusos</h4>
                  <div className="space-y-2">
                    {[
                      { label: "Acesso à comunidade", included: true },
                      { label: "Certificados de conclusão", included: true },
                      {
                        label: "Todos os cursos e programas",
                        included: isPaid,
                      },
                      {
                        label: "Experiência VR completa",
                        included:
                          plan === "vip" || plan === "premium",
                      },
                      {
                        label: "Suporte prioritário",
                        included:
                          plan === "premium" || plan === "vip",
                      },
                      {
                        label: "Lives com Shadia",
                        included:
                          plan === "premium" || plan === "vip",
                      },
                      {
                        label: "Sessão individual mensal",
                        included: plan === "vip",
                      },
                    ].map(({ label, included }) => (
                      <div
                        key={label}
                        className={`flex items-center gap-2 text-sm ${
                          !included ? "text-muted-foreground" : ""
                        }`}
                      >
                        {included ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        <span className={!included ? "line-through" : ""}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gerenciar Plano */}
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Plano</CardTitle>
                <CardDescription>
                  Faça upgrade ou gerencie sua assinatura
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isPaid ? (
                  <Button
                    onClick={handleUpgrade}
                    className="w-full"
                    size="lg"
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Fazer Upgrade
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleUpgrade}
                      variant="outline"
                      className="w-full"
                    >
                      <TrendingDown className="mr-2 h-4 w-4" />
                      Mudar de Plano
                    </Button>
                    <Button
                      onClick={handleManagePortal}
                      variant="outline"
                      className="w-full"
                      disabled={getPortalUrl.isPending}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {getPortalUrl.isPending
                        ? "Abrindo..."
                        : "Gerenciar no Stripe (cancelar, trocar cartão)"}
                    </Button>
                  </>
                )}

                {isPaid && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mt-4">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">
                        Para cancelar ou trocar cartão:
                      </p>
                      <p className="mt-1">
                        Use o botão "Gerenciar no Stripe" acima. Seu acesso
                        continua até o fim do período pago.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Histórico de Pagamentos */}
            {isPaid && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Histórico de Pagamentos
                  </CardTitle>
                  <CardDescription>Suas transações recentes</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPayments ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : !paymentHistory || paymentHistory.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6">
                      Nenhum pagamento registrado ainda.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {paymentHistory.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <p className="font-medium">
                              R${" "}
                              {(payment.amount / 100).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(payment.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              {payment.description ||
                                payment.paymentMethod ||
                                "Stripe"}
                            </p>
                            <Badge
                              variant={
                                payment.status === "completed"
                                  ? "default"
                                  : "secondary"
                              }
                              className="mt-1"
                            >
                              {payment.status === "completed"
                                ? "Pago"
                                : payment.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
