import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings, Globe, Bell, Shield, Palette, Mail, KeyRound } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminSettings() {
  const { user } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateEmailMutation = trpc.auth.updateOwnEmail.useMutation();
  const updatePasswordMutation = trpc.auth.updateOwnPassword.useMutation();

  const handleSave = () => {
    toast.success("Configurações salvas com sucesso!");
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      toast.error("Email inválido");
      return;
    }

    if (!emailPassword) {
      toast.error("Digite sua senha atual para confirmar");
      return;
    }

    try {
      await updateEmailMutation.mutateAsync({
        newEmail,
        currentPassword: emailPassword,
      });
      
      toast.success("Email atualizado com sucesso! Faça login novamente.");
      setNewEmail("");
      setEmailPassword("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar email");
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      toast.error("Digite sua senha atual");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("A nova senha deve ter no mínimo 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    try {
      await updatePasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
      });
      
      toast.success("Senha atualizada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar senha");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie as configurações gerais da plataforma
          </p>
        </div>

        <div className="grid gap-6">
          {/* Configurações Gerais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações Gerais
              </CardTitle>
              <CardDescription>
                Informações básicas da plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="site-name">Nome do Site</Label>
                <Input
                  id="site-name"
                  defaultValue="Shadia Hasan - Psicologia & Desenvolvimento Humano"
                  placeholder="Nome da plataforma"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-description">Descrição</Label>
                <Textarea
                  id="site-description"
                  defaultValue="Plataforma de desenvolvimento pessoal e transformação interior com experiências em realidade virtual."
                  placeholder="Descrição da plataforma"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email de Contato</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="contato@shadiahasan.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Configurações de Domínio */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Domínio e URL
              </CardTitle>
              <CardDescription>
                Configure o domínio personalizado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domínio Atual</Label>
                <Input
                  id="domain"
                  defaultValue="shadiahasan.club"
                  disabled
                />
                <p className="text-sm text-muted-foreground">
                  Para alterar o domínio, acesse Settings → Domains no Management UI
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notificações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificações
              </CardTitle>
              <CardDescription>
                Configure as notificações da plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificar novos alunos</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba email quando um novo aluno se matricular
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificar novos pagamentos</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba email sobre novos pagamentos e assinaturas
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificar reviews</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba email quando alunos deixarem avaliações
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Segurança
              </CardTitle>
              <CardDescription>
                Configurações de segurança e privacidade
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Requer aprovação para novos alunos</Label>
                  <p className="text-sm text-muted-foreground">
                    Alunos precisam de aprovação antes de acessar cursos
                  </p>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Permitir cadastro público</Label>
                  <p className="text-sm text-muted-foreground">
                    Qualquer pessoa pode se cadastrar na plataforma
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              {/* Divider */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Alterar Credenciais de Acesso</h3>
                
                {/* Alterar Email */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Alterar Email</Label>
                  </div>
                  <div className="space-y-3 pl-6">
                    <div className="space-y-2">
                      <Label htmlFor="current-email" className="text-sm">Email Atual</Label>
                      <Input
                        id="current-email"
                        type="email"
                        value={user?.email || ""}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-email" className="text-sm">Novo Email</Label>
                      <Input
                        id="new-email"
                        type="email"
                        placeholder="novo@exemplo.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-password" className="text-sm">Senha Atual (para confirmar)</Label>
                      <Input
                        id="email-password"
                        type="password"
                        placeholder="••••••••"
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleUpdateEmail}
                      disabled={updateEmailMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {updateEmailMutation.isPending ? "Atualizando..." : "Atualizar Email"}
                    </Button>
                  </div>
                </div>

                {/* Alterar Senha */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Alterar Senha</Label>
                  </div>
                  <div className="space-y-3 pl-6">
                    <div className="space-y-2">
                      <Label htmlFor="current-password" className="text-sm">Senha Atual</Label>
                      <Input
                        id="current-password"
                        type="password"
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-sm">Nova Senha</Label>
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-sm">Confirmar Nova Senha</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleUpdatePassword}
                      disabled={updatePasswordMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {updatePasswordMutation.isPending ? "Atualizando..." : "Atualizar Senha"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Aparência */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Aparência
              </CardTitle>
              <CardDescription>
                Personalize a aparência da plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tema</Label>
                <p className="text-sm text-muted-foreground">
                  Tema atual: Light (claro)
                </p>
                <p className="text-sm text-muted-foreground">
                  Para alterar o tema, edite o arquivo client/src/App.tsx
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} size="lg">
              Salvar Configurações
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
