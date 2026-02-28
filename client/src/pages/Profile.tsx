import { useAuth } from "@/_core/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import {
  User,
  Mail,
  Calendar,
  BookOpen,
  Award,
  TrendingUp,
  Settings,
  Shield,
  ArrowLeft,
} from "lucide-react";

export default function Profile() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: enrollments, isLoading: enrollmentsLoading } =
    trpc.enrollments.myEnrollments.useQuery(undefined, { enabled: !!user });
  const { data: certificates, isLoading: certificatesLoading } =
    trpc.certificates.getUserCertificates.useQuery(undefined, {
      enabled: !!user,
    });

  // Aguarda resolução do estado de autenticação
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Controle de acesso: redireciona se não autenticado
  if (!user) {
    navigate("/");
    return null;
  }

  const completedCourses =
    enrollments?.filter((e: any) => e.progress === 100).length || 0;
  const inProgressCourses =
    enrollments?.filter((e: any) => e.progress > 0 && e.progress < 100)
      .length || 0;
  const totalCertificates = certificates?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <img src="/logo.png" alt="Shadia Hasan" className="h-36" />
          </Link>
          <div className="flex items-center gap-4">
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
          {/* Cabeçalho do Perfil */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-6">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold">
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-3xl font-bold">
                        {user.name || "Usuário"}
                      </h1>
                      <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>{user.email}</span>
                        </div>
                        {user.role === "admin" && (
                          <Badge variant="default" className="gap-1">
                            <Shield className="h-3 w-3" />
                            Administrador
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href="/edit-profile">
                        <Button variant="outline">
                          <Settings className="mr-2 h-4 w-4" />
                          Editar Perfil
                        </Button>
                      </Link>
                      <Link href="/my-subscription">
                        <Button variant="default">Minha Assinatura</Button>
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Membro desde{" "}
                        {new Date(user.createdAt).toLocaleDateString("pt-BR", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <Badge
                      variant={
                        user.plan === "premium" ? "default" : "secondary"
                      }
                    >
                      {user.plan === "premium" ? "👑 Premium" : "Gratuito"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-purple-600" />
                  Programas em Andamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{inProgressCourses}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Continue sua jornada
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Programas Concluídos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{completedCourses}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Parabéns pela dedicação!
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Award className="h-4 w-4 text-yellow-600" />
                  Certificados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalCertificates}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Conquistas desbloqueadas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Meus Programas */}
          <Card>
            <CardHeader>
              <CardTitle>Meus Programas</CardTitle>
              <CardDescription>
                Acompanhe seu progresso em cada jornada de transformação
              </CardDescription>
            </CardHeader>
            <CardContent>
              {enrollmentsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando programas...
                </div>
              ) : enrollments && enrollments.length > 0 ? (
                <div className="space-y-4">
                  {enrollments.map((enrollment: any) => (
                    <div key={enrollment.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">
                          {enrollment.course?.title || "Programa"}
                        </h3>
                        <Badge
                          variant={
                            enrollment.progress === 100
                              ? "default"
                              : "secondary"
                          }
                        >
                          {enrollment.progress === 100
                            ? "Concluído"
                            : "Em andamento"}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Progresso
                          </span>
                          <span className="font-medium">
                            {enrollment.progress}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all"
                            style={{ width: `${enrollment.progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-muted-foreground">
                            Matriculado em{" "}
                            {new Date(
                              enrollment.enrolledAt
                            ).toLocaleDateString("pt-BR")}
                          </span>
                          <Link href={`/courses/${enrollment.course?.slug}`}>
                            <Button variant="outline" size="sm">
                              {enrollment.progress === 100
                                ? "Revisar"
                                : "Continuar"}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Você ainda não está matriculado em nenhum programa
                  </p>
                  <Link href="/courses">
                    <Button>Explorar Programas</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Certificados */}
          <Card>
            <CardHeader>
              <CardTitle>Certificados Conquistados</CardTitle>
              <CardDescription>
                Reconhecimento pela sua dedicação e evolução
              </CardDescription>
            </CardHeader>
            <CardContent>
              {certificatesLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando certificados...
                </div>
              ) : certificates && certificates.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {certificates.map((certificate: any) => (
                    <div
                      key={certificate.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <Award className="h-8 w-8 text-yellow-600 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-semibold">
                            {certificate.course?.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Emitido em{" "}
                            {new Date(
                              certificate.issuedAt
                            ).toLocaleDateString("pt-BR")}
                          </p>
                          <Link href={`/certificates/${certificate.id}`}>
                            <Button
                              variant="link"
                              className="p-0 h-auto mt-2"
                            >
                              Ver Certificado →
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Complete programas para conquistar certificados
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
