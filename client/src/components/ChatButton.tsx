import { MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const phoneNumber = "5547991426662"; // +55 47 99142-6662
  
  const message = encodeURIComponent(
    "Olá, Shadia! 👋\n\n" +
    "Gostaria de conversar sobre seu trabalho de apoio individual e conhecer mais sobre os programas disponíveis.\n\n" +
    "Estou interessado(a) em iniciar minha jornada de transformação pessoal."
  );
  
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

  const handleClick = () => {
    window.open(whatsappUrl, "_blank");
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Tooltip/Card */}
        {isOpen && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm border border-purple-100 animate-in slide-in-from-bottom-5 duration-300">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xl font-bold">S</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Shadia Hasan</h3>
                  <p className="text-sm text-gray-500">Disponível agora</p>
                </div>
              </div>
              
              <p className="text-gray-700 text-sm leading-relaxed">
                Olá! 👋 Que bom ter você aqui. Estou disponível para conversar sobre sua jornada de transformação.
              </p>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-purple-900 mb-2">
                  ✨ Conversa Inicial
                </p>
                <p className="text-xs text-purple-800">
                  Vamos conversar sobre seus objetivos e como posso apoiar sua jornada de transformação.
                </p>
              </div>
              
              <Button
                onClick={handleClick}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold"
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Agendar no WhatsApp
              </Button>
            </div>
          </div>
        )}

        {/* Main Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="h-16 w-16 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-2xl flex items-center justify-center text-white transition-all duration-300 hover:scale-110 group"
          aria-label="Abrir chat para agendamento"
        >
          {isOpen ? (
            <X className="h-7 w-7" />
          ) : (
            <MessageCircle className="h-7 w-7 group-hover:animate-bounce" />
          )}
        </button>
      </div>
    </>
  );
}
