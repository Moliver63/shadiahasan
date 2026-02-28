import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Cookie, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";

interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
}

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Sempre true, não pode ser desabilitado
    functional: false,
    analytics: false,
  });

  useEffect(() => {
    // Verificar se o usuário já deu consentimento
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      // Mostrar banner após 1 segundo
      setTimeout(() => setShowBanner(true), 1000);
    } else {
      // Carregar preferências salvas
      try {
        const saved = JSON.parse(consent);
        setPreferences(saved);
      } catch (e) {
        console.error("Erro ao carregar preferências de cookies:", e);
      }
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      functional: true,
      analytics: true,
    };
    savePreferences(allAccepted);
    setShowBanner(false);
  };

  const handleRejectAll = () => {
    const onlyEssential: CookiePreferences = {
      essential: true,
      functional: false,
      analytics: false,
    };
    savePreferences(onlyEssential);
    setShowBanner(false);
  };

  const handleSavePreferences = () => {
    savePreferences(preferences);
    setShowPreferences(false);
    setShowBanner(false);
  };

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem("cookie-consent", JSON.stringify(prefs));
    setPreferences(prefs);
    
    // Aqui você pode adicionar lógica para ativar/desativar cookies baseado nas preferências
    // Por exemplo, desabilitar Google Analytics se analytics === false
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Banner de Cookies */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-purple-200 shadow-2xl animate-in slide-in-from-bottom duration-500">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            {/* Ícone e Texto */}
            <div className="flex-1 flex items-start gap-3">
              <Cookie className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Este site usa cookies
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Utilizamos cookies para melhorar sua experiência, personalizar conteúdo e analisar o tráfego do site. 
                  Cookies essenciais são necessários para o funcionamento básico da plataforma. 
                  Você pode escolher quais categorias aceitar ou{" "}
                  <Link href="/privacy" className="text-purple-600 hover:underline font-medium">
                    ler nossa Política de Privacidade
                  </Link>
                  .
                </p>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreferences(true)}
                className="w-full sm:w-auto"
              >
                <Settings className="w-4 h-4 mr-2" />
                Preferências
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRejectAll}
                className="w-full sm:w-auto"
              >
                Recusar
              </Button>
              <Button
                size="sm"
                onClick={handleAcceptAll}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700"
              >
                Aceitar Todos
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Preferências */}
      <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="w-5 h-5 text-purple-600" />
              Preferências de Cookies
            </DialogTitle>
            <DialogDescription>
              Gerencie suas preferências de cookies. Cookies essenciais são necessários para o funcionamento do site e não podem ser desabilitados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Cookies Essenciais */}
            <div className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-gray-900">Cookies Essenciais</h4>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                    Sempre Ativo
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Necessários para o funcionamento básico do site, incluindo autenticação, segurança e navegação. 
                  Estes cookies não podem ser desabilitados.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Exemplos: cookies de sessão, autenticação, preferências de idioma
                </p>
              </div>
              <Switch
                checked={preferences.essential}
                disabled
                className="mt-1"
              />
            </div>

            {/* Cookies Funcionais */}
            <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">Cookies Funcionais</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Permitem funcionalidades aprimoradas e personalização, como lembrar suas preferências de tema, 
                  progresso em cursos e configurações personalizadas.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Exemplos: preferências de tema, progresso de cursos, configurações de notificação
                </p>
              </div>
              <Switch
                checked={preferences.functional}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, functional: checked })
                }
                className="mt-1"
              />
            </div>

            {/* Cookies de Analytics */}
            <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">Cookies de Análise</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Ajudam-nos a entender como os visitantes interagem com o site, coletando e relatando informações 
                  anonimamente. Isso nos permite melhorar a experiência do usuário.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Exemplos: Google Analytics, métricas de uso, análise de comportamento
                </p>
              </div>
              <Switch
                checked={preferences.analytics}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, analytics: checked })
                }
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowPreferences(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSavePreferences}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              Salvar Preferências
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Para mais informações, consulte nossa{" "}
            <Link href="/privacy">
              <a className="text-purple-600 hover:underline">
                Política de Privacidade
              </a>
            </Link>
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
