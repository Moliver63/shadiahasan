import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, DollarSign, TrendingUp, Activity, BookOpen, PlayCircle, Settings, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboard() {
  // Buscar dados reais do backend
  const { data: stats, isLoading: statsLoading } = trpc.admin.getStats.useQuery();
  const { data: users, isLoading: usersLoading } = trpc.admin.listUsers.useQuery();
  const { data: appointmentStats, isLoading: appointmentsLoading } = trpc.appointments.getStats.useQuery();

  const isLoading = statsLoading || usersLoading || appointmentsLoading;

  // Calcular métricas
  const totalUsers = users?.length || 0;
  const totalAppointments = appointmentStats?.total || 0;
  const scheduledAppointments = appointmentStats?.scheduled || 0;
  const completedAppointments = appointmentStats?.completed || 0;
  const totalCourses = stats?.totalCourses || 0;
  const totalEnrollments = stats?.totalEnrollments || 0;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard Administrativo</h1>
          <p className="text-muted-foreground">
            Visão geral das métricas e atividades da plataforma Shadia VR
          </p>
        </div>

        {/* Métricas principais */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Total de Usuários */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{totalUsers}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Usuários registrados na plataforma
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Sessões Agendadas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessões VR</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{totalAppointments}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-blue-600 font-medium">{scheduledAppointments}</span> agendadas •{" "}
                    <span className="text-green-600 font-medium">{completedAppointments}</span> concluídas
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Cursos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cursos</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{totalCourses}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-primary font-medium">{totalEnrollments}</span> matrículas ativas
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Engajamento */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engajamento</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {totalUsers > 0 ? Math.round((totalEnrollments / totalUsers) * 100) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Taxa de engajamento em cursos
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ações Rápidas */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Ações Rápidas</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/admin/users">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle>Gerenciar Usuários</CardTitle>
                  </div>
                  <CardDescription>
                    Visualizar, editar e gerenciar todos os usuários da plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-primary hover:underline font-medium">
                    Acessar gerenciamento →
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/appointments">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <CardTitle>Calendário de Sessões</CardTitle>
                  </div>
                  <CardDescription>
                    Visualizar e gerenciar todas as sessões VR agendadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-primary hover:underline font-medium">
                    Ver calendário →
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/programs">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <PlayCircle className="h-5 w-5 text-primary" />
                    <CardTitle>Programas VR</CardTitle>
                  </div>
                  <CardDescription>
                    Gerenciar programas e experiências de realidade virtual
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-primary hover:underline font-medium">
                    Ver programas →
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/financeiro">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <CardTitle>Relatórios Financeiros</CardTitle>
                  </div>
                  <CardDescription>
                    Acompanhar receitas, assinaturas e transações
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-primary hover:underline font-medium">
                    Ver relatórios →
                  </span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/courses">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <CardTitle>Cursos Educacionais</CardTitle>
                  </div>
                  <CardDescription>
                    Criar e editar cursos e conteúdo educacional
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-primary hover:underline font-medium">
                    Acessar cursos →
                  </span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Alerta sobre Stripe */}
        {!isLoading && (
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium mb-1 text-amber-900 dark:text-amber-100">
                    Configuração do Stripe Pendente
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Para processar pagamentos, adicione os Price IDs do Stripe em{" "}
                    <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded text-xs">
                      shared/stripe-config.ts
                    </code>
                    {" "}e configure a Secret Key nas configurações.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
