import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Instagram, Mail, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import UserMenu from "@/components/UserMenu";
import { toast } from "sonner";

export default function Contact() {
  const { isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Criar mensagem para WhatsApp
    const whatsappMessage = `*Contato via Site*%0A%0A*Nome:* ${formData.name}%0A*Email:* ${formData.email}%0A*Assunto:* ${formData.subject}%0A*Mensagem:*%0A${formData.message}`;
    const whatsappUrl = `https://wa.me/5547991426662?text=${whatsappMessage}`;
    
    window.open(whatsappUrl, "_blank");
    toast.success("Redirecionando para WhatsApp...");
    
    // Limpar formulário
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

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

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-purple-500/5 to-background py-20">
        <div className="container text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Entre em Contato</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Estamos aqui para ajudar você em sua jornada de transformação. Escolha a melhor forma de contato.
          </p>
        </div>
      </section>

      {/* Contato */}
      <section className="container py-20">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Formulário */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Envie uma Mensagem</CardTitle>
                <CardDescription>
                  Preencha o formulário abaixo e entraremos em contato o mais breve possível.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input
                      id="name"
                      placeholder="Seu nome"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Assunto</Label>
                    <Input
                      id="subject"
                      placeholder="Sobre o que você gostaria de falar?"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Mensagem</Label>
                    <Textarea
                      id="message"
                      placeholder="Escreva sua mensagem aqui..."
                      rows={6}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" size="lg">
                    <Send className="h-5 w-5 mr-2" />
                    Enviar Mensagem
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Informações de Contato */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  WhatsApp
                </CardTitle>
                <CardDescription>
                  Fale diretamente com Shadia Hasan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold mb-4">+55 47 99142-6662</p>
                <Button
                  onClick={() => window.open("https://wa.me/5547991426662", "_blank")}
                  className="w-full"
                  size="lg"
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Abrir WhatsApp
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Email
                </CardTitle>
                <CardDescription>
                  Para dúvidas e informações gerais
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg mb-4">contato@shadiahasan.club</p>
                <Button
                  onClick={() => window.location.href = "mailto:contato@shadiahasan.club"}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <Mail className="h-5 w-5 mr-2" />
                  Enviar Email
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Instagram className="h-5 w-5 text-primary" />
                  Instagram
                </CardTitle>
                <CardDescription>
                  Acompanhe conteúdos e novidades
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg mb-4">@shadia_hasan</p>
                <Button
                  onClick={() => window.open("https://www.instagram.com/shadia_hasan", "_blank")}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <Instagram className="h-5 w-5 mr-2" />
                  Seguir no Instagram
                </Button>
              </CardContent>
            </Card>

            {/* Horário de Atendimento */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle>Horário de Atendimento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Segunda a Sexta:</span>
                  <span className="font-medium">9h às 18h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sábado:</span>
                  <span className="font-medium">9h às 13h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Domingo:</span>
                  <span className="font-medium">Fechado</span>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  * Horário de Brasília (GMT-3)
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-12 mt-auto">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2026 Shadia Hasan. Todos os direitos reservados.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/contact">
              <a className="hover:text-primary transition-colors">Contato</a>
            </Link>
            <Link href="/faq">
              <a className="hover:text-primary transition-colors">FAQ</a>
            </Link>
            <Link href="/about">
              <a className="hover:text-primary transition-colors">Sobre</a>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
