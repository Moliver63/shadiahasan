import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings, Globe, Bell, Shield, Palette } from "lucide-react";

export default function AdminSettings() {
  const handleSave = () => {
    toast.success("Configurações salvas com sucesso!");
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
            <CardContent className="space-y-4">
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
