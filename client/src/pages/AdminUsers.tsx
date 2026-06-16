import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  MoreVertical,
  Mail,
  Shield,
  Ban,
  CreditCard,
  Power,
  PowerOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useLocation } from "wouter";

type ConfirmAction =
  | { type: "promote"; userId: number; userName: string | null }
  | { type: "demote"; userId: number; userName: string | null }
  | { type: "unban"; userId: number; userName: string | null }
  | null;

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
    autoRenew: number;
    trialEndDate: string | Date | null;
  } | null;
};

function isSubscriptionEnabled(status?: SubscriptionStatus | null) {
  return status === "active" || status === "trial";
}

export default function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [pendingSuspendUserId, setPendingSuspendUserId] = useState<{ id: number; name: string | null } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [, setLocation] = useLocation();

  const { data: allUsers, isLoading, refetch } = trpc.admin.listUsers.useQuery();
  const {
    data: subscriptionRows,
    isLoading: isLoadingSubscriptions,
    refetch: refetchSubscriptions,
  } = trpc.subscriptionManagement.getAll.useQuery();

  const subscriptionByUserId = useMemo(() => {
    const map = new Map<number, SubscriptionRow["subscription"]>();
    ((subscriptionRows || []) as SubscriptionRow[]).forEach((row) => {
      map.set(row.user.id, row.subscription ?? null);
    });
    return map;
  }, [subscriptionRows]);

  const users = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter((user) => {
      const matchesSearch =
        !searchTerm ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [allUsers, searchTerm, roleFilter]);

  const updateUserRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: (_, vars) => {
      toast.success(
        (vars as any).role === "admin"
          ? "Usuário promovido a admin com sucesso."
          : "Admin rebaixado para usuário com sucesso."
      );
      refetch();
    },
    onError: (err) => toast.error("Erro ao alterar role: " + err.message),
  });

  const moderateUser = trpc.admin.moderateUser.useMutation({
    onSuccess: () => {
      toast.success("Ação aplicada com sucesso.");
      refetch();
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const toggleSubscription = trpc.subscriptionManagement.upsert.useMutation({
    onSuccess: (_, vars) => {
      const enabled = vars.status === "active" || vars.status === "trial";
      toast.success(enabled ? "Assinatura ativada com sucesso." : "Assinatura desativada com sucesso.");
      refetchSubscriptions();
    },
    onError: (err) => toast.error("Erro ao atualizar assinatura: " + err.message),
  });

  const handleConfirm = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.type === "promote") {
        await updateUserRole.mutateAsync({ userId: confirmAction.userId, role: "admin" });
      } else if (confirmAction.type === "demote") {
        await updateUserRole.mutateAsync({ userId: confirmAction.userId, role: "user" });
      } else if (confirmAction.type === "unban") {
        await moderateUser.mutateAsync({
          userId: confirmAction.userId,
          action: "unban",
          reason: "Reativado pelo administrador",
        });
      }
    } finally {
      setConfirmAction(null);
    }
  };

  const handleSuspendConfirm = async () => {
    if (!pendingSuspendUserId) return;
    if (!reasonText.trim()) {
      toast.error("Informe o motivo.");
      return;
    }
    await moderateUser.mutateAsync({
      userId: pendingSuspendUserId.id,
      action: "suspend",
      reason: reasonText,
    });
    setReasonDialogOpen(false);
    setPendingSuspendUserId(null);
    setReasonText("");
  };

  const handleToggleSubscription = async (user: any) => {
    const currentSubscription = subscriptionByUserId.get(user.id);
    const currentlyEnabled = isSubscriptionEnabled(currentSubscription?.status ?? null);
    const planToUse: Plan = currentSubscription?.plan && currentSubscription.plan !== "free"
      ? currentSubscription.plan
      : "basic";

    await toggleSubscription.mutateAsync({
      userId: user.id,
      plan: planToUse,
      status: currentlyEnabled ? "cancelled" : "active",
      endDate: currentlyEnabled ? new Date().toISOString() : null,
      trialEndDate: currentSubscription?.trialEndDate
        ? new Date(currentSubscription.trialEndDate).toISOString()
        : null,
      autoRenew: currentlyEnabled ? 0 : currentSubscription?.autoRenew ?? 0,
      notes: currentlyEnabled
        ? "Assinatura desativada manualmente pelo admin na tela de usuários"
        : "Assinatura ativada manualmente pelo admin na tela de usuários",
    });
  };

  const getRoleBadge = (role: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      superadmin: { label: "Superadmin", variant: "destructive" },
      admin: { label: "Admin", variant: "default" },
      user: { label: "Usuário", variant: "secondary" },
    };
    const { label, variant } = map[role] || { label: role, variant: "secondary" };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getUserStatusBadge = (status: string) =>
    status === "active" ? <Badge className="bg-green-500">Ativo</Badge> : <Badge variant="destructive">Suspenso</Badge>;

  const getSubscriptionBadge = (status?: SubscriptionStatus | null) => {
    const map: Record<string, string> = {
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
    return <Badge className={map[key] || map.none}>{labels[key] || key}</Badge>;
  };

  const getPlanBadge = (plan?: Plan | null) => {
    const map: Record<string, string> = {
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
    return <Badge className={map[key] || map.none}>{labels[key] || key}</Badge>;
  };

  const CONFIRM_CONFIG: Record<string, { title: string; description: string; destructive?: boolean }> = {
    promote: {
      title: "Promover a Admin",
      description: "O usuário ganhará acesso ao painel administrativo e poderá gerenciar conteúdo e alunos.",
    },
    demote: {
      title: "Remover Admin",
      description: "O usuário perderá todos os privilégios de administrador e voltará a ser um usuário comum.",
      destructive: true,
    },
    unban: {
      title: "Reativar Usuário",
      description: "O usuário voltará a ter acesso normal à plataforma.",
    },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">
            Visualize usuários, controle acesso administrativo e gerencie assinaturas sem sair desta tela.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Busque por nome, email ou role.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger><SelectValue placeholder="Filtrar por role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os roles</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Usuários ({users.length})</CardTitle>
              <CardDescription>
                {searchTerm || roleFilter !== "all"
                  ? `Mostrando ${users.length} de ${allUsers?.length || 0} usuários`
                  : "Lista completa de usuários cadastrados"}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setLocation("/admin/manage-subscriptions")}>
              <CreditCard className="mr-2 h-4 w-4" />Abrir assinaturas
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading || isLoadingSubscriptions ? (
              <div className="text-center py-8 text-muted-foreground">Carregando usuários...</div>
            ) : !users || users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || roleFilter !== "all"
                  ? "Nenhum usuário encontrado com esses filtros."
                  : "Nenhum usuário cadastrado ainda."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Assinatura</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => {
                      const subscription = subscriptionByUserId.get(user.id);
                      const subscriptionEnabled = isSubscriptionEnabled(subscription?.status ?? null);

                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              {user.email}
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell>{getUserStatusBadge(user.status || "active")}</TableCell>
                          <TableCell>{getPlanBadge(subscription?.plan)}</TableCell>
                          <TableCell>{getSubscriptionBadge(subscription?.status)}</TableCell>
                          <TableCell>{new Date(user.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setLocation("/admin/manage-subscriptions")}>
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  Abrir gestão de assinaturas
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => handleToggleSubscription(user)}
                                  disabled={toggleSubscription.isPending}
                                >
                                  {subscriptionEnabled ? (
                                    <>
                                      <PowerOff className="mr-2 h-4 w-4" />
                                      Desativar assinatura
                                    </>
                                  ) : (
                                    <>
                                      <Power className="mr-2 h-4 w-4" />
                                      Ativar assinatura
                                    </>
                                  )}
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                {user.role === "user" && (
                                  <DropdownMenuItem
                                    onClick={() => setConfirmAction({ type: "promote", userId: user.id, userName: user.name })}
                                  >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Promover a Admin
                                  </DropdownMenuItem>
                                )}
                                {user.role === "admin" && (
                                  <DropdownMenuItem
                                    onClick={() => setConfirmAction({ type: "demote", userId: user.id, userName: user.name })}
                                    className="text-orange-600"
                                  >
                                    <Shield className="mr-2 h-4 w-4" />
                                    Remover Admin
                                  </DropdownMenuItem>
                                )}
                                {user.role === "superadmin" && (
                                  <DropdownMenuItem disabled className="text-muted-foreground">
                                    <Shield className="mr-2 h-4 w-4" />
                                    Superadmin (protegido)
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                {user.status === "suspended" ? (
                                  <DropdownMenuItem
                                    onClick={() => setConfirmAction({ type: "unban", userId: user.id, userName: user.name })}
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Reativar usuário
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setPendingSuspendUserId({ id: user.id, name: user.name });
                                      setReasonText("");
                                      setReasonDialogOpen(true);
                                    }}
                                    className="text-destructive"
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Suspender usuário
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction ? CONFIRM_CONFIG[confirmAction.type]?.title : ""}: {confirmAction?.userName}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction ? CONFIRM_CONFIG[confirmAction.type]?.description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={confirmAction && CONFIRM_CONFIG[confirmAction.type]?.destructive ? "bg-orange-600 hover:bg-orange-700" : ""}
              disabled={updateUserRole.isPending || moderateUser.isPending}
            >
              {updateUserRole.isPending || moderateUser.isPending ? "Aplicando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender: {pendingSuspendUserId?.name}</DialogTitle>
            <DialogDescription>
              Informe o motivo da suspensão. Ficará registrado no histórico de moderação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo *</Label>
            <Input
              placeholder="Ex: Violação dos termos de uso..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSuspendConfirm()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleSuspendConfirm} disabled={moderateUser.isPending}>
              {moderateUser.isPending ? "Aplicando..." : "Confirmar Suspensão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
