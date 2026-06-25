import { Card, CardContent, CardHeader } from "@/components/ui/card";
import CourseCard from "@/components/CourseCard";
import { trpc } from "@/lib/trpc";
import { BookOpen, Layers } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { Link } from "wouter";
import { formatDuration } from "@/lib/formatDuration";

function CollectionCard({ col }: { col: any }) {
  return (
    <Link href={`/collections/${col.id}`}>
      <div className="course-card group relative cursor-pointer select-none">
        <div className="course-card__media">
          {col.coverUrl ? (
            <img src={col.coverUrl} alt={col.title} className="course-card__img" loading="lazy" />
          ) : (
            <div className="course-card__placeholder">
              <Layers className="h-12 w-12 text-white/40" />
            </div>
          )}
          <div className="course-card__gradient" />
          <div className="course-card__overlay" />
          <div className="course-card__info">
            <h3 className="course-card__title">{col.title}</h3>
            {col.subtitle && <p className="course-card__desc">{col.subtitle}</p>}
            <span className="course-card__meta">
              {col.lessonCount} aulas{col.totalDuration > 0 ? ` · ${formatDuration(col.totalDuration)}` : ""}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Courses() {
  const { data: courses, isLoading: coursesLoading } = trpc.courses.list.useQuery();
  const { data: collections = [], isLoading: collectionsLoading } = trpc.collections.list.useQuery(
    undefined, { staleTime: 0, refetchOnMount: "always" }
  );

  const isLoading = coursesLoading || collectionsLoading;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader
        items={[
          { label: "Programas", href: "/courses" },
          { label: "Sobre", href: "/about" },
          { label: "Contato", href: "/contact" },
          { label: "Comunidade", href: "/community/explore", match: "prefix" },
        ]}
        className="bg-card"
      />

      <section className="bg-gradient-to-br from-primary/10 via-background to-background py-16">
        <div className="container text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Catálogo de Cursos</h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Explore nossos cursos e aprenda com experiências imersivas em realidade virtual
          </p>
        </div>
      </section>

      <section className="container py-12">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader><div className="h-6 w-3/4 bg-muted animate-pulse rounded mb-2" /></CardHeader>
                <CardContent><div className="h-10 w-full bg-muted animate-pulse rounded" /></CardContent>
              </Card>
            ))}
          </div>
        ) : (collections as any[]).length > 0 || (courses && courses.length > 0) ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{paddingBottom:"2rem"}}>
            {/* Coleções ativas primeiro */}
            {(collections as any[]).map((col: any) => (
              <CollectionCard key={`col-${col.id}`} col={col} />
            ))}
            {/* Cursos avulsos */}
            {(courses || []).map((course) => (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.title}
                description={course.description}
                thumbnail={course.thumbnail}
                slug={course.slug}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">Nenhum curso disponível no momento</p>
            </CardContent>
          </Card>
        )}
      </section>

      <footer className="border-t bg-card mt-12">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Shadia VR Platform. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
