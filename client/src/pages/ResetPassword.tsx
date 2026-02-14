import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setIsLoading(false);
    },
    onError: (error) => {
      alert(error.message);
      setIsLoading(false);
    },
  });

  useEffect(() => {
    // Get token from URL query params
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      alert("Token de recuperação não encontrado na URL.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      alert("As senhas não coincidem!");
      return;
    }

    if (password.length < 8) {
      alert("A senha deve ter no mínimo 8 caracteres!");
      return;
    }

    if (!token) {
      alert("Token inválido. Use o link enviado por email.");
      return;
    }

    setIsLoading(true);
    resetMutation.mutate({ token, password });
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
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Senha Redefinida! 🎉</h2>
            <p className="text-gray-600 mb-6">
              Sua senha foi alterada com sucesso. Agora você pode fazer login com sua nova senha.
            </p>
            <Link href="/login">
              <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                Fazer Login
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
            Nova Senha
          </h1>
          <p className="text-muted-foreground mt-2">
            Crie uma senha forte e segura
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Nova senha (mínimo 8 caracteres)
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full"
              />
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar nova senha
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3"
            >
              {isLoading ? "Salvando..." : "Redefinir Senha"}
            </Button>

            {/* Security Tips */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-4">
              <p className="text-sm font-semibold text-purple-900 mb-2">🔒 Dicas de Segurança:</p>
              <ul className="text-xs text-purple-800 space-y-1">
                <li>• Use pelo menos 8 caracteres</li>
                <li>• Combine letras, números e símbolos</li>
                <li>• Evite informações pessoais óbvias</li>
                <li>• Não reutilize senhas de outros sites</li>
              </ul>
            </div>
          </form>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
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
