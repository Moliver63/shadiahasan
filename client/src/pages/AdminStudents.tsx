import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Search, MoreVertical, Mail, Award, Ban, KeyRound, AtSign, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";
import { useState } from "react";

export default function AdminStudents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [editEmailDialog, setEditEmailDialog] = useState<{ open: boolean; userId: number; currentEmail: string }>({
    open: false, userId: 0, currentEmail: "",
  });
  const [editPasswordDialog, setEditPasswordDialog] = useState<{ open: boolean; userId: number; userName: string }>({
    open: false, userId: 0, userName: "",
  });
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: students, isLoading } = trpc.admin.listUsers.useQuery();

  // Carrega cursos do aluno selecionado
  const { data: studentEnrollments } = trpc.enrollments.getByUserId.useQuery(
    { userId: selectedStudentId! },
    { enabled: !!selectedStudentId }
  );

  const updateEmailMutation = trpc.admin.updateUserEmail.useMutation();
  const updatePasswordMutation = trpc.admin.updateUserPassword.useMutation();
  const updatePlanMutation = trpc.admin.updateUserPlan.useMutation();
  const utils = trpc.useUtils();

  const filteredStudents = students?.filter(student =>
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes("@")) { toast.error("Email inválido"); return; }
    try {
      await updateEmailMutation.mutateAsync({ userId: editEmailDialog.userId, email: newEmail });
      toast.success("Email atualizado com sucesso!");
      setEditEmailDialog({ open: false, userId: 0, currentEmail: "" });
      utils.admin.listUsers.invalidate();
    } catch (error) {
      toast.error("Erro ao atualizar email");
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) { toast.error("A senha deve ter no mínimo 8 caracteres"); return; }
    if (newPassword !== confirmPassword) { toast.error("As senhas não coincidem"); return; }
    try {
      await updatePasswordMutation.mutateAsync({ userId: editPasswordDialog.userId, password: newPassword });
      toast.success("Senha atualizada com sucesso!");
      setEditPasswordDialog({ open: false, userId: 0, userName: "" });
      setNewPassword(""); setConfirmPassword("");
    } catch (error) {
      toast.error("Erro ao atualizar senha");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Breadcrumbs items={getBreadcrumbs('/admin/students')} />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Alunos</h1>
            <p className="text-muted-foreground mt-2">Gerencie todos os alunos da plataforma</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lista de alunos */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Alunos</CardTitle>
                <CardDescription>{students?.length || 0} alunos cadastrados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando alunos...</div>
                  ) : filteredStudents && filteredStudents.length > 0 ? (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Plano</TableHead>
                            <TableHead>Cadastro</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStudents.map((student) => (
                            <TableRow
                              key={student.id}
                              className={selectedStudentId === student.id ? "bg-purple-50" : "cursor-pointer hover:bg-gray-50"}
                              onClick={() => setSelectedStudentId(student.id)}
                            >
                              <TableCell className="font-medium">{student.name || "Sem nome"}</TableCell>
                              <TableCell>{student.email || "Sem email"}</TableCell>
                              <TableCell>
                                <Select
                                  value={student.plan || "free"}
                                  onValueChange={async (value: "free" | "premium") => {
                                    try {
                                      await updatePlanMutation.mutateAsync({ userId: student.id, plan: value });
                                      toast.success(`Plano atualizado para ${value === "free" ? "Gratuito" : "Premium"}`);
                                      utils.admin.listUsers.invalidate();
                                    } catch {
                                      toast.error("Erro ao atualizar plano");
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-[120px]" onClick={e => e.stopPropagation()}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="free">Gratuito</SelectItem>
                                    <SelectItem value="basic">Básico</SelectItem>
                                    <SelectItem value="premium">Premium</SelectItem>
                                    <SelectItem value="vip">VIP</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>{new Date(student.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                              <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm"><MoreVertical className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => window.location.href = `mailto:${student.email}`}>
                                      <Mail className="mr-2 h-4 w-4" />Enviar Email
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setSelectedStudentId(student.id)}>
                                      <BookOpen className="mr-2 h-4 w-4" />Ver Cursos
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => { setEditEmailDialog({ open: true, userId: student.id, currentEmail: student.email || "" }); setNewEmail(student.email || ""); }}>
                                      <AtSign className="mr-2 h-4 w-4" />Alterar Email
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setEditPasswordDialog({ open: true, userId: student.id, userName: student.name || "Usuário" })}>
                                      <KeyRound className="mr-2 h-4 w-4" />Alterar Senha
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

          {/* Painel de cursos do aluno selecionado */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {selectedStudentId
                    ? `Cursos de ${students?.find(s => s.id === selectedStudentId)?.name || "Aluno"}`
                    : "Cursos Matriculados"}
                </CardTitle>
                <CardDescription>
                  {selectedStudentId ? "Clique em um aluno para ver seus cursos" : "Selecione um aluno na tabela"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedStudentId ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Clique em uma linha da tabela para ver os cursos do aluno.
                  </p>
                ) : !studentEnrollments ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : studentEnrollments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum curso matriculado.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {studentEnrollments.map((enrollment: any) => (
                      <div key={enrollment.id} className="border rounded-lg p-3">
                        <p className="font-medium text-sm">{enrollment.courseTitle || `Curso #${enrollment.courseId}`}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                            <div
                              className="h-1.5 rounded-full bg-purple-500"
                              style={{ width: `${enrollment.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{enrollment.progress || 0}%</span>
                        </div>
                        {enrollment.completedAt && (
                          <Badge variant="outline" className="mt-2 text-xs text-green-600 border-green-300">
                            Concluído ✓
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialog: Alterar Email */}
      <Dialog open={editEmailDialog.open} onOpenChange={(open) => setEditEmailDialog({ ...editEmailDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Email do Usuário</DialogTitle>
            <DialogDescription>Esta ação é permanente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Novo Email</Label>
              <Input type="email" placeholder="usuario@exemplo.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmailDialog({ open: false, userId: 0, currentEmail: "" })}>Cancelar</Button>
            <Button onClick={handleUpdateEmail} disabled={updateEmailMutation.isPending}>
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
            <DialogDescription>Mínimo 8 caracteres.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Senha</Label>
              <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditPasswordDialog({ open: false, userId: 0, userName: "" }); setNewPassword(""); setConfirmPassword(""); }}>Cancelar</Button>
            <Button onClick={handleUpdatePassword} disabled={updatePasswordMutation.isPending}>
              {updatePasswordMutation.isPending ? "Salvando..." : "Salvar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
