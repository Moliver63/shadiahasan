import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  User,
  Mail,
  Globe,
  Bell,
  Upload,
  Save,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function EditProfile() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [language, setLanguage] = useState("pt-BR");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  // Controle de acesso
  if (!user) {
    navigate("/");
    return null;
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleSaveProfile = () => {
    // TODO: Implement profile update API
    toast.success("Perfil atualizado com sucesso!");
  };

  const handleUploadPhoto = () => {
    // TODO: Implement photo upload
    toast.info("Funcionalidade de upload de foto em desenvolvimento");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <img src="/logo.png" alt="Shadia Hasan" className="h-36" />
          </Link>
          <Link href="/profile">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Perfil
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Editar Perfil</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie suas informações pessoais e preferências
            </p>
          </div>

          <div className="space-y-6">
            {/* Foto de Perfil */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Foto de Perfil
                </CardTitle>
                <CardDescription>
                  Adicione uma foto para personalizar seu perfil
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={undefined} alt={user.name || "Usuário"} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Button onClick={handleUploadPhoto}>
                      <Upload className="mr-2 h-4 w-4" />
                      Fazer Upload
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      JPG, PNG ou GIF. Máximo 2MB.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informações Pessoais */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações Pessoais
                </CardTitle>
                <CardDescription>
                  Atualize seu nome e email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="flex gap-2">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="flex-1"
                    />
                    <Button variant="outline">
                      <Mail className="mr-2 h-4 w-4" />
                      Verificar
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enviaremos um email de confirmação se você alterar seu endereço
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Preferências */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Preferências
                </CardTitle>
                <CardDescription>
                  Configure idioma e outras preferências
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Idioma</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Selecione o idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="es-ES">Español</SelectItem>
                    </SelectContent>
                  </Select>
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
                  Gerencie como você recebe notificações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações por Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba atualizações sobre cursos e mensagens
                    </p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações Push</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba alertas no navegador
                    </p>
                  </div>
                  <Switch
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Novos Cursos</Label>
                    <p className="text-sm text-muted-foreground">
                      Seja notificado sobre novos conteúdos
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mensagens da Comunidade</Label>
                    <p className="text-sm text-muted-foreground">
                      Notificações de conexões e mensagens
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
                  Gerencie sua senha e segurança da conta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Senha</Label>
                    <p className="text-sm text-muted-foreground">
                      Última alteração há 3 meses
                    </p>
                  </div>
                  <Button variant="outline">Alterar Senha</Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Autenticação de Dois Fatores (2FA)</Label>
                    <p className="text-sm text-muted-foreground">
                      Adicione uma camada extra de segurança
                    </p>
                  </div>
                  <Button variant="outline">Ativar 2FA</Button>
                </div>
                <Separator />
                <div>
                  <Link href="/profile/sessions">
                    <Button variant="ghost" className="w-full justify-start">
                      Ver Sessões Ativas
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Botões de Ação */}
            <div className="flex gap-4">
              <Button onClick={handleSaveProfile} className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                Salvar Alterações
              </Button>
              <Link href="/profile">
                <Button variant="outline">Cancelar</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
