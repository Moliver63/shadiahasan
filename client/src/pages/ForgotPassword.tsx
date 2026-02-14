import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const requestResetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setIsLoading(false);
    },
    onError: () => {
      // Always show success to prevent email enumeration
      setSuccess(true);
      setIsLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    requestResetMutation.mutate({ email });
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-50 to-white">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/">
              <img 
                src="/logo.png" 
                alt="Shadia Hasan" 
                className="h-32 mx-auto mb-4 cursor-pointer hover:opacity-90 transition"
              />
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100 text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Email Enviado!</h2>
            <p className="text-gray-600 mb-6">
              Se existe uma conta associada a <strong>{email}</strong>, você receberá um email com instruções para redefinir sua senha.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Não recebeu o email? Verifique sua caixa de spam ou aguarde alguns minutos.
            </p>
            <Link href="/login">
              <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                Voltar para o Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-50 to-white">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <img 
              src="/logo.png" 
              alt="Shadia Hasan" 
              className="h-32 mx-auto mb-4 cursor-pointer hover:opacity-90 transition"
            />
          </Link>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Recuperar Senha
          </h1>
          <p className="text-muted-foreground mt-2">
            Digite seu email para receber instruções
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email cadastrado
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3"
            >
              {isLoading ? "Enviando..." : "Enviar Link de Recuperação"}
            </Button>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-blue-800">
                <strong>💡 Dica:</strong> O link de recuperação expira em 1 hora por segurança.
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>
            Lembrou sua senha?{" "}
            <Link href="/login">
              <a className="text-purple-600 font-semibold hover:underline">
                Fazer login
              </a>
            </Link>
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-4">
          <Link href="/">
            <a className="text-sm text-muted-foreground hover:text-purple-600 transition">
              ← Voltar para o site
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
