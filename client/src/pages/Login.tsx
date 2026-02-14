import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";


export default function Login() {
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.href = "/profile";
    },
    onError: (error) => {
      alert(error.message);
      setIsLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    loginMutation.mutate({ email, password });
  };

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
            Bem-vindo de Volta
          </h1>
          <p className="text-muted-foreground mt-2">
            Continue sua jornada de transformação interior
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
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

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
              />
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link href="/forgot-password">
                <a className="text-sm text-purple-600 hover:underline">
                  Esqueceu sua senha?
                </a>
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3"
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-muted-foreground">
                  Acesso rápido e seguro
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Ao continuar, você concorda com nossos{" "}
                <Link href="/terms">
                  <a className="text-purple-600 hover:underline">Termos de Uso</a>
                </Link>{" "}
                e{" "}
                <Link href="/privacy">
                  <a className="text-purple-600 hover:underline">Política de Privacidade</a>
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>
            Primeira vez aqui?{" "}
            <Link href="/signup">
              <a className="text-purple-600 font-semibold hover:underline">
                Criar conta gratuita
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
