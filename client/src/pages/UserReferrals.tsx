import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Gift, TrendingUp, Users, Wallet, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";

export default function UserReferrals() {
  const [cashbackDialogOpen, setCashbackDialogOpen] = useState(false);
  const [cashbackForm, setCashbackForm] = useState({
    pointsAmount: 100,
    paymentMethod: "pix" as "pix" | "bank_transfer" | "credit_account",
    pixKey: "",
    bankDetails: "",
  });

  // Queries
  const { data: referralCode, isLoading: loadingCode } = trpc.referrals.getMyReferralCode.useQuery();
  const { data: stats, isLoading: loadingStats } = trpc.referrals.getMyStats.useQuery();
  const { data: referrals, isLoading: loadingReferrals } = trpc.referrals.listMyReferrals.useQuery();
  const { data: pointsHistory, isLoading: loadingHistory } = trpc.referrals.getPointsHistory.useQuery();

  // Mutations
  const requestCashback = trpc.referrals.requestCashback.useMutation({
    onSuccess: () => {
      toast.success("Solicitação de cashback enviada com sucesso!");
      setCashbackDialogOpen(false);
      setCashbackForm({
        pointsAmount: 100,
        paymentMethod: "pix",
        pixKey: "",
        bankDetails: "",
      });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao solicitar cashback");
    },
  });

  const copyReferralLink = () => {
    if (referralCode) {
      const link = `${window.location.origin}/signup?ref=${referralCode.referralCode}`;
      navigator.clipboard.writeText(link);
      toast.success("Link de indicação copiado!");
    }
  };

  const handleCashbackRequest = () => {
    if (cashbackForm.paymentMethod === "pix" && !cashbackForm.pixKey) {
      toast.error("Chave PIX é obrigatória");
      return;
    }

    if (cashbackForm.paymentMethod === "bank_transfer" && !cashbackForm.bankDetails) {
      toast.error("Dados bancários são obrigatórios");
      return;
    }

    requestCashback.mutate(cashbackForm);
  };

  if (loadingCode || loadingStats) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const referralLink = referralCode ? `${window.location.origin}/signup?ref=${referralCode.referralCode}` : "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/">
            <img src="/logo.png" alt="Logo" className="h-10" />
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Voltar ao Dashboard</Button>
          </Link>
        </div>
      </header>

      <div className="container py-8 space-y-6">
        <Breadcrumbs items={getBreadcrumbs('/dashboard/referrals')} />

        {/* Page Title */}
        <div>
          <h1 className="text-3xl font-bold">Sistema de Indicações</h1>
          <p className="text-muted-foreground mt-2">
            Indique amigos e ganhe pontos, cashback e mensalidades grátis!
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pontos Disponíveis</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pointsBalance || 0}</div>
              <p className="text-xs text-muted-foreground">
                ≈ R$ {stats?.cashValue || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Indicações Confirmadas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalReferrals || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.thisMonthReferrals || 0} este mês
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mensalidades Grátis</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.freeMonthsRemaining || 0}</div>
              <p className="text-xs text-muted-foreground">
                Meses disponíveis
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progresso</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(stats?.thisMonthReferrals || 0) % 2}/2
              </div>
              <p className="text-xs text-muted-foreground">
                Para próxima mensalidade grátis
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Referral Code Card */}
        <Card>
          <CardHeader>
            <CardTitle>Seu Código de Indicação</CardTitle>
            <CardDescription>
              Compartilhe este link com seus amigos e ganhe pontos quando eles se inscreverem!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={referralLink}
                readOnly
                className="font-mono text-sm"
              />
              <Button onClick={copyReferralLink} size="icon">
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-blue-900">Como Funciona:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>2 indicações</strong> = mensalidade grátis</li>
                <li>• <strong>Plano Básico</strong> = 100 pontos</li>
                <li>• <strong>Plano Premium</strong> = 200 pontos</li>
                <li>• <strong>Plano VIP</strong> = 600 pontos</li>
                <li>• <strong>Bônus:</strong> 3ª indicação (+150pts), 4ª (+200pts), 5ª+ (+250pts)</li>
                <li>• <strong>100 pontos</strong> = R$10 de cashback</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Referrals List */}
        <Card>
          <CardHeader>
            <CardTitle>Minhas Indicações</CardTitle>
            <CardDescription>
              Acompanhe o status das suas indicações
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingReferrals ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : referrals && referrals.length > 0 ? (
              <div className="space-y-4">
                {referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {referral.status === "confirmed" && (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                      {referral.status === "pending" && (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      )}
                      {referral.status === "cancelled" && (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">
                          {referral.referredUserName || "Aguardando cadastro"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {referral.referredUserEmail || "Pendente"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {referral.pointsAwarded > 0 ? `+${referral.pointsAwarded} pts` : "-"}
                      </p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {referral.planPurchased || "Pendente"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Você ainda não tem indicações. Compartilhe seu link!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Points History & Cashback */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Points History */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Pontos</CardTitle>
              <CardDescription>Últimas transações</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="text-center py-4 text-muted-foreground">Carregando...</div>
              ) : pointsHistory && pointsHistory.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {pointsHistory.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <p className="text-sm font-medium">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(transaction.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <p
                        className={`font-semibold ${
                          transaction.amount > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {transaction.amount > 0 ? "+" : ""}
                        {transaction.amount} pts
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Nenhuma transação ainda
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cashback Request */}
          <Card>
            <CardHeader>
              <CardTitle>Resgatar Cashback</CardTitle>
              <CardDescription>
                Converta seus pontos em dinheiro (mínimo 100 pontos)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={cashbackDialogOpen} onOpenChange={setCashbackDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="w-full"
                    disabled={(stats?.pointsBalance || 0) < 100}
                  >
                    Solicitar Resgate
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Solicitar Cashback</DialogTitle>
                    <DialogDescription>
                      Preencha os dados para receber seu cashback
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label>Quantidade de Pontos</Label>
                      <Input
                        type="number"
                        min={100}
                        step={100}
                        max={stats?.pointsBalance || 0}
                        value={cashbackForm.pointsAmount}
                        onChange={(e) =>
                          setCashbackForm({
                            ...cashbackForm,
                            pointsAmount: parseInt(e.target.value),
                          })
                        }
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Valor: R$ {Math.floor(cashbackForm.pointsAmount / 10)}
                      </p>
                    </div>

                    <div>
                      <Label>Método de Pagamento</Label>
                      <Select
                        value={cashbackForm.paymentMethod}
                        onValueChange={(value: any) =>
                          setCashbackForm({ ...cashbackForm, paymentMethod: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="bank_transfer">Transferência Bancária</SelectItem>
                          <SelectItem value="credit_account">Crédito na Conta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {cashbackForm.paymentMethod === "pix" && (
                      <div>
                        <Label>Chave PIX</Label>
                        <Input
                          placeholder="Digite sua chave PIX"
                          value={cashbackForm.pixKey}
                          onChange={(e) =>
                            setCashbackForm({ ...cashbackForm, pixKey: e.target.value })
                          }
                        />
                      </div>
                    )}

                    {cashbackForm.paymentMethod === "bank_transfer" && (
                      <div>
                        <Label>Dados Bancários</Label>
                        <Textarea
                          placeholder="Banco, Agência, Conta, CPF"
                          value={cashbackForm.bankDetails}
                          onChange={(e) =>
                            setCashbackForm({ ...cashbackForm, bankDetails: e.target.value })
                          }
                        />
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={handleCashbackRequest}
                      disabled={requestCashback.isPending}
                    >
                      {requestCashback.isPending ? "Processando..." : "Confirmar Solicitação"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Saldo disponível:</strong> {stats?.pointsBalance || 0} pontos (R$ {stats?.cashValue || 0})
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  O cashback será processado em até 5 dias úteis após aprovação.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
