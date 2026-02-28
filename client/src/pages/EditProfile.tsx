import { useAuth } from "@/_core/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";

export default function EditProfile() {
  const { user, loading, refetch } = useAuth();
  const [, navigate] = useLocation();

  // ── Profile fields ──────────────────────────────────────────
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [language, setLanguage] = useState("pt-BR");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  // ── Avatar ──────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // ── Password dialog ─────────────────────────────────────────
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Mutations ───────────────────────────────────────────────
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      refetch?.();
    },
    onError: (err) => toast.error("Erro ao atualizar perfil: " + err.message),
  });

  const uploadAvatarMutation = trpc.profile.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success("Foto de perfil atualizada!");
      refetch?.();
      setAvatarFile(null);
    },
    onError: (err) => toast.error("Erro ao salvar foto: " + err.message),
  });

  const changePasswordMutation = trpc.profile.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const resendVerificationMutation = trpc.profile.resendVerification.useMutation({
    onSuccess: () =>
      toast.success("E-mail de verificação reenviado! Verifique sua caixa de entrada."),
    onError: (err) => toast.error("Erro: " + err.message),
  });

  // ── Auth guard ──────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setEmail(user.email || "");
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return null;

  // ── Helpers ─────────────────────────────────────────────────
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    const parts = name.split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const currentAvatarUrl =
    avatarPreview ||
    (user as any)?.avatarUrl ||
    (user as any)?.imageUrl ||
    (user as any)?.picture ||
    "";

  const isEmailVerified = !!(user as any)?.emailVerified;

  // ── Handlers ────────────────────────────────────────────────
  const handleSaveProfile = () => {
    if (!name.trim()) { toast.error("O nome não pode estar vazio."); return; }
    if (!email.includes("@")) { toast.error("Email inválido."); return; }
    updateProfileMutation.mutate({ name: name.trim(), email: email.trim() });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      toast.error("Formato não suportado. Use JPG, PNG, GIF ou WEBP.");
      return;
    }

    setAvatarFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) { fileInputRef.current?.click(); return; }

    // Convert to base64 and send to backend
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      uploadAvatarMutation.mutate({ base64, mimeType: avatarFile.type });
    };
    reader.readAsDataURL(avatarFile);
  };

  const handleChangePassword = () => {
    if (!currentPassword) { toast.error("Digite a senha atual."); return; }
    if (newPassword.length < 8) { toast.error("A nova senha deve ter pelo menos 8 caracteres."); return; }
    if (newPassword !== confirmPassword) { toast.error("As senhas não coincidem."); return; }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleResendVerification = () => {
    resendVerificationMutation.mutate();
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
          <Breadcrumbs items={getBreadcrumbs("/edit-profile")} />

          <div className="mb-6">
            <h1 className="text-3xl font-bold">Editar Perfil</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie suas informações pessoais e preferências
            </p>
          </div>

          <div className="space-y-6">
            {/* ── Foto ─────────────────────────────────────────── */}
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
                    <AvatarImage src={currentAvatarUrl} alt={user.name || "Usuário"} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Escolher Foto
                      </Button>
                      {avatarFile && (
                        <Button
                          onClick={handleUploadAvatar}
                          disabled={uploadAvatarMutation.isPending}
                        >
                          {uploadAvatarMutation.isPending ? "Salvando..." : "Salvar Foto"}
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      JPG, PNG, GIF ou WEBP. Máximo 2MB.
                    </p>
                    {avatarFile && (
                      <p className="text-sm text-primary font-medium">
                        Arquivo selecionado: {avatarFile.name}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Informações Pessoais ──────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações Pessoais
                </CardTitle>
                <CardDescription>Atualize seu nome e email</CardDescription>
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
                  <div className="flex gap-2 items-center">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="flex-1"
                    />
                    {isEmailVerified ? (
                      <Badge variant="outline" className="text-green-600 border-green-300 whitespace-nowrap flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Verificado
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResendVerification}
                        disabled={resendVerificationMutation.isPending}
                        className="whitespace-nowrap"
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        {resendVerificationMutation.isPending
                          ? "Enviando..."
                          : "Verificar Email"}
                      </Button>
                    )}
                  </div>
                  {!isEmailVerified && (
                    <p className="text-sm text-yellow-600">
                      ⚠️ Email não verificado. Clique em "Verificar Email" para receber o link de confirmação.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Preferências ─────────────────────────────────── */}
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
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="language">Idioma</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="language">
                      <SelectValue />
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

            {/* ── Notificações ─────────────────────────────────── */}
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
                {[
                  {
                    label: "Notificações por Email",
                    desc: "Receba atualizações sobre cursos e mensagens",
                    state: emailNotifications,
                    set: setEmailNotifications,
                  },
                  {
                    label: "Notificações Push",
                    desc: "Receba alertas no navegador",
                    state: pushNotifications,
                    set: setPushNotifications,
                  },
                ].map(({ label, desc, state, set }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>{label}</Label>
                        <p className="text-sm text-muted-foreground">{desc}</p>
                      </div>
                      <Switch checked={state} onCheckedChange={set} />
                    </div>
                    <Separator className="mt-4" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* ── Segurança ────────────────────────────────────── */}
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
                {/* Só mostra troca de senha para usuários com email/password */}
                {(user as any).loginMethod === "email" || (user as any).passwordHash ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Senha</Label>
                        <p className="text-sm text-muted-foreground">
                          Altere sua senha de acesso
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPasswordDialogOpen(true)}
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Alterar Senha
                      </Button>
                    </div>
                    <Separator />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Senha</Label>
                        <p className="text-sm text-muted-foreground">
                          Sua conta usa login social (Google/Apple) — sem senha cadastrada
                        </p>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Autenticação de Dois Fatores (2FA)</Label>
                    <p className="text-sm text-muted-foreground">
                      Em breve — adicione uma camada extra de segurança
                    </p>
                  </div>
                  <Button type="button" variant="outline" disabled>
                    Em breve
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── Botões ───────────────────────────────────────── */}
            <div className="flex gap-4">
              <Button
                onClick={handleSaveProfile}
                className="flex-1"
                disabled={updateProfileMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                {updateProfileMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Link href="/profile">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialog: Alterar Senha ─────────────────────────────── */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Digite sua senha atual e escolha uma nova senha com pelo menos 8 caracteres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Senha atual */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Sua senha atual"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowCurrent((v) => !v)}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {/* Nova senha */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowNew((v) => !v)}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword && newPassword.length < 8 && (
                <p className="text-xs text-destructive">Mínimo de 8 caracteres</p>
              )}
            </div>
            {/* Confirmar nova senha */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não coincidem</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPasswordDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={
                changePasswordMutation.isPending ||
                !currentPassword ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword
              }
            >
              {changePasswordMutation.isPending ? "Salvando..." : "Alterar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
