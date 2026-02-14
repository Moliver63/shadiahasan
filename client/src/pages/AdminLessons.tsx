import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { PlayCircle, Edit, Trash2, Plus } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function AdminLessons() {
  const { data: courses, isLoading } = trpc.courses.listAll.useQuery();

  const handleDeleteLesson = (lessonId: number) => {
    toast.info("Funcionalidade em desenvolvimento");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Todas as Aulas</h1>
            <p className="text-muted-foreground mt-2">
              Visualização global de todas as aulas cadastradas
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Aulas por Programa</CardTitle>
            <CardDescription>
              Selecione um programa para gerenciar suas aulas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando programas...
              </div>
            ) : courses && courses.length > 0 ? (
              <div className="grid gap-4">
                {courses.map((course) => (
                  <Card key={course.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{course.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {course.description || "Sem descrição"}
                          </p>
                        </div>
                        <Link href={`/admin/courses/${course.id}/lessons`}>
                          <Button>
                            <Edit className="mr-2 h-4 w-4" />
                            Gerenciar Aulas
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  Nenhum programa cadastrado ainda
                </p>
                <Link href="/admin/courses">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Primeiro Programa
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
