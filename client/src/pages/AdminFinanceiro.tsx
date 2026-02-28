import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, CreditCard, Users, Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminFinanceiro() {
  const [period, setPeriod] = useState("month");

  // Dados reais do backend
  const { data: allPayments, isLoading } = trpc.subscriptions.getAllPaymentHistory.useQuery();
  const { data: allSubscriptions } = trpc.subscriptions.getAll.useQuery();

  // Calcula métricas a partir dos dados reais
  const completedPayments = allPayments?.filter(p => p.status === "completed") ?? [];
  const totalRevenue = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const activeSubscriptions = allSubscriptions?.filter(s => s.status === "active").length ?? 0;
  const averageTicket = activeSubscriptions > 0 ? totalRevenue / activeSubscriptions : 0;

  // Distribuição por plano
  const planCounts: Record<string, number> = {};
  const planRevenue: Record<string, number> = {};
  allSubscriptions?.filter(s => s.status === "active").forEach(s => {
    const plan = s.plan || "free";
    planCounts[plan] = (planCounts[plan] || 0) + 1;
    planRevenue[plan] = (planRevenue[plan] || 0);
  });

  const planPrices: Record<string, number> = { basic: 49.90, premium: 99.90, vip: 299.90 };
  Object.keys(planCounts).forEach(plan => {
    planRevenue[plan] = planCounts[plan] * (planPrices[plan] || 0);
  });

  const totalPlanRevenue = Object.values(planRevenue).reduce((a, b) => a + b, 0);

  const handleExport = () => {
    if (!allPayments || allPayments.length === 0) {
      toast.error("Nenhum dado para exportar.");
      return;
    }
    const csv = [
      "ID,Usuário,Valor,Status,Método,Data",
      ...allPayments.map(p =>
        `${p.id},${p.userId},${(p.amount / 100).toFixed(2)},${p.status},${p.paymentMethod || ""},${new Date(p.createdAt).toLocaleDateString("pt-BR")}`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Relatório exportado!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Relatórios Financeiros</h1>
            <p className="text-muted-foreground">Acompanhe receitas, assinaturas e transações</p>
          </div>
          <div className="flex gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mês</SelectItem>
                <SelectItem value="quarter">Último trimestre</SelectItem>
                <SelectItem value="year">Último ano</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />Exportar CSV
            </Button>
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-32" /> : (
                <div className="text-2xl font-bold">
                  R$ {(totalRevenue / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{completedPayments.length} pagamentos concluídos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold">{activeSubscriptions}</div>
              )}
              <p className="text-xs text-muted-foreground">assinantes pagantes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <div className="text-2xl font-bold">
                  R$ {averageTicket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">por assinatura ativa</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Cobranças</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold">{allPayments?.length ?? 0}</div>
              )}
              <p className="text-xs text-muted-foreground">
                {allPayments?.filter(p => p.status === "failed").length ?? 0} falhas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transações Recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Transações Recentes</CardTitle>
            <CardDescription>Últimas transações processadas</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !allPayments || allPayments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma transação registrada.</p>
            ) : (
              <div className="space-y-4">
                {allPayments.slice(0, 10).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Usuário #{payment.userId}</p>
                        <p className="text-sm text-muted-foreground">{payment.description || payment.paymentMethod || "Stripe"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        R$ {((payment.amount || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(payment.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      payment.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : payment.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {payment.status === "completed" ? "Concluído" : payment.status === "failed" ? "Falhou" : "Pendente"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribuição por Plano */}
        {!isLoading && totalPlanRevenue > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Plano</CardTitle>
              <CardDescription>Assinaturas ativas por plano</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(planCounts)
                  .filter(([plan]) => plan !== "free")
                  .sort(([,a], [,b]) => b - a)
                  .map(([plan, count]) => {
                    const pct = totalPlanRevenue > 0 ? Math.round((planRevenue[plan] / totalPlanRevenue) * 100) : 0;
                    const colors: Record<string, string> = { vip: "bg-purple-600", premium: "bg-blue-600", basic: "bg-green-600" };
                    return (
                      <div key={plan}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium capitalize">Plano {plan}</span>
                          <span className="text-sm font-medium">{count} assinantes ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary">
                          <div className={`h-2 rounded-full ${colors[plan] || "bg-gray-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
