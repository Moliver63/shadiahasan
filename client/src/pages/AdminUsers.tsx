import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, MoreVertical, Mail, Shield, Ban } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type ConfirmAction =
  | { type: "promote"; userId: number; userName: string }
  | { type: "demote"; userId: number; userName: string }
  | { type: "unban"; userId: number; userName: string }
  | null;

export default function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [pendingSuspendUserId, setPendingSuspendUserId] = useState<{ id: number; name: string } | null>(null);
  const [reasonText, setReasonText] = useState("");

  const { data: users, isLoading, refetch } = trpc.admin.listUsers.useQuery({
    search: searchTerm || undefined,
    role: roleFilter !== "all" ? roleFilter : undefined,
    limit: 50,
  });

  // ← Usa adminProcedure simples — qualquer admin pode usar
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

  // Suspender — requer reason obrigatório
  const moderateUser = trpc.admin.moderateUser.useMutation({
    onSuccess: () => {
      toast.success("Ação aplicada com sucesso.");
      refetch();
    },
    onError: (err) => toast.error("Erro: " + err.message),
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
    if (!reasonText.trim()) { toast.error("Informe o motivo."); return; }
    await moderateUser.mutateAsync({
      userId: pendingSuspendUserId.id,
      action: "suspend",
      reason: reasonText,
    });
    setReasonDialogOpen(false);
    setPendingSuspendUserId(null);
    setReasonText("");
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

  const getStatusBadge = (status: string) =>
    status === "active"
      ? <Badge className="bg-green-500">Ativo</Badge>
      : <Badge variant="destructive">Suspenso</Badge>;

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
          <p className="text-muted-foreground">Visualize, edite e gerencie todos os usuários da plataforma</p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
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

        {/* Tabela */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Usuários ({users?.length || 0})</CardTitle>
              <CardDescription>Lista completa de usuários cadastrados</CardDescription>
            </div>
            <Button variant="outline">
              <UserPlus className="mr-2 h-4 w-4" />Convidar Usuário
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando usuários...</div>
            ) : !users || users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getStatusBadge(user.status || "active")}</TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* Promover / Rebaixar — bloqueado para superadmins */}
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

                            {/* Suspender / Reativar */}
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
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AlertDialog: Promover / Rebaixar / Reativar */}
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
              className={confirmAction && CONFIRM_CONFIG[confirmAction.type]?.destructive
                ? "bg-orange-600 hover:bg-orange-700"
                : ""}
              disabled={updateUserRole.isPending || moderateUser.isPending}
            >
              {updateUserRole.isPending || moderateUser.isPending ? "Aplicando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Suspender (requer motivo) */}
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
            <Button
              variant="destructive"
              onClick={handleSuspendConfirm}
              disabled={moderateUser.isPending}
            >
              {moderateUser.isPending ? "Aplicando..." : "Confirmar Suspensão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
