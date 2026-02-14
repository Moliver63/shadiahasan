import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { Search, MoreVertical, Mail, Award, Ban, KeyRound, AtSign } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function AdminStudents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [editEmailDialog, setEditEmailDialog] = useState<{ open: boolean; userId: number; currentEmail: string }>({
    open: false,
    userId: 0,
    currentEmail: "",
  });
  const [editPasswordDialog, setEditPasswordDialog] = useState<{ open: boolean; userId: number; userName: string }>({
    open: false,
    userId: 0,
    userName: "",
  });
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: students, isLoading } = trpc.admin.listUsers.useQuery();
  const updateEmailMutation = trpc.admin.updateUserEmail.useMutation();
  const updatePasswordMutation = trpc.admin.updateUserPassword.useMutation();
  const utils = trpc.useUtils();

  const filteredStudents = students?.filter(student =>
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendEmail = (email: string | null) => {
    if (email) {
      window.location.href = `mailto:${email}`;
    }
  };

  const handleViewProgress = (userId: number) => {
    toast.info("Funcionalidade em desenvolvimento");
  };

  const handleBlockUser = (userId: number) => {
    toast.info("Funcionalidade em desenvolvimento");
  };

  const handleOpenEditEmail = (userId: number, currentEmail: string) => {
    setEditEmailDialog({ open: true, userId, currentEmail });
    setNewEmail(currentEmail);
  };

  const handleOpenEditPassword = (userId: number, userName: string) => {
    setEditPasswordDialog({ open: true, userId, userName });
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      toast.error("Email inválido");
      return;
    }

    try {
      await updateEmailMutation.mutateAsync({
        userId: editEmailDialog.userId,
        email: newEmail,
      });
      
      toast.success("Email atualizado com sucesso!");
      setEditEmailDialog({ open: false, userId: 0, currentEmail: "" });
      utils.admin.listUsers.invalidate();
    } catch (error) {
      toast.error("Erro ao atualizar email");
      console.error(error);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    try {
      await updatePasswordMutation.mutateAsync({
        userId: editPasswordDialog.userId,
        password: newPassword,
      });
      
      toast.success("Senha atualizada com sucesso!");
      setEditPasswordDialog({ open: false, userId: 0, userName: "" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error("Erro ao atualizar senha");
      console.error(error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Alunos</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie todos os alunos da plataforma
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Alunos</CardTitle>
            <CardDescription>
              {students?.length || 0} alunos cadastrados na plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Tabela */}
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando alunos...
                </div>
              ) : filteredStudents && filteredStudents.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Método de Login</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">
                            {student.name || "Sem nome"}
                          </TableCell>
                          <TableCell>{student.email || "Sem email"}</TableCell>
                          <TableCell>
                            <Badge variant={student.role === "admin" ? "default" : "secondary"}>
                              {student.role === "admin" ? "Admin" : "Aluno"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {student.loginMethod || "OAuth"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(student.createdAt).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleSendEmail(student.email)}>
                                  <Mail className="mr-2 h-4 w-4" />
                                  Enviar Email
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewProgress(student.id)}>
                                  <Award className="mr-2 h-4 w-4" />
                                  Ver Progresso
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleOpenEditEmail(student.id, student.email || "")}>
                                  <AtSign className="mr-2 h-4 w-4" />
                                  Alterar Email
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenEditPassword(student.id, student.name || "Usuário")}>
                                  <KeyRound className="mr-2 h-4 w-4" />
                                  Alterar Senha
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleBlockUser(student.id)}
                                  className="text-destructive"
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Bloquear Usuário
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Alterar Email */}
      <Dialog open={editEmailDialog.open} onOpenChange={(open) => setEditEmailDialog({ ...editEmailDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Email do Usuário</DialogTitle>
            <DialogDescription>
              Atualize o endereço de email do usuário. Esta ação é permanente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Novo Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditEmailDialog({ open: false, userId: 0, currentEmail: "" })}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateEmail}
              disabled={updateEmailMutation.isPending}
            >
              {updateEmailMutation.isPending ? "Salvando..." : "Salvar Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Alterar Senha */}
      <Dialog open={editPasswordDialog.open} onOpenChange={(open) => setEditPasswordDialog({ ...editPasswordDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha de {editPasswordDialog.userName}</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para este usuário. A senha deve ter no mínimo 8 caracteres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditPasswordDialog({ open: false, userId: 0, userName: "" });
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdatePassword}
              disabled={updatePasswordMutation.isPending}
            >
              {updatePasswordMutation.isPending ? "Salvando..." : "Salvar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
