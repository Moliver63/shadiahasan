import { Card, CardContent, CardHeader } from "@/components/ui/card";
import CourseCard from "@/components/CourseCard";
import { trpc } from "@/lib/trpc";
import { BookOpen, Layers, LayoutGrid } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { Link } from "wouter";
import { formatDuration } from "@/lib/formatDuration";
import { useState } from "react";

type Filter = "all" | "collections" | "courses";

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
          <div className="course-card__play">
            <div className="course-card__play-btn">
              <Layers className="h-5 w-5 text-white" />
            </div>
          </div>
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

const FILTERS: { key: Filter; label: string; icon: React.ElementType }[] = [
  { key: "all",         label: "Tudo",     icon: LayoutGrid },
  { key: "collections", label: "Programas", icon: Layers    },
  { key: "courses",     label: "Cursos",    icon: BookOpen  },
];

export default function Courses() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: courses, isLoading: coursesLoading } = trpc.courses.list.useQuery();
  const { data: collections = [], isLoading: collectionsLoading } = trpc.collections.list.useQuery(
    undefined, { staleTime: 0, refetchOnMount: "always" }
  );

  const isLoading = coursesLoading || collectionsLoading;

  const showCollections = filter === "all" || filter === "collections";
  const showCourses     = filter === "all" || filter === "courses";

  const visibleCollections = showCollections ? (collections as any[]) : [];
  const visibleCourses     = showCourses     ? (courses || [])        : [];
  const hasContent         = visibleCollections.length > 0 || visibleCourses.length > 0;

  const collectionCount = (collections as any[]).length;
  const courseCount     = (courses || []).length;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader
        items={[
          { label: "Programas", href: "/courses" },
          { label: "Sobre",     href: "/about"   },
          { label: "Contato",   href: "/contact" },
          { label: "Comunidade", href: "/community/explore", match: "prefix" },
        ]}
        className="bg-card"
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-background py-16">
        <div className="container text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Catálogo de Cursos
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Explore nossos cursos e aprenda com experiências imersivas em realidade virtual
          </p>
        </div>
      </section>

      <section className="container py-8">
        {/* Filtros */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {FILTERS.map(({ key, label, icon: Icon }) => {
            const count = key === "collections" ? collectionCount : key === "courses" ? courseCount : collectionCount + courseCount;
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {!isLoading && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-muted"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <div className="aspect-video bg-muted animate-pulse rounded-xl" />
              </Card>
            ))}
          </div>
        ) : hasContent ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ paddingBottom: "2rem" }}>
            {visibleCollections.map((col: any) => (
              <CollectionCard key={`col-${col.id}`} col={col} />
            ))}
            {visibleCourses.map((course) => (
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
            <CardContent className="py-16 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
              <p className="text-lg text-muted-foreground">
                {filter === "collections" ? "Nenhum programa disponível." :
                 filter === "courses"     ? "Nenhum curso disponível."    :
                 "Nenhum conteúdo disponível no momento."}
              </p>
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
