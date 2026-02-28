import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { MessageCircle, X } from "lucide-react";

// Mensagens rotativas alinhadas ao propósito do site e da Shadia
const MESSAGES = [
  "Precisa conversar agora? Estou aqui para você 💬",
  "Pronta para sua transformação? Vamos começar juntos ✨",
  "Busca clareza e paz interior? Agende sua sessão 🌿",
  "Você não está sozinha nessa jornada 💛",
  "Dê o primeiro passo para sua evolução consciente 🦋",
  "Agende sua sessão agora e inicie sua transformação 🌸",
];

export function ShadiaAssistantChat() {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [showBubble, setShowBubble] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if user is logged in
  const { data: user } = trpc.auth.me.useQuery();
  const isLoggedIn = !!user;

  // Check cookie consent
  useEffect(() => {
    const checkConsent = () => {
      const consent = localStorage.getItem("cookie-consent");
      setHasConsent(!!consent);
    };

    // Check immediately
    checkConsent();

    // Listen for storage changes (when user accepts cookies)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "cookie-consent") {
        checkConsent();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Also check periodically in case consent is given in the same tab
    const interval = setInterval(checkConsent, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Show bubble after 3 seconds (only if consent given and not logged in)
  useEffect(() => {
    if (!hasConsent || isLoggedIn) return;

    const timer = setTimeout(() => {
      setShowBubble(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasConsent, isLoggedIn]);

  // Rotate messages every 10 seconds
  useEffect(() => {
    if (!showBubble && !isExpanded) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [showBubble, isExpanded]);

  // Shake animation every 15 seconds to grab attention (only when not logged in)
  useEffect(() => {
    if (isLoggedIn) return;

    const shakeInterval = setInterval(() => {
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 800);
    }, 15000);

    return () => clearInterval(shakeInterval);
  }, [isLoggedIn]);

  const handleClick = () => {
    if (isLoggedIn && !isExpanded) {
      // If logged in and collapsed, expand the avatar
      setIsExpanded(true);
    } else {
      // Otherwise, open WhatsApp
      const message = encodeURIComponent(
        "Olá! Gostaria de conversar sobre os programas de desenvolvimento pessoal."
      );
      window.open(`https://wa.me/5547991426662?text=${message}`, "_blank");
    }
  };

  const handleCollapse = () => {
    setIsExpanded(false);
  };

  // Don't render avatar if user hasn't accepted cookies
  if (!hasConsent) {
    return null;
  }

  // Render collapsed tab for logged-in users
  if (isLoggedIn && !isExpanded) {
    return (
      <button
        onClick={handleClick}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-[9999] bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-6 rounded-l-lg shadow-lg hover:shadow-xl transition-all hover:px-4 group"
        aria-label="Abrir ajuda"
      >
        <div className="flex flex-col items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          <div className="writing-mode-vertical text-sm font-semibold tracking-wider">
            AJUDA
          </div>
        </div>
        
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-l-lg bg-gradient-to-r from-purple-400 to-pink-400 opacity-0 group-hover:opacity-30 blur-md transition-opacity" />
      </button>
    );
  }

  // Render full avatar (for non-logged-in users or when expanded)
  return (
    <div className="fixed bottom-3 right-3 md:bottom-5 md:right-5 z-[9999] flex flex-col items-end gap-2 md:gap-3">
      {/* Chat Bubble with rotating messages - positioned above avatar */}
      {(showBubble || isExpanded) && (
        <div className="chat-bubble animate-fade-up max-w-[200px] md:max-w-xs mb-1 md:mb-2 relative">
          <p className="text-xs md:text-sm font-medium text-gray-800">
            {MESSAGES[currentMessageIndex]}
          </p>
          
          {/* Close button for logged-in users */}
          {isLoggedIn && isExpanded && (
            <button
              onClick={handleCollapse}
              className="absolute -top-2 -right-2 w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
              aria-label="Recolher ajuda"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>
      )}

      {/* Avatar Button */}
      <button
        onClick={handleClick}
        className={`assistant-avatar group relative ${
          shouldShake ? "animate-shake-attention" : ""
        }`}
        aria-label="Conversar com Shadia"
      >
        {/* Glow effect - intensified, smaller on mobile */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 opacity-50 md:opacity-60 blur-lg md:blur-xl animate-glow-pulse" />
        
        {/* Avatar image - responsive: 100px mobile, 160px desktop */}
        <img
          src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/hrDldTDQHHqwXNHA.png"
          alt="Shadia"
          className="relative w-24 h-24 md:w-40 md:h-40 rounded-full object-cover shadow-xl md:shadow-2xl border-2 md:border-4 border-white animate-bounce-subtle"
        />

        {/* Online indicator - responsive */}
        <div className="absolute bottom-1 right-1 md:bottom-2 md:right-2 w-4 h-4 md:w-6 md:h-6 bg-green-500 rounded-full border-2 border-white animate-pulse" />
      </button>
    </div>
  );
}
