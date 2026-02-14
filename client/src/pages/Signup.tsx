import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setIsLoading(false);
    },
    onError: (error) => {
      alert(error.message);
      setIsLoading(false);
    },
  });

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

    setIsLoading(true);
    registerMutation.mutate({ email, password, name });
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-50 to-white">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100 text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Verifique seu email!</h2>
            <p className="text-gray-600 mb-6">
              Enviamos um link de verificação para <strong>{email}</strong>. 
              Clique no link para ativar sua conta e começar sua jornada.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Não recebeu o email? Verifique sua caixa de spam ou aguarde alguns minutos.
            </p>
            <Link href="/login">
              <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                Ir para o Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-50 to-white py-12">
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
            Comece Sua Jornada
          </h1>
          <p className="text-muted-foreground mt-2">
            Transforme sua vida através da realidade virtual
          </p>
        </div>

        {/* Signup Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100">
          {/* Benefits */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-purple-900 mb-2">✨ Ao criar sua conta você terá:</h3>
            <ul className="space-y-2 text-sm text-purple-800">
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                Acesso a programas de transformação
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                Certificados de conclusão
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                Comunidade de apoio
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                Acompanhamento de progresso
              </li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nome completo
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full"
              />
            </div>

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
                Senha (mínimo 8 caracteres)
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
                Confirmar senha
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
              {isLoading ? "Criando conta..." : "Criar conta gratuita"}
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-muted-foreground">
                  100% gratuito para começar
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Ao criar sua conta, você concorda com nossos{" "}
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
            Já tem uma conta?{" "}
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
