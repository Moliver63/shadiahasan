import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Instagram, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import PublicHeader from "@/components/PublicHeader";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "Agendamento de Sessão",
    preferredDate: "",
    preferredTime: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Criar mensagem para WhatsApp
    const whatsappMessage = encodeURIComponent(`*Agendamento de Sessão*\n\n*Nome:* ${formData.name}\n*Email:* ${formData.email}\n*Telefone:* ${formData.phone}\n*Data Preferida:* ${formData.preferredDate}\n*Horário Preferido:* ${formData.preferredTime}\n*Mensagem:*\n${formData.message}`);
    const whatsappUrl = `https://wa.me/5547991426662?text=${whatsappMessage}`;
    
    window.open(whatsappUrl, "_blank");
    toast.success("Redirecionando para WhatsApp...");
    
    // Limpar formulário
    setFormData({ name: "", email: "", phone: "", subject: "Agendamento de Sessão", preferredDate: "", preferredTime: "", message: "" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicHeader
        items={[
          { label: "Programas", href: "/courses" },
          { label: "Sobre", href: "/about" },
          { label: "Contato", href: "/contact" },
          { label: "Comunidade", href: "/community/explore", match: "prefix", authOnly: true },
        ]}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-purple-500/5 to-background py-16 md:py-20">
        <div className="container text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">Entre em Contato</h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
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
                <CardTitle className="text-2xl">Agende sua Sessão</CardTitle>
                <CardDescription>
                  Preencha o formulário abaixo para agendar sua sessão personalizada com Shadia Hasan. Entraremos em contato via WhatsApp para confirmar.
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
                    <Label htmlFor="phone">Telefone/WhatsApp</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="preferredDate">Data Preferida</Label>
                      <Input
                        id="preferredDate"
                        type="date"
                        value={formData.preferredDate}
                        onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preferredTime">Horário Preferido</Label>
                      <Input
                        id="preferredTime"
                        type="time"
                        value={formData.preferredTime}
                        onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                        required
                      />
                    </div>
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

                  <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" size="lg">
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Confirmar Agendamento via WhatsApp
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
                <p className="mb-4 break-all text-xl font-semibold sm:text-2xl">+55 47 99142-6662</p>
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
