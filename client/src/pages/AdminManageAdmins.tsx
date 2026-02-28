import { useState } from "react";
import { trpc } from "../lib/trpc";
import DashboardLayout from "../components/DashboardLayout";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { Shield, ShieldCheck, UserMinus, History } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { getBreadcrumbs } from "../lib/breadcrumbs";

export default function AdminManageAdmins() {
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"promote" | "demote" | "promote_super" | null>(null);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  const { data: admins, isLoading, refetch } = trpc.admin.listAdmins.useQuery();
  const { data: auditLogs } = trpc.admin.getAuditLogs.useQuery({ limit: 50 });
  
  const promoteToAdmin = trpc.admin.promoteToAdmin.useMutation({
    onSuccess: () => {
      toast.success("Usuário promovido a administrador com sucesso!");
      refetch();
      setSelectedUser(null);
      setActionType(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao promover usuário");
    },
  });

  const demoteFromAdmin = trpc.admin.demoteFromAdmin.useMutation({
    onSuccess: () => {
      toast.success("Administrador rebaixado com sucesso!");
      refetch();
      setSelectedUser(null);
      setActionType(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao rebaixar administrador");
    },
  });

  const promoteToSuperAdmin = trpc.admin.promoteToSuperAdmin.useMutation({
    onSuccess: () => {
      toast.success("Administrador promovido a superadministrador!");
      refetch();
      setSelectedUser(null);
      setActionType(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao promover a superadministrador");
    },
  });

  const handleAction = () => {
    if (!selectedUser) return;

    if (actionType === "promote") {
      promoteToAdmin.mutate({ userId: selectedUser });
    } else if (actionType === "demote") {
      demoteFromAdmin.mutate({ userId: selectedUser });
    } else if (actionType === "promote_super") {
      promoteToSuperAdmin.mutate({ userId: selectedUser });
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === "superadmin") {
      return <Badge className="bg-purple-600"><ShieldCheck className="w-3 h-3 mr-1" />Superadmin</Badge>;
    } else if (role === "admin") {
      return <Badge className="bg-blue-600"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
    }
    return <Badge variant="secondary">Usuário</Badge>;
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      PROMOTE_ADMIN: "bg-green-600",
      DEMOTE_ADMIN: "bg-orange-600",
      PROMOTE_SUPERADMIN: "bg-purple-600",
      DEMOTE_SUPERADMIN: "bg-red-600",
    };
    return <Badge className={colors[action] || "bg-gray-600"}>{action.replace(/_/g, " ")}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <Breadcrumbs items={getBreadcrumbs("/admin/manage-admins")} />
        
        <div className="flex justify-between items-center mb-6 mt-4">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Administradores</h1>
            <p className="text-muted-foreground mt-2">
              Promova ou rebaixe usuários para administradores e superadministradores
            </p>
          </div>
          <Button onClick={() => setShowAuditLogs(true)} variant="outline">
            <History className="w-4 h-4 mr-2" />
            Ver Logs de Auditoria
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Administradores e Superadministradores</CardTitle>
            <CardDescription>
              Lista de todos os usuários com permissões administrativas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : admins && admins.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Último acesso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.name || "Sem nome"}</TableCell>
                      <TableCell>{admin.email}</TableCell>
                      <TableCell>{getRoleBadge(admin.role)}</TableCell>
                      <TableCell>{new Date(admin.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{new Date(admin.lastSignedIn).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {admin.role === "admin" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(admin.id);
                                setActionType("promote_super");
                              }}
                            >
                              <ShieldCheck className="w-4 h-4 mr-1" />
                              Promover a Superadmin
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedUser(admin.id);
                                setActionType("demote");
                              }}
                            >
                              <UserMinus className="w-4 h-4 mr-1" />
                              Rebaixar
                            </Button>
                          </>
                        )}
                        {admin.role === "superadmin" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedUser(admin.id);
                              setActionType("demote");
                            }}
                          >
                            <UserMinus className="w-4 h-4 mr-1" />
                            Rebaixar a Admin
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum administrador encontrado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog open={selectedUser !== null && actionType !== null} onOpenChange={() => {
          setSelectedUser(null);
          setActionType(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "promote" && "Promover a Administrador"}
                {actionType === "demote" && "Rebaixar Administrador"}
                {actionType === "promote_super" && "Promover a Superadministrador"}
              </DialogTitle>
              <DialogDescription>
                {actionType === "promote" && "Tem certeza que deseja promover este usuário a administrador?"}
                {actionType === "demote" && "Tem certeza que deseja rebaixar este administrador? Ele perderá todas as permissões administrativas."}
                {actionType === "promote_super" && "Tem certeza que deseja promover este administrador a superadministrador? Ele terá acesso total ao sistema."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setSelectedUser(null);
                setActionType(null);
              }}>
                Cancelar
              </Button>
              <Button
                onClick={handleAction}
                variant={actionType === "demote" ? "destructive" : "default"}
                disabled={promoteToAdmin.isPending || demoteFromAdmin.isPending || promoteToSuperAdmin.isPending}
              >
                {(promoteToAdmin.isPending || demoteFromAdmin.isPending || promoteToSuperAdmin.isPending) ? "Processando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Audit Logs Dialog */}
        <Dialog open={showAuditLogs} onOpenChange={setShowAuditLogs}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Logs de Auditoria</DialogTitle>
              <DialogDescription>
                Histórico de todas as ações de promoção e rebaixamento de administradores
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              {auditLogs && auditLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Executado por</TableHead>
                      <TableHead>Usuário alvo</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.performedByName || "Desconhecido"}</div>
                            <div className="text-sm text-muted-foreground">{log.performedByEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.targetName || "Desconhecido"}</div>
                            <div className="text-sm text-muted-foreground">{log.targetEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.ip || "N/A"}</TableCell>
                        <TableCell>{new Date(log.createdAt).toLocaleString("pt-BR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum log de auditoria encontrado
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
