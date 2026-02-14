import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import {
  Users,
  UserPlus,
  UserMinus,
  Check,
  X,
  ArrowLeft,
  Clock,
  Ban,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function CommunityConnections() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  
  const { data: connections, isLoading: connectionsLoading } = trpc.community.getMyConnections.useQuery();
  const { data: pendingRequests, isLoading: requestsLoading } = trpc.community.getPendingRequests.useQuery();
  
  const acceptMutation = trpc.community.acceptRequest.useMutation({
    onSuccess: () => {
      utils.community.getMyConnections.invalidate();
      utils.community.getPendingRequests.invalidate();
      toast.success("Conexão aceita!");
    },
  });
  
  const rejectMutation = trpc.community.rejectRequest.useMutation({
    onSuccess: () => {
      utils.community.getPendingRequests.invalidate();
      toast.success("Solicitação recusada");
    },
  });
  
  const blockMutation = trpc.community.blockUser.useMutation({
    onSuccess: () => {
      utils.community.getMyConnections.invalidate();
      toast.success("Usuário bloqueado");
    },
  });

  // Controle de acesso
  if (!user) {
    navigate("/");
    return null;
  }

  const handleAccept = async (requestId: number) => {
    try {
      await acceptMutation.mutateAsync({ requestId });
    } catch (error: any) {
      toast.error(error.message || "Erro ao aceitar solicitação");
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      await rejectMutation.mutateAsync({ requestId });
    } catch (error: any) {
      toast.error(error.message || "Erro ao recusar solicitação");
    }
  };

  const handleBlock = async (userId: number) => {
    if (!confirm("Tem certeza que deseja bloquear este usuário?")) return;
    
    try {
      await blockMutation.mutateAsync({ userId });
    } catch (error: any) {
      toast.error(error.message || "Erro ao bloquear usuário");
    }
  };

  const activeConnections = connections?.filter((c: any) => c.status === "active") || [];
  const blockedConnections = connections?.filter((c: any) => c.status === "blocked") || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <img src="/logo.png" alt="Shadia Hasan" className="h-36" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/community/explore">
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Explorar Conexões
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Cabeçalho */}
          <div>
            <h1 className="text-3xl font-bold">Minhas Conexões</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie suas conexões e solicitações
            </p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="connections" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="connections">
                Conexões ({activeConnections.length})
              </TabsTrigger>
              <TabsTrigger value="requests">
                Solicitações ({pendingRequests?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="blocked">
                Bloqueados ({blockedConnections.length})
              </TabsTrigger>
            </TabsList>

            {/* Conexões Ativas */}
            <TabsContent value="connections" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Conexões Ativas</CardTitle>
                  <CardDescription>
                    Pessoas com quem você está conectado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {connectionsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Carregando conexões...
                    </div>
                  ) : activeConnections.length > 0 ? (
                    <div className="space-y-3">
                      {activeConnections.map((connection: any) => {
                        const otherUserId = connection.userId1 === user.id ? connection.userId2 : connection.userId1;
                        
                        return (
                          <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                {otherUserId.toString().charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-semibold">Usuário #{otherUserId}</h4>
                                <p className="text-sm text-muted-foreground">
                                  Conectado em {new Date(connection.connectedAt).toLocaleDateString("pt-BR")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" disabled>
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleBlock(otherUserId)}
                              >
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        Você ainda não tem conexões
                      </p>
                      <Link href="/community/explore">
                        <Button>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Explorar Conexões
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Solicitações Pendentes */}
            <TabsContent value="requests" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Solicitações Recebidas</CardTitle>
                  <CardDescription>
                    Pessoas que querem se conectar com você
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {requestsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Carregando solicitações...
                    </div>
                  ) : pendingRequests && pendingRequests.length > 0 ? (
                    <div className="space-y-3">
                      {pendingRequests.map((request: any) => (
                        <div key={request.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                                {request.fromUserId.toString().charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-semibold">Usuário #{request.fromUserId}</h4>
                                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(request.createdAt).toLocaleDateString("pt-BR")}
                                </p>
                                {request.message && (
                                  <p className="text-sm mt-2 p-2 bg-muted rounded">
                                    "{request.message}"
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm"
                                onClick={() => handleAccept(request.id)}
                                disabled={acceptMutation.isPending}
                              >
                                <Check className="mr-1 h-4 w-4" />
                                Aceitar
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleReject(request.id)}
                                disabled={rejectMutation.isPending}
                              >
                                <X className="mr-1 h-4 w-4" />
                                Recusar
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Nenhuma solicitação pendente
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bloqueados */}
            <TabsContent value="blocked" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Usuários Bloqueados</CardTitle>
                  <CardDescription>
                    Pessoas que você bloqueou
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {blockedConnections.length > 0 ? (
                    <div className="space-y-3">
                      {blockedConnections.map((connection: any) => {
                        const otherUserId = connection.userId1 === user.id ? connection.userId2 : connection.userId1;
                        
                        return (
                          <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold">
                                {otherUserId.toString().charAt(0)}
                              </div>
                              <div>
                                <h4 className="font-semibold">Usuário #{otherUserId}</h4>
                                <Badge variant="secondary" className="mt-1">Bloqueado</Badge>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" disabled>
                              Desbloquear
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Ban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Nenhum usuário bloqueado
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
