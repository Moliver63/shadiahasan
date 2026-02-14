import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation } from "wouter";
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
} from "lucide-react";
import { toast } from "sonner";

export default function MySubscription() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Controle de acesso
  if (!user) {
    navigate("/");
    return null;
  }

  const isPremium = user.plan === 'premium';
  const nextBillingDate = "15 de Março de 2026";
  const monthlyPrice = isPremium ? "R$ 97,00" : "R$ 0,00";

  const paymentHistory = [
    { id: 1, date: "15/02/2026", amount: "R$ 97,00", status: "Pago", method: "Cartão •••• 4242" },
    { id: 2, date: "15/01/2026", amount: "R$ 97,00", status: "Pago", method: "Cartão •••• 4242" },
    { id: 3, date: "15/12/2025", amount: "R$ 97,00", status: "Pago", method: "Cartão •••• 4242" },
  ];

  const handleUpgrade = () => {
    navigate("/pricing");
  };

  const handleDowngrade = () => {
    toast.info("O downgrade será aplicado no próximo ciclo de cobrança");
  };

  const handleCancel = () => {
    toast.error("Tem certeza que deseja cancelar sua assinatura?");
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
                      {isPremium && <Crown className="h-5 w-5 text-yellow-500" />}
                      Plano Atual
                    </CardTitle>
                    <CardDescription>
                      {isPremium ? "Você tem acesso completo à plataforma" : "Acesso limitado aos recursos básicos"}
                    </CardDescription>
                  </div>
                  <Badge variant={isPremium ? "default" : "secondary"} className="text-lg px-4 py-2">
                    {isPremium ? "Premium" : "Gratuito"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Valor Mensal</p>
                    <p className="text-2xl font-bold">{monthlyPrice}</p>
                  </div>
                  {isPremium && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Próxima Cobrança</p>
                      <p className="text-lg font-semibold flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {nextBillingDate}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-3">Recursos Inclusos</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Acesso à comunidade</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Certificados de conclusão</span>
                    </div>
                    {isPremium ? (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Todos os cursos e programas</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Mensagens ilimitadas</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Acesso a lives exclusivas</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>Suporte prioritário</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <X className="h-4 w-4" />
                          <span>Cursos premium (bloqueados)</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <X className="h-4 w-4" />
                          <span>Mensagens apenas para admin</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ações de Gerenciamento */}
            <Card>
              <CardHeader>
                <CardTitle>Gerenciar Plano</CardTitle>
                <CardDescription>
                  Faça upgrade, downgrade ou cancele sua assinatura
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isPremium ? (
                  <Button onClick={handleUpgrade} className="w-full" size="lg">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Fazer Upgrade para Premium
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleDowngrade} variant="outline" className="w-full">
                      <TrendingDown className="mr-2 h-4 w-4" />
                      Downgrade para Plano Gratuito
                    </Button>
                    <Button onClick={handleCancel} variant="destructive" className="w-full">
                      <X className="mr-2 h-4 w-4" />
                      Cancelar Assinatura
                    </Button>
                  </>
                )}
                
                {isPremium && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mt-4">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">Importante sobre downgrade e cancelamento:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Downgrade será aplicado no próximo ciclo de cobrança</li>
                        <li>Seu progresso e certificados serão mantidos</li>
                        <li>Conteúdo premium será bloqueado após o downgrade</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Histórico de Pagamentos */}
            {isPremium && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Histórico de Pagamentos
                  </CardTitle>
                  <CardDescription>
                    Suas transações recentes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {paymentHistory.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{payment.amount}</p>
                          <p className="text-sm text-muted-foreground">{payment.date}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm">{payment.method}</p>
                            <Badge variant="outline" className="mt-1">
                              {payment.status}
                            </Badge>
                          </div>
                          <Button variant="ghost" size="sm">
                            Ver Recibo
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    Ver Histórico Completo
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Método de Pagamento */}
            {isPremium && (
              <Card>
                <CardHeader>
                  <CardTitle>Método de Pagamento</CardTitle>
                  <CardDescription>
                    Gerencie seus cartões e formas de pagamento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Visa •••• 4242</p>
                        <p className="text-sm text-muted-foreground">Expira em 12/2027</p>
                      </div>
                    </div>
                    <Button variant="outline">Atualizar</Button>
                  </div>
                  <Button variant="ghost" className="w-full mt-3">
                    + Adicionar Novo Cartão
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
