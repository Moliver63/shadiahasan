import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Download, Share2, X } from "lucide-react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

type InstallAppButtonProps = {
  className?: string;
  mobile?: boolean;
  mode?: "inline" | "floating";
};

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

function detectPlatform() {
  if (typeof window === "undefined") {
    return {
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isMobile: false,
    };
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|chrome|android/.test(ua);
  const isMobile = isIOS || isAndroid;

  return { isIOS, isAndroid, isSafari, isMobile };
}

export default function InstallAppButton({
  className,
  mobile = false,
  mode = "inline",
}: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const platform = useMemo(() => detectPlatform(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissed = window.sessionStorage.getItem("shadia-install-cta-dismissed") === "true";

    setIsReady(true);
    setIsStandalone(isStandaloneMode());
    setIsDismissed(dismissed);

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setDialogOpen(false);
      window.sessionStorage.removeItem("shadia-install-cta-dismissed");
      toast.success("App instalado com sucesso.");
    };

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => {
      setIsStandalone(isStandaloneMode());
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    mediaQuery.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const handleInstallClick = async () => {
    if (platform.isIOS) {
      setDialogOpen(true);
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;

        if (choice.outcome === "accepted") {
          toast.success("Instalação iniciada no seu dispositivo.");
        } else {
          toast.message("Instalação cancelada.");
        }
      } catch (error) {
        console.error("[PWA] Falha ao abrir prompt de instalação", error);
        toast.error("Não foi possível abrir o instalador agora.");
      } finally {
        setDeferredPrompt(null);
      }

      return;
    }

    toast.message(
      platform.isAndroid
        ? "Abra o menu do navegador e toque em 'Instalar app' ou 'Adicionar à tela inicial'."
        : "Se o navegador permitir, use o menu para instalar este app.",
    );
  };

  const dismissFloatingCta = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("shadia-install-cta-dismissed", "true");
    }
    setIsDismissed(true);
  };

  if (!isReady || isStandalone || (mode === "floating" && isDismissed)) {
    return null;
  }

  const button = (
    <Button
      type="button"
      onClick={handleInstallClick}
      variant={mobile ? "secondary" : "outline"}
      size={mobile ? "lg" : "sm"}
      className={cn(mobile && "w-full justify-start", className)}
      aria-label="Instalar app"
    >
      <Download className="h-4 w-4" />
      Instalar app
    </Button>
  );

  const floatingButton = (
    <div
      className={cn(
        "fixed inset-x-3 bottom-4 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4",
        className,
      )}
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-background/95 p-3 shadow-2xl backdrop-blur sm:max-w-sm">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Instale o app</p>
            <p className="text-xs text-muted-foreground">
              Acesso rápido na tela inicial do celular ou computador.
            </p>
          </div>
        </div>

        <Button type="button" onClick={handleInstallClick} size="sm" className="shrink-0">
          Instalar
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="Fechar sugestão de instalação"
          onClick={dismissFloatingCta}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {mode === "floating" ? floatingButton : button}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Instalar app no iPhone</DialogTitle>
            <DialogDescription>
              No iPhone, a instalação é feita pelo menu de compartilhamento do navegador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="font-medium text-foreground">Passo a passo</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Toque no botão <span className="font-medium text-foreground inline-flex items-center gap-1"><Share2 className="h-4 w-4" /> Compartilhar</span>.</li>
                <li>Role o menu e escolha <span className="font-medium text-foreground">Adicionar à Tela de Início</span>.</li>
                <li>Confirme em <span className="font-medium text-foreground">Adicionar</span>.</li>
              </ol>
            </div>
            <p>
              Dica: para melhor compatibilidade no iPhone, use o Safari.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
