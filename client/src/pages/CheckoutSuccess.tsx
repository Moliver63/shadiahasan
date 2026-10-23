import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";

export default function CheckoutSuccess() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const sessionId = searchParams.get('session_id');
  // PIX/boleto (Asaas) só confirmam depois; o acesso é liberado automaticamente quando o pagamento cair
  const isAsaas = searchParams.get('provider') === 'asaas';
  // Teste pago de 1 aula: libera só aquela aula, e o caminho natural depois é assinar
  const isTrial = searchParams.get('trial') === '1';
  const trialLessonId = Number(searchParams.get('lesson')) || 0;

  useEffect(() => {
    // You could verify the session with Stripe here if needed
    console.log('Checkout session ID:', sessionId);
  }, [sessionId]);

  if (isTrial) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-xl w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <CardTitle className="text-3xl">Pagamento em processamento</CardTitle>
            <CardDescription className="text-lg">
              Assim que o pagamento for confirmado, sua aula é liberada automaticamente (PIX em minutos, boleto em até 3 dias úteis, cartão na hora).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {trialLessonId > 0 && (
                <Link href={`/lesson/${trialLessonId}`} className="flex-1">
                  <Button className="w-full" size="lg">Ir para a aula</Button>
                </Link>
              )}
              <Link href="/pricing" className="flex-1">
                <Button variant="outline" className="w-full" size="lg">Ver planos de assinatura</Button>
              </Link>
            </div>
            <p className="text-center text-sm text-gray-500">
              Se a aula ainda aparecer bloqueada, aguarde a confirmação do pagamento e atualize a página.
              Dúvidas? Fale pelo{" "}
              <a href="https://wa.me/5547991665536" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">WhatsApp</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <CardTitle className="text-3xl">{isAsaas ? "Pagamento em processamento" : "Pagamento Confirmado!"}</CardTitle>
          <CardDescription className="text-lg">
            {isAsaas
              ? "Assim que o pagamento for confirmado, sua assinatura é ativada automaticamente (PIX em minutos, boleto em até 3 dias úteis)"
              : "Sua assinatura foi ativada com sucesso"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Sparkles className="h-6 w-6 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-purple-900 mb-2">
                  Bem-vinda à sua jornada de transformação!
                </h3>
                <p className="text-purple-700 text-sm">
                  Você agora tem acesso completo a todos os recursos do seu plano. 
                  Comece explorando nossos programas VR e cursos exclusivos.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold">Próximos passos:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">1.</span>
                <span>Explore os programas VR disponíveis na plataforma</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">2.</span>
                <span>Acesse seu dashboard para acompanhar seu progresso</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">3.</span>
                <span>Junte-se à comunidade e conecte-se com outros membros</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 font-bold">4.</span>
                <span>Agende sua primeira sessão individual (planos VIP)</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Link href="/courses" className="flex-1">
              <Button className="w-full" size="lg">
                Explorar Programas
              </Button>
            </Link>
            <Link href="/dashboard" className="flex-1">
              <Button variant="outline" className="w-full" size="lg">
                Ir para Dashboard
              </Button>
            </Link>
          </div>

          <div className="text-center text-sm text-gray-500 pt-4 border-t">
            <p>
              Você receberá um email de confirmação em breve.
              <br />
              Dúvidas? Entre em contato pelo{" "}
              <a 
                href="https://wa.me/5547991665536" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                WhatsApp
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
