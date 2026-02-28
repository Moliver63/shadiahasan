import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Glasses, PlayCircle, Users, Zap, Shield } from "lucide-react";
import { Link } from "wouter";
import { OptimizedImage } from "@/components/OptimizedImage";
import { SEOHead } from "@/components/SEOHead";
import { getSEOMetaTags } from "@/lib/seo-meta-tags";

import UserMenu from "@/components/UserMenu";
import AIChatWidget from "@/components/AIChatWidget";

import StatsSection from "@/components/StatsSection";
import HowItWorks from "@/components/HowItWorks";
import Testimonials from "@/components/Testimonials";
import FAQSection from "@/components/FAQSection";

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const seoMeta = getSEOMetaTags('/');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead {...seoMeta} />
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 backdrop-blur">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/">
            <img 
              src="/logo.png" 
              alt="Shadia Hasan - Psicologia & Desenvolvimento Humano" 
              className="h-36 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/courses">
              <span className="cursor-pointer">
                <Button variant="ghost">Programas</Button>
              </span>
            </Link>
            <Link href="/about">
              <span className="cursor-pointer">
                <Button variant="ghost">Sobre</Button>
              </span>
            </Link>
            <Link href="/contact">
              <span className="cursor-pointer">
                <Button variant="ghost">Contato</Button>
              </span>
            </Link>
            {isAuthenticated && (
              <Link href="/community/explore">
                <span className="cursor-pointer">
                  <Button variant="ghost">
                    <Users className="mr-2 h-4 w-4" />
                    Comunidade
                  </Button>
                </span>
              </Link>
            )}
            {isAuthenticated ? (
              <>
                {user?.role === 'admin' && (
                  <Link href="/admin">
                    <span className="cursor-pointer">
                      <Button variant="outline">Admin</Button>
                    </span>
                  </Link>
                )}
                <UserMenu />
              </>
            ) : (
              <Link href="/login">
                <Button>
                  Entrar
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-purple-500/5 to-background py-20 md:py-32">
        <div className="container relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium">
              <Glasses className="h-4 w-4" />
              <span>Experiência em Realidade Virtual</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Jornada de
              <span className="block bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Transformação Interior
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Apoio individual para sua evolução pessoal. Juntos, vamos despertar seu potencial através de experiências imersivas que transformam.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="text-lg px-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  <Zap className="h-5 w-5 mr-2" />
                  Agende sua Sessão
                </Button>
              </Link>
              <Link href="/courses">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  <PlayCircle className="h-5 w-5 mr-2" />
                  Iniciar Jornada
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
        </div>
      </section>

      <StatsSection />

      {/* About Section */}
      <section className="container py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium">
              <span>Sobre</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">
              Shadia Hasan
            </h2>
            <p className="text-lg text-muted-foreground">
              Estou aqui para caminhar ao seu lado. Com empatia e escuta genuína, ofereço apoio individual para que você descubra seu verdadeiro potencial e construa uma vida com mais propósito.
            </p>
            <p className="text-lg text-muted-foreground">
              Cada pessoa é única, e sua jornada merece atenção personalizada. Juntos, vamos criar um caminho de transformação que respeita seu ritmo e suas necessidades.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/shadia_hasan"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:opacity-90 transition-opacity"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                Siga no Instagram
              </a>
            </div>
          </div>
          <div className="flex justify-center">
            <picture>
              <source srcSet="https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/YAsEYvxqebPXZBIO.avif" type="image/avif" />
              <source srcSet="https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/bOfXnFYBniKdijZM.webp" type="image/webp" />
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/xzKfSOAtqexRDupD.jpeg"
                alt="Shadia Hasan - Mentora de Transformação e Desenvolvimento Humano"
                className="rounded-2xl shadow-2xl w-full max-w-md object-cover"
                loading="lazy"
              />
            </picture>
          </div>
        </div>
      </section>

      <HowItWorks />

      {/* Features Section */}
      <section className="container py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Uma Jornada Estruturada de Transformação
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Apoio personalizado que respeita seu ritmo e suas necessidades individuais
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="pt-6 space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Glasses className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Imersão em Realidade Virtual</h3>
              <p className="text-muted-foreground">
                Viva experiências imersivas em 360° com Meta Quest. Um espaço seguro para sua expansão emocional e autoconhecimento.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="pt-6 space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <PlayCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Conteúdo Cuidadosamente Criado</h3>
              <p className="text-muted-foreground">
                Programas pensados especialmente para você. Cada etapa foi desenhada com carinho para apoiar sua evolução.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="pt-6 space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">No Seu Ritmo</h3>
              <p className="text-muted-foreground">
                Respeito total pelo seu tempo. Você avança quando se sentir pronto, sem pressão ou julgamento.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="pt-6 space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Acompanhamento Individual</h3>
              <p className="text-muted-foreground">
                Estou aqui para você. Apoio personalizado que entende suas dores e celebra suas conquistas.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="pt-6 space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Espaço Acolhedor</h3>
              <p className="text-muted-foreground">
                Um lugar seguro onde você pode ser você mesmo, sem máscaras. Confidencialidade e respeito absolutos.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardContent className="pt-6 space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Programas Estruturados</h3>
              <p className="text-muted-foreground">
                Caminhos claros e organizados para sua transformação. Você nunca estará sozinho nessa jornada.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Testimonials />

      <FAQSection />

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-primary/10 to-purple-500/10 py-20">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Vamos começar juntos?
            </h2>
            <p className="text-lg text-muted-foreground">
              Estou aqui para apoiar sua transformação. Dê o primeiro passo hoje.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/courses">
                <Button size="lg" className="text-lg px-8">
                  Ver Cursos Disponíveis
                </Button>
              </Link>
              {!isAuthenticated && (
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8"
                  onClick={() => (window.location.href = '/signup')}
                >
                  Criar Conta Gratuita
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="container py-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Shadia Hasan</h3>
              <p className="text-sm text-muted-foreground">
                Psicologia e Desenvolvimento Humano com experiências imersivas em realidade virtual.
                Transformando vidas através do autoconhecimento.
              </p>
              <p className="text-sm text-muted-foreground mt-3 font-medium">
                CRP 12/27052
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Links Rápidos</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/courses" className="hover:text-primary transition-colors">
                    Cursos
                  </Link>
                </li>
                <li>
                  <Link href="/my-courses" className="hover:text-primary transition-colors">
                    Meus Cursos
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Sobre</h4>
              <p className="text-sm text-muted-foreground">
                Desenvolvido com tecnologias modernas para proporcionar a melhor
                experiência educacional em VR.
              </p>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p className="mb-3">© {new Date().getFullYear()} Shadia Hasan. Todos os direitos reservados.</p>
            <div className="flex justify-center gap-4">
              <Link href="/terms" className="hover:text-primary transition-colors">
                Termos de Uso
              </Link>
              <span>•</span>
              <Link href="/privacy" className="hover:text-primary transition-colors">
                Política de Privacidade
              </Link>
            </div>
          </div>
        </div>
      </footer>
      
      {/* AI Chat Widget */}
      <AIChatWidget />
      

    </div>
  );
}
