import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BookOpen, Download, Eye, Lock } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import UserMenu from "@/components/UserMenu";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";

export default function Ebooks() {
  const { isAuthenticated } = useAuth();
  const { data: ebooks, isLoading } = trpc.ebooks.list.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <img
              src="/logo.png"
              alt="Shadia Hasan"
              className="h-36 cursor-pointer"
            />
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/courses">
              <Button variant="ghost">Programas</Button>
            </Link>
            <Link href="/about">
              <Button variant="ghost">Sobre</Button>
            </Link>
            <Link href="/contact">
              <Button variant="ghost">Contato</Button>
            </Link>
            <Link href="/community/explore">
              <Button variant="ghost">Comunidade</Button>
            </Link>
            {isAuthenticated ? (
              <UserMenu />
            ) : (
              <Button onClick={() => (window.location.href = getLoginUrl())}>
                Entrar
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 text-center">
        <div className="container">
          <Breadcrumbs items={getBreadcrumbs('/ebooks')} />
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full mb-6">
            <BookOpen className="h-5 w-5" />
            <span className="font-medium">Biblioteca Digital</span>
          </div>
          <h1 className="text-5xl font-bold mb-6">
            Ebooks de <span className="text-blue-600">Psicologia</span> e{" "}
            <span className="text-purple-600">Desenvolvimento</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Acesse materiais exclusivos em PDF para aprofundar seus conhecimentos e transformar sua jornada de autoconhecimento.
          </p>
        </div>
      </section>

      {/* Ebooks Grid */}
      <section className="py-12">
        <div className="container">
          {ebooks && ebooks.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ebooks.map((ebook) => (
                <Card key={ebook.id} className="hover:shadow-xl transition-all duration-300">
                  {ebook.thumbnail && (
                    <div className="h-48 overflow-hidden">
                      <img
                        src={ebook.thumbnail}
                        alt={ebook.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      {ebook.title}
                    </CardTitle>
                    {ebook.description && (
                      <CardDescription>{ebook.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      {isAuthenticated ? (
                        <>
                          <Link href={`/ebook/${ebook.id}`} className="flex-1">
                            <Button className="w-full" variant="default">
                              <Eye className="h-4 w-4 mr-2" />
                              Ler Online
                            </Button>
                          </Link>
                          <a href={ebook.fileUrl} download className="flex-1">
                            <Button className="w-full" variant="outline">
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          </a>
                        </>
                      ) : (
                        <a href={getLoginUrl()} className="w-full">
                          <Button className="w-full" variant="default">
                            <Lock className="h-4 w-4 mr-2" />
                            Fazer Login para Acessar
                          </Button>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold text-gray-700 mb-2">
                Nenhum ebook disponível ainda
              </h3>
              <p className="text-gray-500">
                Novos materiais serão adicionados em breve!
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
