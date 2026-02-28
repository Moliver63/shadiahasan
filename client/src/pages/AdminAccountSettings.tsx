import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Mail, ArrowLeft, Shield } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminAccountSettings() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  const updateEmailMutation = trpc.adminManagement.updateOwnEmail.useMutation({
    onSuccess: () => {
      toast.success("E-mail atualizado com sucesso! Por favor, faça login novamente.");
      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar e-mail: ${error.message}`);
    },
  });
  
  const [emailForm, setEmailForm] = useState({
    newEmail: "",
    password: "",
  });
  
  const handleUpdateEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.newEmail || !emailForm.password) {
      toast.error("Preencha todos os campos");
      return;
    }
    updateEmailMutation.mutate(emailForm);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="container max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Painel
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <Settings className="h-10 w-10 text-purple-600" />
            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                Configurações da Conta
              </h1>
              <p className="text-slate-600 mt-1">
                Gerencie suas informações pessoais
              </p>
            </div>
          </div>
        </div>
        
        {/* Current Account Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600" />
              Informações Atuais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-slate-500">Nome</p>
              <p className="font-semibold">{user?.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">E-mail Atual</p>
              <p className="font-semibold">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Função</p>
              <p className="font-semibold capitalize">{user?.role}</p>
            </div>
          </CardContent>
        </Card>
        
        {/* Update Email Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Alterar E-mail
            </CardTitle>
            <CardDescription>
              Atualize seu endereço de e-mail. Você precisará fazer login novamente após a alteração.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateEmail} className="space-y-4">
              <div>
                <Label htmlFor="newEmail">Novo E-mail</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={emailForm.newEmail}
                  onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                  placeholder="novo@exemplo.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Senha Atual (para confirmar)</Label>
                <Input
                  id="password"
                  type="password"
                  value={emailForm.password}
                  onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                  placeholder="Digite sua senha atual"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Por segurança, precisamos confirmar sua senha antes de alterar o e-mail
                </p>
              </div>
              <Button 
                type="submit" 
                disabled={updateEmailMutation.isPending}
                className="w-full"
              >
                {updateEmailMutation.isPending ? "Atualizando..." : "Atualizar E-mail"}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* Security Notice */}
        <Card className="mt-6 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800 text-base">⚠️ Aviso de Segurança</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-yellow-700">
            <ul className="list-disc list-inside space-y-1">
              <li>Após alterar seu e-mail, você será desconectado automaticamente</li>
              <li>Use o novo e-mail para fazer login novamente</li>
              <li>Certifique-se de ter acesso ao novo endereço de e-mail</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
