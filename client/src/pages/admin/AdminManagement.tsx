import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Copy, CheckCircle2, XCircle, Clock } from "lucide-react";

export default function AdminManagement() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "superadmin">("admin");
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState("");

  const utils = trpc.useUtils();

  // Queries
  const { data: admins, isLoading: adminsLoading } = trpc.adminManagement.listAdmins.useQuery();
  const { data: invites, isLoading: invitesLoading } = trpc.adminManagement.listInvites.useQuery();

  // Mutations
  const inviteAdmin = trpc.adminManagement.inviteAdmin.useMutation({
    onSuccess: (data) => {
      setGeneratedInviteUrl(data.inviteUrl);
      toast.success("Convite criado com sucesso!");
      utils.adminManagement.listInvites.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar convite");
    },
  });

  const cancelInvite = trpc.adminManagement.cancelInvite.useMutation({
    onSuccess: () => {
      toast.success("Convite cancelado");
      utils.adminManagement.listInvites.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao cancelar convite");
    },
  });

  const handleInvite = () => {
    if (!inviteEmail) {
      toast.error("Digite um email");
      return;
    }
    inviteAdmin.mutate({ email: inviteEmail, role: inviteRole });
  };

  const handleCopyInviteUrl = () => {
    navigator.clipboard.writeText(generatedInviteUrl);
    toast.success("Link copiado!");
  };

  const handleCloseInviteDialog = () => {
    setInviteDialogOpen(false);
    setInviteEmail("");
    setInviteRole("admin");
    setGeneratedInviteUrl("");
  };

  const getRoleBadge = (role: string) => {
    if (role === "superadmin") {
      return <Badge className="bg-purple-600">Super Admin</Badge>;
    }
    return <Badge className="bg-blue-600">Admin</Badge>;
  };

  const getInviteStatusBadge = (invite: any) => {
    if (invite.acceptedAt) {
      return (
        <Badge className="bg-green-600 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Aceito
        </Badge>
      );
    }
    const isExpired = new Date(invite.expiresAt) < new Date();
    if (isExpired) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Expirado
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Pendente
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Administradores</h1>
          <p className="text-muted-foreground mt-2">
            Convide e gerencie administradores da plataforma
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Convidar Administrador
        </Button>
      </div>

      {/* Admins List */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Administradores Ativos</h2>
        {adminsLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : !admins || admins.length === 0 ? (
          <p className="text-muted-foreground">Nenhum administrador encontrado</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Último acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>{getRoleBadge(admin.role)}</TableCell>
                  <TableCell>
                    {new Date(admin.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {new Date(admin.lastSignedIn).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Invites List */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">Convites</h2>
        {invitesLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : !invites || invites.length === 0 ? (
          <p className="text-muted-foreground">Nenhum convite pendente</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Convidado por</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>{getRoleBadge(invite.role)}</TableCell>
                  <TableCell>{getInviteStatusBadge(invite)}</TableCell>
                  <TableCell>
                    {invite.invitedByName} ({invite.invitedByEmail})
                  </TableCell>
                  <TableCell>
                    {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {!invite.acceptedAt && new Date(invite.expiresAt) > new Date() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelInvite.mutate({ inviteId: invite.id })}
                      >
                        Cancelar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={handleCloseInviteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Convidar Novo Administrador</DialogTitle>
            <DialogDescription>
              {generatedInviteUrl
                ? "Convite criado! Copie o link abaixo e envie para o novo administrador."
                : "Digite o email do novo administrador e escolha a função."}
            </DialogDescription>
          </DialogHeader>

          {generatedInviteUrl ? (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-mono break-all">{generatedInviteUrl}</p>
              </div>
              <Button onClick={handleCopyInviteUrl} className="w-full gap-2">
                <Copy className="w-4 h-4" />
                Copiar Link
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Função</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            {generatedInviteUrl ? (
              <Button onClick={handleCloseInviteDialog}>Fechar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCloseInviteDialog}>
                  Cancelar
                </Button>
                <Button onClick={handleInvite} disabled={inviteAdmin.isPending}>
                  {inviteAdmin.isPending ? "Criando..." : "Criar Convite"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
