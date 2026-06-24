/**
 * AdminGroups — Lista de cursos com acesso aos agrupamentos
 * Rota: /admin/groups
 */
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Layers, BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function AdminGroups() {
  const { data: courses = [], isLoading } = trpc.courses.list.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Agrupamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione um curso para gerenciar seus agrupamentos de aulas.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (courses as any[]).length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-base font-medium mb-1">Nenhum curso encontrado</p>
              <p className="text-sm text-muted-foreground">Crie um curso primeiro para poder gerenciar agrupamentos.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(courses as any[]).map((course: any) => (
              <Link key={course.id} href={`/admin/courses/${course.id}/groups`}>
                <Card className="cursor-pointer hover:border-primary/50 hover:bg-accent/20 transition-all">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-center gap-4">
                      {course.thumbnailUrl ? (
                        <img
                          src={course.thumbnailUrl}
                          alt={course.title}
                          className="h-12 w-16 rounded object-cover shrink-0 border"
                        />
                      ) : (
                        <div className="h-12 w-16 rounded bg-muted flex items-center justify-center shrink-0 border">
                          <BookOpen className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{course.title}</p>
                        {course.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{course.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Layers className="h-4 w-4" />
                          <span className="text-xs">Agrupamentos</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
