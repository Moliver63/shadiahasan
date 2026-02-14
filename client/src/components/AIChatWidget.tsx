import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { X, MessageCircle, Send, Sparkles } from "lucide-react";
import { Link } from "wouter";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! 👋 Sou a consultora de cursos da Shadia Hasan. Estou aqui para te ajudar a encontrar o curso perfeito para sua jornada de transformação. Qual é o seu maior desafio ou objetivo no momento?",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      const content = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
      setMessages((prev) => [...prev, { role: "assistant", content }]);
      setIsTyping(false);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Desculpe, ocorreu um erro. Por favor, tente novamente." },
      ]);
      setIsTyping(false);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || isTyping) return;

    const userMessage = inputMessage.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInputMessage("");
    setIsTyping(true);

    chatMutation.mutate({
      message: userMessage,
      conversationHistory: messages,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Extract course links from message
  const renderMessage = (content: string) => {
    const linkRegex = /\[Link: (\/courses\/[^\]]+)\]/g;
    const parts = content.split(linkRegex);
    
    return parts.map((part, index) => {
      if (part.startsWith("/courses/")) {
        return (
          <Link key={index} href={part}>
            <Button variant="link" className="p-0 h-auto text-purple-600 hover:text-purple-700">
              Ver Curso →
            </Button>
          </Link>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
        aria-label="Abrir chat com IA"
      >
        <div className="relative">
          <MessageCircle className="w-6 h-6" />
          <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
        </div>
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Precisa de ajuda para escolher um curso?
        </span>
      </button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 z-50 w-96 h-[600px] shadow-2xl flex flex-col overflow-hidden border-2 border-purple-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <div>
            <h3 className="font-semibold">Consultora IA</h3>
            <p className="text-xs opacity-90">Shadia Hasan</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="text-white hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-800 shadow-sm border border-gray-200"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{renderMessage(msg.content)}</p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 rounded-lg p-3 shadow-sm border border-gray-200">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            disabled={isTyping}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isTyping}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
