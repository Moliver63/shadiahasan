import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import {
  MessageCircle,
  Send,
  ArrowLeft,
  Crown,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";

export default function Messages() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: conversations, isLoading: conversationsLoading } = trpc.messaging.getConversations.useQuery();
  const { data: messages, isLoading: messagesLoading } = trpc.messaging.getMessages.useQuery(
    { conversationId: selectedConversationId! },
    { enabled: !!selectedConversationId }
  );
  
  const utils = trpc.useUtils();
  const sendMutation = trpc.messaging.sendMessage.useMutation({
    onSuccess: () => {
      utils.messaging.getConversations.invalidate();
      utils.messaging.getMessages.invalidate();
      utils.messaging.getUnreadCount.invalidate();
      setMessageText("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const markAsReadMutation = trpc.messaging.markAsRead.useMutation({
    onSuccess: () => {
      utils.messaging.getConversations.invalidate();
      utils.messaging.getUnreadCount.invalidate();
    },
  });

  // Controle de acesso
  if (!user) {
    navigate("/");
    return null;
  }

  const selectedConversation = conversations?.find(c => c.id === selectedConversationId);
  const isFreeUser = user.plan === 'free';
  const canSendMessage = !isFreeUser || (selectedConversation?.otherUser as any)?.role === 'admin';

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read when conversation is selected
  useEffect(() => {
    if (selectedConversationId && (selectedConversation?.unreadCount || 0) > 0) {
      markAsReadMutation.mutate({ conversationId: selectedConversationId });
    }
  }, [selectedConversationId]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;
    
    if (!canSendMessage) {
      toast.error("Usuários do plano gratuito só podem enviar mensagens para administradores. Faça upgrade para o plano premium!");
      return;
    }
    
    try {
      await sendMutation.mutateAsync({
        receiverId: selectedConversation.otherUser.id,
        content: messageText.trim(),
      });
    } catch (error) {
      // Error already handled by onError
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <img src="/logo.png" alt="Shadia Hasan" className="h-36" />
          </Link>
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Mensagens</h1>
            <p className="text-muted-foreground mt-2">
              Converse com outros membros da comunidade
            </p>
          </div>

          {/* Free Plan Notice */}
          {isFreeUser && (
            <Card className="mb-6 border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-900">Plano Gratuito</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Você pode receber mensagens de qualquer pessoa, mas só pode enviar mensagens para administradores.
                      Faça upgrade para o plano premium para conversar com todos os usuários.
                    </p>
                    <Link href="/pricing">
                      <Button variant="outline" size="sm" className="mt-3">
                        <Crown className="mr-2 h-4 w-4" />
                        Ver Planos Premium
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            {/* Conversations List */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Conversas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {conversationsLoading ? (
                    <div className="p-4 text-center text-muted-foreground">
                      Carregando...
                    </div>
                  ) : conversations && conversations.length > 0 ? (
                    <div className="divide-y">
                      {conversations.map((conv: any) => (
                        <button
                          key={conv.id}
                          onClick={() => setSelectedConversationId(conv.id)}
                          className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                            selectedConversationId === conv.id ? 'bg-muted' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                                  {conv.otherUser.name?.charAt(0) || 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold truncate">
                                      {conv.otherUser.name || `Usuário #${conv.otherUser.id}`}
                                    </h4>
                                    {(conv.otherUser as any).role === 'admin' && (
                                      <Badge variant="secondary" className="text-xs">Admin</Badge>
                                    )}
                                  </div>
                                  {conv.lastMessage && (
                                    <p className="text-sm text-muted-foreground truncate">
                                      {conv.lastMessage.content}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            {conv.unreadCount > 0 && (
                              <Badge className="ml-2">{conv.unreadCount}</Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Nenhuma conversa ainda
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Messages Area */}
            <Card className="md:col-span-2">
              {selectedConversation ? (
                <>
                  <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {selectedConversation.otherUser.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {selectedConversation.otherUser.name || `Usu\u00e1rio #${selectedConversation.otherUser.id}`}
                          {(selectedConversation.otherUser as any).role === 'admin' && (
                            <Badge variant="secondary">Admin</Badge>
                          )}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {selectedConversation.otherUser.email}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[400px] p-4">
                      {messagesLoading ? (
                        <div className="text-center text-muted-foreground">
                          Carregando mensagens...
                        </div>
                      ) : messages && messages.length > 0 ? (
                        <div className="space-y-4">
                          {messages.map((msg: any) => {
                            const isMe = msg.senderId === user.id;
                            return (
                              <div
                                key={msg.id}
                                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-[70%] rounded-lg p-3 ${
                                    isMe
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted'
                                  }`}
                                >
                                  <p className="text-sm">{msg.content}</p>
                                  <p className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                    {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground">
                          Nenhuma mensagem ainda. Inicie a conversa!
                        </div>
                      )}
                    </ScrollArea>
                    <div className="border-t p-4">
                      {canSendMessage ? (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Digite sua mensagem..."
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                          />
                          <Button
                            onClick={handleSendMessage}
                            disabled={!messageText.trim() || sendMutation.isPending}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center p-4 bg-muted rounded-lg">
                          <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Você não pode enviar mensagens para este usuário no plano gratuito
                          </p>
                          <Link href="/pricing">
                            <Button size="sm" className="mt-3">
                              <Crown className="mr-2 h-4 w-4" />
                              Fazer Upgrade
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className="h-[500px] flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Selecione uma conversa para começar
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
