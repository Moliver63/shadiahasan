import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, CreditCard, Users, Calendar, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Period = "week" | "month" | "quarter" | "year";

function periodStart(period: Period): Date {
  const start = new Date();
  const days = period === "week" ? 7 : period === "month" ? 30 : period === "quarter" ? 90 : 365;
  start.setDate(start.getDate() - days);
  return start;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function statusLabel(status: string, providerStatus?: string | null): string {
  if (status === "completed") return "Pago";
  if (status === "refunded") return "Estornado";
  if (status === "failed") return "Falhou / cancelado";
  if (providerStatus?.toLowerCase().includes("overdue")) return "Atrasado";
  return "Pendente";
}

export default function AdminFinanceiro() {
  const [period, setPeriod] = useState<Period>("month");
  const { data: allPayments, isLoading } = trpc.subscriptions.getAllPaymentHistory.useQuery();
  const { data: allSubscriptions } = trpc.subscriptions.getAll.useQuery();

  const payments = allPayments ?? [];
  const filteredPayments = useMemo(() => {
    const start = periodStart(period);
    return payments.filter((payment) => new Date(payment.paidAt || payment.createdAt) >= start);
  }, [payments, period]);

  const completedPayments = filteredPayments.filter((payment) => payment.status === "completed");
  const totalRevenue = completedPayments.reduce((sum, payment) =>
    sum + Math.max(0, (payment.amount || 0) - (payment.refundedAmount || 0)), 0);
  const averageTicket = completedPayments.length ? totalRevenue / completedPayments.length : 0;
  const activeSubscriptions = allSubscriptions?.filter((subscription) => subscription.status === "active").length ?? 0;
  const pendingPayments = filteredPayments.filter((payment) => payment.status === "pending").length;
  const failedPayments = filteredPayments.filter((payment) => payment.status === "failed" || payment.status === "refunded").length;

  const planSummary = useMemo(() => {
    const summary: Record<string, { count: number; amount: number }> = {};
    for (const payment of completedPayments) {
      const plan = payment.planSlug || "Não informado";
      summary[plan] ??= { count: 0, amount: 0 };
      summary[plan].count += 1;
      summary[plan].amount += Math.max(0, (payment.amount || 0) - (payment.refundedAmount || 0));
    }
    return Object.entries(summary).sort((a, b) => b[1].amount - a[1].amount);
  }, [completedPayments]);

  const handleExport = () => {
    if (!filteredPayments.length) {
      toast.error("Nenhum dado para exportar neste período.");
      return;
    }
    const rows = [
      ["ID", "Usuário", "E-mail", "Provedor", "Valor (BRL)", "Estornado (BRL)", "Líquido (BRL)", "Status", "Status do provedor", "Plano", "Vencimento", "URL", "Data"],
      ...filteredPayments.map((payment) => [
        payment.id,
        payment.user?.name || `Usuário #${payment.userId}`,
        payment.user?.email || "",
        payment.paymentMethod?.split(":")[0] || "—",
        ((payment.amount || 0) / 100).toFixed(2),
        ((payment.refundedAmount || 0) / 100).toFixed(2),
        (Math.max(0, (payment.amount || 0) - (payment.refundedAmount || 0)) / 100).toFixed(2),
        payment.status,
        payment.providerStatus || "",
        payment.planSlug || "",
        payment.dueDate || "",
        payment.paymentUrl || "",
        new Date(payment.paidAt || payment.createdAt).toLocaleString("pt-BR"),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado!");
  };

  const currency = (cents: number) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Relatórios Financeiros</h1>
            <p className="text-muted-foreground">Recebimentos, cobranças, estornos e assinaturas</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Últimos 7 dias</SelectItem>
                <SelectItem value="month">Últimos 30 dias</SelectItem>
                <SelectItem value="quarter">Últimos 90 dias</SelectItem>
                <SelectItem value="year">Últimos 365 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport} className="w-full sm:w-auto"><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Receita líquida</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent>
            {isLoading ? <Skeleton className="h-8 w-32" /> : <div className="text-2xl font-bold">{currency(totalRevenue)}</div>}
            <p className="text-xs text-muted-foreground">{completedPayments.length} pagamentos confirmados no período, já descontados os estornos</p>
          </CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Assinaturas ativas</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{activeSubscriptions}</div>}
            <p className="text-xs text-muted-foreground">estado atual da base de assinaturas</p>
          </CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ticket médio</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{currency(averageTicket)}</div>}
            <p className="text-xs text-muted-foreground">receita líquida por pagamento confirmado</p>
          </CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Cobranças no período</CardTitle><CreditCard className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{filteredPayments.length}</div>}
            <p className="text-xs text-muted-foreground">{pendingPayments} pendentes · {failedPayments} falhas ou estornos</p>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Histórico de cobranças</CardTitle><CardDescription>Eventos registrados pelos provedores de pagamento no período selecionado</CardDescription></CardHeader>
          <CardContent>
            {isLoading ? <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div> : !filteredPayments.length ? (
              <p className="py-8 text-center text-muted-foreground">Nenhuma cobrança registrada neste período.</p>
            ) : <div className="space-y-4">{filteredPayments.slice(0, 100).map((payment) => {
              const net = Math.max(0, (payment.amount || 0) - (payment.refundedAmount || 0));
              const status = statusLabel(payment.status, payment.providerStatus);
              return <div key={payment.id} className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
                  <div className="min-w-0">
                    <p className="font-medium">{payment.user?.name || `Usuário #${payment.userId}`}</p>
                    <p className="break-all text-sm text-muted-foreground">{payment.user?.email || "E-mail indisponível"}</p>
                    <p className="break-words text-sm text-muted-foreground">{payment.description || payment.planSlug || payment.paymentMethod || "Cobrança"} · {payment.paymentMethod?.split(":")[0] || "Provedor não informado"}</p>
                    {payment.providerStatus && <p className="text-xs text-muted-foreground">Evento: {payment.providerStatus}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <p className="font-medium">{currency(net)}{(payment.refundedAmount || 0) > 0 && <span className="ml-1 text-xs text-muted-foreground">(estornado {currency(payment.refundedAmount || 0)})</span>}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="h-3 w-3" />{new Date(payment.paidAt || payment.createdAt).toLocaleString("pt-BR")}</div>
                  {payment.dueDate && <p className="text-xs text-muted-foreground">Vencimento: {payment.dueDate}</p>}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${payment.status === "completed" ? "bg-green-100 text-green-700" : payment.status === "failed" || payment.status === "refunded" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{status}</span>
                    {payment.paymentUrl && <a className="inline-flex items-center gap-1 text-xs text-primary underline" href={payment.paymentUrl} target="_blank" rel="noreferrer">Fatura <ExternalLink className="h-3 w-3" /></a>}
                  </div>
                </div>
              </div>;
            })}</div>}
          </CardContent>
        </Card>

        {!!planSummary.length && <Card><CardHeader><CardTitle>Receita confirmada por produto</CardTitle><CardDescription>Valores reais registrados, sem estimar preços pela quantidade de assinantes</CardDescription></CardHeader><CardContent>
          <div className="space-y-4">{planSummary.map(([plan, summary]) => {
            const pct = totalRevenue > 0 ? Math.round(summary.amount / totalRevenue * 100) : 0;
            return <div key={plan}><div className="mb-2 flex items-center justify-between gap-4"><span className="text-sm font-medium">{plan}</span><span className="text-right text-sm font-medium">{currency(summary.amount)} · {summary.count} pagamentos ({pct}%)</span></div><div className="h-2 rounded-full bg-secondary"><div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div></div>;
          })}</div>
        </CardContent></Card>}
      </div>
    </DashboardLayout>
  );
}
