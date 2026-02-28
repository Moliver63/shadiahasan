import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Award, BookOpen, Heart, Sparkles, Target, Users } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import UserMenu from "@/components/UserMenu";

export default function About() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 backdrop-blur">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/">
            <img 
              src="/logo.png" 
              alt="Shadia Hasan" 
              className="h-36 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/courses">
              <Button variant="ghost">Programas</Button>
            </Link>
            <Link href="/about">
              <Button variant="ghost" className="text-primary">Sobre</Button>
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
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-purple-500/5 to-background py-20">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl font-bold">
                Sobre Shadia Hasan
              </h1>
              <p className="text-xl text-muted-foreground">
                Estou aqui para caminhar ao seu lado. Com escuta genuína e apoio individual, vamos juntos descobrir seu verdadeiro potencial.
              </p>
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
        </div>
      </section>

      {/* Biografia */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-3xl font-bold text-center mb-12">Minha Jornada</h2>
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Psicóloga Registrada - CRP 12/27052</span>
            </div>
          </div>
          
          <div className="prose prose-lg max-w-none text-muted-foreground">
            <p>
              Sei como é desafiador buscar mudança. Por isso, ofereço apoio individual e personalizado para que você se sinta acolhido em cada passo dessa jornada. Juntos, vamos construir um caminho de transformação que respeita quem você é.
            </p>
            
            <p>
              Minha abordagem une tecnologia imersiva e escuta empática. Cada pessoa é única, e sua jornada merece atenção dedicada. Estou aqui para entender suas dores, celebrar suas conquistas e caminhar ao seu lado.
            </p>
            
            <p>
              Acredito que você já tem as respostas dentro de si. Meu papel é criar um espaço seguro e acolhedor onde você possa se descobrir, sem pressão ou julgamento. Vamos juntos?
            </p>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="bg-muted/30 py-20">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-12">Valores e Abordagem</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Empatia Genuína</h3>
                <p className="text-muted-foreground">
                  Você será ouvido de verdade. Um espaço onde suas emoções são validadas e respeitadas.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Apoio Individual</h3>
                <p className="text-muted-foreground">
                  Atenção personalizada para suas necessidades. Cada sessão é pensada especialmente para você.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Inovação e Tecnologia</h3>
                <p className="text-muted-foreground">
                  Pioneirismo no uso de realidade virtual para criar experiências imersivas que potencializam seu crescimento.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Excelência</h3>
                <p className="text-muted-foreground">
                  Compromisso com a qualidade em cada detalhe, desde o conteúdo até a experiência do aluno.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Comunidade</h3>
                <p className="text-muted-foreground">
                  Acreditamos no poder da conexão humana e criamos espaços para troca e apoio mútuo.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Aprendizado Contínuo</h3>
                <p className="text-muted-foreground">
                  A evolução é um caminho sem fim. Estamos sempre buscando novas formas de servir melhor.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Público-Alvo */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Para Quem São os Programas</h2>
          <p className="text-lg text-muted-foreground text-center mb-12">
            Os programas de transformação são ideais para pessoas que buscam:
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-2">
              <CardContent className="pt-6">
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">✓</span>
                    <span>Desenvolver inteligência emocional e autoconhecimento profundo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">✓</span>
                    <span>Superar padrões limitantes e crenças que bloqueiam seu potencial</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">✓</span>
                    <span>Encontrar propósito e direção clara para suas vidas</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6">
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">✓</span>
                    <span>Construir relacionamentos mais saudáveis e autênticos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">✓</span>
                    <span>Expandir consciência e viver com mais presença e plenitude</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">✓</span>
                    <span>Experimentar crescimento através de tecnologia imersiva</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-primary/10 to-purple-500/10 py-20">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Pronto para Iniciar Sua Jornada?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Explore os programas disponíveis e dê o primeiro passo em direção à sua transformação interior.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/courses">
              <Button size="lg" className="text-lg px-8">
                <BookOpen className="h-5 w-5 mr-2" />
                Ver Programas
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Conhecer Planos
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-12">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2026 Shadia Hasan. Todos os direitos reservados.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/contact">
              <a className="hover:text-primary transition-colors">Contato</a>
            </Link>
            <Link href="/faq">
              <a className="hover:text-primary transition-colors">FAQ</a>
            </Link>
            <a
              href="https://www.instagram.com/shadia_hasan"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              Instagram
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
