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
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/KQbMXrKxSjIsEkev.png" 
              alt="Shadia Hasan" 
              className="h-36 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/courses">
              <Button variant="ghost">Cursos</Button>
            </Link>
            <Link href="/pricing">
              <Button variant="ghost">Planos</Button>
            </Link>
            <Link href="/about">
              <Button variant="ghost">Sobre</Button>
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
                Mentora de transformação e desenvolvimento humano, dedicada a guiar pessoas na descoberta do seu verdadeiro potencial.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/TSJtZyGnSUDcAEsl.PNG"
                alt="Shadia Hasan"
                className="rounded-lg shadow-lg w-full h-full object-cover"
              />
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/EKLuDwrTzWRoEyQr.PNG"
                alt="Shadia Hasan"
                className="rounded-lg shadow-lg w-full h-full object-cover mt-8"
              />
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
              Com anos de experiência em desenvolvimento humano e transformação pessoal, Shadia Hasan dedica sua vida a ajudar pessoas a descobrirem seu potencial máximo e construírem uma vida com mais propósito, plenitude e autenticidade.
            </p>
            
            <p>
              Sua abordagem única combina sabedoria ancestral com tecnologia de vanguarda, criando experiências imersivas que potencializam a evolução consciente. Através da realidade virtual e metodologias estruturadas, Shadia desenvolveu um caminho transformador que já impactou centenas de vidas.
            </p>
            
            <p>
              Especialista em inteligência emocional, autoconhecimento e crescimento interior, ela acredita que cada pessoa carrega dentro de si as respostas que procura. Seu papel como mentora é facilitar essa descoberta, oferecendo ferramentas, técnicas e um espaço seguro para a expansão pessoal.
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
                <h3 className="text-xl font-semibold">Empatia e Acolhimento</h3>
                <p className="text-muted-foreground">
                  Cada jornada é única. Oferecemos um espaço seguro, livre de julgamentos, onde você pode ser autêntico e vulnerável.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Foco em Resultados</h3>
                <p className="text-muted-foreground">
                  Metodologias estruturadas e práticas comprovadas para gerar transformações reais e duradouras em sua vida.
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
