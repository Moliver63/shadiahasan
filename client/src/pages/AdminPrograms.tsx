import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Eye, Users, Clock } from "lucide-react";

export default function AdminPrograms() {
  const { data: courses, isLoading } = trpc.courses.list.useQuery();

  const getDifficultyBadge = (difficulty: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      beginner: { variant: "secondary", label: "Iniciante" },
      intermediate: { variant: "default", label: "Intermediário" },
      advanced: { variant: "destructive", label: "Avançado" },
    };
    const config = variants[difficulty] || variants.beginner;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatPrice = (price: number) => {
    return (price / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gerenciamento de Programas</h1>
            <p className="text-muted-foreground">
              Crie, edite e gerencie os programas VR da plataforma
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Programa
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Programas</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courses?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Programas ativos na plataforma</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matrículas Totais</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-muted-foreground">Usuários matriculados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duração Total</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {courses?.reduce((acc, course) => acc + (course.duration || 0), 0) || 0} min
              </div>
              <p className="text-xs text-muted-foreground">Conteúdo disponível</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Programas */}
        <div className="grid gap-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Carregando programas...
              </CardContent>
            </Card>
          ) : !courses || courses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum programa encontrado
              </CardContent>
            </Card>
          ) : (
            courses.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      {course.thumbnail && (
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="h-24 w-24 rounded-lg object-cover"
                        />
                      )}
                      <div className="space-y-1">
                        <CardTitle className="text-xl">{course.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {course.description}
                        </CardDescription>
                        <div className="flex items-center gap-2 pt-2">
                          {getDifficultyBadge(course.difficulty)}
                          <Badge variant="outline">{course.category}</Badge>
                          {course.featured && (
                            <Badge className="bg-yellow-500">Destaque</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="grid gap-4 md:grid-cols-3">
                      {/* Duração */}
                      <div>
                        <p className="text-sm font-medium">Duração</p>
                        <p className="text-sm text-muted-foreground">
                          {course.duration} minutos
                        </p>
                      </div>

                      {/* Preço */}
                      <div>
                        <p className="text-sm font-medium">Preço</p>
                        <p className="text-sm text-muted-foreground">
                          {course.price ? formatPrice(course.price) : "Gratuito"}
                        </p>
                      </div>

                      {/* Lições */}
                      <div>
                        <p className="text-sm font-medium">Lições</p>
                        <p className="text-sm text-muted-foreground">
                          {course.lessons?.length || 0} lições
                        </p>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="mr-2 h-4 w-4" />
                        Visualizar
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
