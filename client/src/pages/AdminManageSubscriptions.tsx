import { useState } from "react";
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
import { Search, Edit, DollarSign, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function AdminManageSubscriptions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Fetch subscriptions
  const { data: subscriptions, isLoading, refetch } = trpc.subscriptionManagement.getAll.useQuery();

  // Fetch payment history for selected user
  const { data: paymentHistory } = trpc.subscriptionManagement.getPaymentHistory.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId && showPaymentHistory }
  );

  // Mutation to update subscription
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

  // Filter subscriptions
  const filteredSubscriptions = subscriptions?.filter((item) => {
    const matchesSearch =
      item.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.subscription.status === statusFilter;
    const matchesPlan = planFilter === "all" || item.subscription.plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const handleEditSubscription = (item: any) => {
    setSelectedSubscription(item);
    setShowEditModal(true);
  };

  const handleViewPaymentHistory = (userId: number) => {
    setSelectedUserId(userId);
    setShowPaymentHistory(true);
  };

  const handleSaveSubscription = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    upsertMutation.mutate({
      userId: selectedSubscription.user.id,
      plan: formData.get("plan") as any,
      status: formData.get("status") as any,
      endDate: formData.get("endDate") as string || null,
      trialEndDate: formData.get("trialEndDate") as string || null,
      autoRenew: formData.get("autoRenew") === "1" ? 1 : 0,
      notes: formData.get("notes") as string || null,
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      paused: "bg-yellow-100 text-yellow-800",
      cancelled: "bg-red-100 text-red-800",
      expired: "bg-gray-100 text-gray-800",
      trial: "bg-blue-100 text-blue-800",
    };
    return <Badge className={colors[status] || ""}>{status}</Badge>;
  };

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      free: "bg-gray-100 text-gray-800",
      basic: "bg-blue-100 text-blue-800",
      premium: "bg-purple-100 text-purple-800",
      vip: "bg-yellow-100 text-yellow-800",
    };
    return <Badge className={colors[plan] || ""}>{plan}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando assinaturas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Gerenciar Assinaturas
          </h1>
          <p className="text-gray-600">
            Visualize e gerencie todas as assinaturas dos usuários
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
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

            {/* Status Filter */}
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
                </SelectContent>
              </Select>
            </div>

            {/* Plan Filter */}
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
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
              {filteredSubscriptions?.map((item) => (
                <TableRow key={item.subscription.id}>
                  <TableCell className="font-medium">
                    {item.user?.name || "N/A"}
                  </TableCell>
                  <TableCell>{item.user?.email || "N/A"}</TableCell>
                  <TableCell>{getPlanBadge(item.subscription.plan)}</TableCell>
                  <TableCell>{getStatusBadge(item.subscription.status)}</TableCell>
                  <TableCell>
                    {new Date(item.subscription.startDate).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {item.subscription.endDate
                      ? new Date(item.subscription.endDate).toLocaleDateString("pt-BR")
                      : "Sem expiração"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditSubscription(item)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewPaymentHistory(item.user!.id)}
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Pagamentos
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredSubscriptions?.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Nenhuma assinatura encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Subscription Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Assinatura</DialogTitle>
            <DialogDescription>
              Modifique os detalhes da assinatura de {selectedSubscription?.user?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSubscription} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Plan */}
              <div>
                <Label htmlFor="plan">Plano</Label>
                <Select name="plan" defaultValue={selectedSubscription?.subscription.plan}>
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

              {/* Status */}
              <div>
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={selectedSubscription?.subscription.status}>
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

              {/* End Date */}
              <div>
                <Label htmlFor="endDate">Data de Expiração</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  defaultValue={
                    selectedSubscription?.subscription.endDate
                      ? new Date(selectedSubscription.subscription.endDate)
                          .toISOString()
                          .split("T")[0]
                      : ""
                  }
                />
              </div>

              {/* Trial End Date */}
              <div>
                <Label htmlFor="trialEndDate">Fim do Trial</Label>
                <Input
                  id="trialEndDate"
                  name="trialEndDate"
                  type="date"
                  defaultValue={
                    selectedSubscription?.subscription.trialEndDate
                      ? new Date(selectedSubscription.subscription.trialEndDate)
                          .toISOString()
                          .split("T")[0]
                      : ""
                  }
                />
              </div>

              {/* Auto Renew */}
              <div>
                <Label htmlFor="autoRenew">Renovação Automática</Label>
                <Select
                  name="autoRenew"
                  defaultValue={selectedSubscription?.subscription.autoRenew?.toString()}
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

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notas (Admin)</Label>
              <textarea
                id="notes"
                name="notes"
                className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                defaultValue={selectedSubscription?.subscription.notes || ""}
                placeholder="Notas internas sobre esta assinatura..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment History Modal */}
      <Dialog open={showPaymentHistory} onOpenChange={setShowPaymentHistory}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Histórico de Pagamentos</DialogTitle>
            <DialogDescription>
              Todos os pagamentos realizados pelo usuário
            </DialogDescription>
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
                    <TableCell>
                      {new Date(payment.createdAt).toLocaleString("pt-BR")}
                    </TableCell>
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
    </div>
  );
}
