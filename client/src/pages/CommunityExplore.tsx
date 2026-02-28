import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import {
  Users,
  MapPin,
  BookOpen,
  Target,
  UserPlus,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";

export default function CommunityExplore() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: suggestions, isLoading } = trpc.community.getSuggestions.useQuery();
  const { data: myProfile } = trpc.profiles.getMyProfile.useQuery();
  const sendRequestMutation = trpc.community.sendRequest.useMutation();

  // Página acessível a todos - usuários não logados verão CTA para login

  const handleConnect = async (userId: number, userName: string) => {
    try {
      await sendRequestMutation.mutateAsync({
        toUserId: userId,
        message: `Olá! Gostaria de me conectar com você na jornada de transformação.`,
      });
      toast.success(`Solicitação enviada para ${userName}!`);
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar solicitação");
    }
  };

  const parseJSON = (jsonString: string | null) => {
    if (!jsonString) return [];
    try {
      return JSON.parse(jsonString);
    } catch {
      return [];
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
          <div className="flex items-center gap-4">
            <Link href="/community/connections">
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Minhas Conexões
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
        <div className="max-w-6xl mx-auto space-y-6">
          <Breadcrumbs items={getBreadcrumbs('/community/explore')} />

          {/* Cabeçalho */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Conexões Conscientes
            </div>
            <h1 className="text-4xl font-bold">Explorar Conexões</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Conecte-se com pessoas que estão na mesma fase de crescimento que você.
              Compartilhe experiências e evolua junto.
            </p>
          </div>

          {/* Aviso se perfil não é público */}
          {myProfile && myProfile.isPublic === 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-900">Seu perfil está privado</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Para aparecer nas sugestões de outras pessoas e receber convites de conexão,
                      torne seu perfil público nas configurações.
                    </p>
                    <Link href="/profile/edit">
                      <Button variant="outline" size="sm" className="mt-3">
                        Tornar Perfil Público
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de Sugestões */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Sugestões para Você</h2>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Carregando sugestões...
              </div>
            ) : suggestions && suggestions.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {suggestions.map((profile: any) => {
                  const interests = parseJSON(profile.interests);
                  const goals = parseJSON(profile.goals);
                  
                  return (
                    <Card key={profile.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
                              {profile.userId?.toString().charAt(0) || "U"}
                            </div>
                            <div>
                              <CardTitle className="text-lg">Usuário #{profile.userId}</CardTitle>
                              {profile.showCity === 1 && profile.city && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                  <MapPin className="h-3 w-3" />
                                  {profile.city}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {profile.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {profile.bio}
                          </p>
                        )}
                        
                        {interests.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 text-sm font-medium mb-2">
                              <BookOpen className="h-4 w-4 text-purple-600" />
                              Interesses
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {interests.slice(0, 3).map((interest: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {interest}
                                </Badge>
                              ))}
                              {interests.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{interests.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {goals.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 text-sm font-medium mb-2">
                              <Target className="h-4 w-4 text-green-600" />
                              Objetivos
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {goals.slice(0, 2).map((goal: string, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {goal}
                                </Badge>
                              ))}
                              {goals.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{goals.length - 2}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <Button 
                          className="w-full" 
                          onClick={() => handleConnect(profile.userId, `Usuário #${profile.userId}`)}
                          disabled={sendRequestMutation.isPending}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Conectar
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Nenhuma sugestão de conexão disponível no momento
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Volte mais tarde para descobrir pessoas na mesma jornada que você
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
