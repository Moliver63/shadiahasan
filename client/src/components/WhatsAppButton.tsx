import { MessageCircle } from "lucide-react";

/**
 * Botão flutuante do WhatsApp para contato direto com Shadia Hasan
 * Aparece fixo no canto inferior direito da tela
 */
export default function WhatsAppButton() {
  const phoneNumber = "5547991426662"; // +55 47 99142-6662
  const message = encodeURIComponent(
    "Olá Shadia! Vim através do seu site e gostaria de saber mais sobre os cursos."
  );
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-[#25D366] text-white rounded-full shadow-lg hover:bg-[#20BA5A] hover:scale-110 transition-all duration-300 group"
      aria-label="Fale com Shadia Hasan no WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
      
      {/* Tooltip */}
      <div className="absolute right-full mr-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        Fale com Shadia
        <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
      </div>

      {/* Pulse animation */}
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20"></span>
    </a>
  );
}
