import { Card, CardContent, CardHeader } from "@/components/ui/card";
import CourseCard from "@/components/CourseCard";
import { trpc } from "@/lib/trpc";
import { BookOpen } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";

export default function Courses() {
  const { data: courses, isLoading } = trpc.courses.list.useQuery();

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

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-background py-16">
        <div className="container text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Catálogo de Cursos
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Explore nossos cursos e aprenda com experiências imersivas em
            realidade virtual
          </p>
        </div>
      </section>

      {/* Courses Grid */}
      <section className="container py-12">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-6 w-3/4 bg-muted animate-pulse rounded mb-2"></div>
                  <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-10 w-full bg-muted animate-pulse rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : courses && courses.length > 0 ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{paddingBottom:"2rem"}}>
            {courses.map((course) => (
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
              <p className="text-lg text-muted-foreground">
                Nenhum curso disponível no momento
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t bg-card mt-12">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Shadia VR Platform. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
