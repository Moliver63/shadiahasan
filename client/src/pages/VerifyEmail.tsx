import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("");

  const verifyMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: (data) => {
      setStatus("success");
      setUserName(data.name || "");
      setMessage(`Email verificado com sucesso! Bem-vindo(a), ${data.name}!`);
      toast.success(`Bem-vindo(a), ${data.name}! Sua conta está ativa.`);
      // Redireciona para login após 3 segundos
      setTimeout(() => setLocation("/login"), 3000);
    },
    onError: (error) => {
      setStatus("error");
      setMessage(error.message);
      toast.error("Falha na verificação: " + error.message);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      verifyMutation.mutate({ token: tokenParam });
    } else {
      setStatus("error");
      setMessage("Token de verificação não encontrado na URL.");
      toast.error("Link de verificação inválido ou expirado.");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-50 to-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/"><img src="/logo.png" alt="Shadia Hasan" className="h-32 mx-auto mb-4 cursor-pointer hover:opacity-90 transition" /></Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100 text-center">
          {status === "loading" && (
            <>
              <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Verificando seu email...</h2>
              <p className="text-gray-600">Aguarde um momento.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Email Verificado! 🎉</h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <p className="text-sm text-gray-500 mb-6">Redirecionando para o login em instantes...</p>
              <Link href="/login">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  Fazer Login Agora
                </Button>
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Erro na Verificação</h2>
              <p className="text-gray-600 mb-6">{message}</p>
              <p className="text-sm text-gray-500 mb-6">O link pode ter expirado ou já foi usado.</p>
              <div className="flex gap-3">
                <Link href="/login" className="flex-1">
                  <Button variant="outline" className="w-full">Fazer Login</Button>
                </Link>
                <Link href="/signup" className="flex-1">
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                    Criar Conta
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="text-center mt-6">
          <Link href="/"><a className="text-sm text-muted-foreground hover:text-purple-600 transition">← Voltar para o site</a></Link>
        </div>
      </div>
    </div>
  );
}
