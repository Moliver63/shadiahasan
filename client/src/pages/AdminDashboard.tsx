import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BookOpen, PlayCircle, Users, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = trpc.courses.stats.useQuery();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Carregando...
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-20 bg-muted animate-pulse rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const statsCards = [
    {
      title: "Total de Cursos",
      value: stats?.totalCourses || 0,
      icon: BookOpen,
      description: "Cursos cadastrados",
    },
    {
      title: "Total de Aulas",
      value: stats?.totalLessons || 0,
      icon: PlayCircle,
      description: "Aulas disponíveis",
    },
    {
      title: "Matrículas",
      value: stats?.totalEnrollments || 0,
      icon: Users,
      description: "Alunos matriculados",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Visão geral da plataforma de cursos
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statsCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {card.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Bem-vindo ao Painel Administrativo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Use o menu lateral para navegar entre as diferentes seções do
              painel administrativo:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <BookOpen className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <strong>Cursos:</strong> Gerencie todos os cursos da
                  plataforma, crie novos cursos e edite informações existentes.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <PlayCircle className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <strong>Aulas:</strong> Adicione e organize aulas dentro dos
                  cursos, faça upload de vídeos e configure conteúdo.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Users className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <strong>Alunos:</strong> Visualize estatísticas de alunos e
                  matrículas na plataforma.
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
