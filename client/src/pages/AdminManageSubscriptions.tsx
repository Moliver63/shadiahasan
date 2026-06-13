import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Edit, DollarSign, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";

type Plan = "free" | "basic" | "premium" | "vip";
type SubscriptionStatus = "active" | "paused" | "cancelled" | "expired" | "trial";

type SubscriptionRow = {
  user: {
    id: number;
    name: string | null;
    email: string;
  };
  subscription: {
    id: number;
    userId: number;
    plan: Plan;
    status: SubscriptionStatus;
    startDate: string | Date;
    endDate: string | Date | null;
    trialEndDate: string | Date | null;
    autoRenew: number;
    notes: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  } | null;
};

type EditFormState = {
  plan: Plan;
  status: SubscriptionStatus;
  endDate: string;
  trialEndDate: string;
  autoRenew: "0" | "1";
  notes: string;
};

const DEFAULT_EDIT_FORM: EditFormState = {
  plan: "basic",
  status: "active",
  endDate: "",
  trialEndDate: "",
  autoRenew: "0",
  notes: "",
};

function toDateInputValue(value?: string | Date | null) {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

function isSubscriptionEnabled(status?: SubscriptionStatus | null) {
  return status === "active" || status === "trial";
}

export default function AdminManageSubscriptions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionRow | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(DEFAULT_EDIT_FORM);

  const { data: subscriptions, isLoading, refetch } = trpc.subscriptionManagement.getAll.useQuery();

  const { data: paymentHistory } = trpc.subscriptionManagement.getPaymentHistory.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId && showPaymentHistory }
  );

  const upsertMutation = trpc.subscriptionManagement.upsert.useMutation({
    onSuccess: () => {
      toast.success("Assinatura atualizada com sucesso!");
      refetch();
      setShowEditModal(false);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const quickToggleMutation = trpc.subscriptionManagement.upsert.useMutation({
    onSuccess: (_, variables) => {
      const enabled = variables.status === "active" || variables.status === "trial";
      toast.success(enabled ? "Assinatura ativada com sucesso!" : "Assinatura desativada com sucesso!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const filteredSubscriptions = useMemo(() => {
    const rows = (subscriptions || []) as SubscriptionRow[];

    return rows.filter((item) => {
      const matchesSearch =
        item.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());

      const currentStatus = item.subscription?.status ?? "none";
      const currentPlan = item.subscription?.plan ?? "none";

      const matchesStatus = statusFilter === "all" || currentStatus === statusFilter;
      const matchesPlan = planFilter === "all" || currentPlan === planFilter;

      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [subscriptions, searchQuery, statusFilter, planFilter]);

  const openEditModal = (item: SubscriptionRow) => {
    setSelectedSubscription(item);
    setEditForm({
      plan: item.subscription?.plan ?? "basic",
      status: item.subscription?.status ?? "active",
      endDate: toDateInputValue(item.subscription?.endDate),
      trialEndDate: toDateInputValue(item.subscription?.trialEndDate),
      autoRenew: item.subscription?.autoRenew === 1 ? "1" : "0",
      notes: item.subscription?.notes || "",
    });
    setShowEditModal(true);
  };

  const handleViewPaymentHistory = (userId: number) => {
    setSelectedUserId(userId);
    setShowPaymentHistory(true);
  };

  const handleSaveSubscription = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSubscription) return;

    upsertMutation.mutate({
      userId: selectedSubscription.user.id,
      plan: editForm.plan,
      status: editForm.status,
      endDate: editForm.endDate || null,
      trialEndDate: editForm.trialEndDate || null,
      autoRenew: editForm.autoRenew === "1" ? 1 : 0,
      notes: editForm.notes || null,
    });
  };

  const handleToggleSubscription = async (item: SubscriptionRow) => {
    const currentlyEnabled = isSubscriptionEnabled(item.subscription?.status ?? null);
    const planToUse: Plan = item.subscription?.plan && item.subscription.plan !== "free"
      ? item.subscription.plan
      : "basic";

    await quickToggleMutation.mutateAsync({
      userId: item.user.id,
      plan: planToUse,
      status: currentlyEnabled ? "cancelled" : "active",
      endDate: currentlyEnabled ? new Date().toISOString() : null,
      trialEndDate: item.subscription?.trialEndDate ? new Date(item.subscription.trialEndDate).toISOString() : null,
      autoRenew: currentlyEnabled ? 0 : item.subscription?.autoRenew ?? 0,
      notes: currentlyEnabled
        ? "Assinatura desativada manualmente pelo admin"
        : "Assinatura ativada manualmente pelo admin",
    });
  };

  const getStatusBadge = (status?: string | null) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      paused: "bg-yellow-100 text-yellow-800",
      cancelled: "bg-red-100 text-red-800",
      expired: "bg-gray-100 text-gray-800",
      trial: "bg-blue-100 text-blue-800",
      none: "bg-slate-100 text-slate-700",
    };

    const labels: Record<string, string> = {
      active: "Ativa",
      paused: "Pausada",
      cancelled: "Cancelada",
      expired: "Expirada",
      trial: "Trial",
      none: "Sem assinatura",
    };

    const key = status || "none";
    return <Badge className={colors[key] || colors.none}>{labels[key] || key}</Badge>;
  };

  const getPlanBadge = (plan?: string | null) => {
    const colors: Record<string, string> = {
      free: "bg-gray-100 text-gray-800",
      basic: "bg-blue-100 text-blue-800",
      premium: "bg-purple-100 text-purple-800",
      vip: "bg-yellow-100 text-yellow-800",
      none: "bg-slate-100 text-slate-700",
    };

    const labels: Record<string, string> = {
      free: "Free",
      basic: "Basic",
      premium: "Premium",
      vip: "VIP",
      none: "Sem plano",
    };

    const key = plan || "none";
    return <Badge className={colors[key] || colors.none}>{labels[key] || key}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar Assinaturas</h1>
          <p className="text-muted-foreground">
            Ative, desative e edite a assinatura de qualquer usuário da plataforma.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Encontre rapidamente usuários e o estado atual da assinatura.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Nome ou email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                    <SelectItem value="expired">Expirada</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="none">Sem assinatura</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="plan">Plano</Label>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger id="plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                    <SelectItem value="none">Sem plano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assinaturas</CardTitle>
            <CardDescription>
              {isLoading ? "Carregando assinaturas..." : `Total de registros visíveis: ${filteredSubscriptions.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Início</TableHead>
                    <TableHead>Data Fim</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions?.map((item) => {
                    const enabled = isSubscriptionEnabled(item.subscription?.status ?? null);

                    return (
                      <TableRow key={item.user.id}>
                        <TableCell className="font-medium">{item.user?.name || "N/A"}</TableCell>
                        <TableCell>{item.user?.email || "N/A"}</TableCell>
                        <TableCell>{getPlanBadge(item.subscription?.plan)}</TableCell>
                        <TableCell>{getStatusBadge(item.subscription?.status)}</TableCell>
                        <TableCell>
                          {item.subscription?.startDate
                            ? new Date(item.subscription.startDate).toLocaleDateString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {item.subscription?.endDate
                            ? new Date(item.subscription.endDate).toLocaleDateString("pt-BR")
                            : "Sem expiração"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant={enabled ? "destructive" : "default"}
                              disabled={quickToggleMutation.isPending}
                              onClick={() => handleToggleSubscription(item)}
                            >
                              {enabled ? (
                                <>
                                  <PowerOff className="h-4 w-4 mr-1" />
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <Power className="h-4 w-4 mr-1" />
                                  Ativar
                                </>
                              )}
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => openEditModal(item)}>
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>

                            <Button size="sm" variant="outline" onClick={() => handleViewPaymentHistory(item.user.id)}>
                              <DollarSign className="h-4 w-4 mr-1" />
                              Pagamentos
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {!isLoading && filteredSubscriptions?.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Nenhum usuário encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Assinatura</DialogTitle>
            <DialogDescription>
              Modifique os detalhes da assinatura de {selectedSubscription?.user?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSubscription} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan">Plano</Label>
                <Select
                  value={editForm.plan}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, plan: value as Plan }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, status: value as SubscriptionStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                    <SelectItem value="expired">Expirada</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="endDate">Data de Expiração</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="trialEndDate">Fim do Trial</Label>
                <Input
                  id="trialEndDate"
                  type="date"
                  value={editForm.trialEndDate}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, trialEndDate: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="autoRenew">Renovação Automática</Label>
                <Select
                  value={editForm.autoRenew}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, autoRenew: value as "0" | "1" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Sim</SelectItem>
                    <SelectItem value="0">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notas (Admin)</Label>
              <textarea
                id="notes"
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                value={editForm.notes}
                onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas internas sobre esta assinatura..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentHistory} onOpenChange={setShowPaymentHistory}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Histórico de Pagamentos</DialogTitle>
            <DialogDescription>Todos os pagamentos realizados pelo usuário</DialogDescription>
          </DialogHeader>

          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentHistory?.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.createdAt).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: payment.currency,
                      }).format(payment.amount / 100)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>{payment.paymentMethod || "N/A"}</TableCell>
                    <TableCell>{payment.description || "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {paymentHistory?.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Nenhum pagamento encontrado</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
