import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import UserMenu from "@/components/UserMenu";

export default function FAQ() {
  const { isAuthenticated } = useAuth();

  const faqs = [
    {
      category: "Planos e Pagamentos",
      questions: [
        {
          q: "Quais são os planos disponíveis?",
          a: "Oferecemos 4 planos: Gratuito (acesso limitado), Básico (R$ 49,90/mês), Premium (R$ 99,90/mês - mais popular) e VIP (R$ 299,90/mês com mentoria individual). Cada plano oferece diferentes níveis de acesso aos programas e recursos exclusivos."
        },
        {
          q: "Posso cancelar minha assinatura a qualquer momento?",
          a: "Sim! Você pode cancelar sua assinatura a qualquer momento através da área 'Minha Conta'. O cancelamento é imediato e você manterá acesso até o final do período já pago."
        },
        {
          q: "Qual é a política de reembolso?",
          a: "Oferecemos garantia de 7 dias. Se você não ficar satisfeito com o programa, pode solicitar reembolso total dentro deste período. Após 7 dias, não realizamos reembolsos, mas você pode cancelar a qualquer momento para evitar cobranças futuras."
        },
        {
          q: "Quais formas de pagamento são aceitas?",
          a: "Aceitamos cartões de crédito (Visa, Mastercard, American Express) e PIX através da plataforma Stripe. Os pagamentos são processados de forma segura e criptografada."
        },
      ]
    },
    {
      category: "Realidade Virtual (VR)",
      questions: [
        {
          q: "Preciso ter óculos de realidade virtual?",
          a: "Não é obrigatório! Todos os programas podem ser acessados normalmente pelo computador ou celular. Os óculos VR (Meta Quest) são opcionais e proporcionam uma experiência imersiva adicional."
        },
        {
          q: "Quais dispositivos VR são compatíveis?",
          a: "Nossa plataforma é compatível com Meta Quest (Quest 2, Quest 3, Quest Pro) através do navegador nativo. Também funciona em qualquer dispositivo com suporte a WebXR."
        },
        {
          q: "Como funciona a experiência em VR?",
          a: "Ao acessar pelo Meta Quest, você entra em ambientes imersivos 360° onde pode visualizar os vídeos e conteúdos em um espaço tridimensional. É como estar fisicamente presente em um ambiente de aprendizado."
        },
        {
          q: "A qualidade do vídeo em VR é boa?",
          a: "Sim! Utilizamos streaming adaptativo de alta qualidade (HLS) que ajusta automaticamente a resolução baseado na sua conexão de internet, garantindo a melhor experiência possível."
        },
      ]
    },
    {
      category: "Cursos e Conteúdo",
      questions: [
        {
          q: "Como funcionam os programas?",
          a: "Cada programa é estruturado em módulos e aulas sequenciais. Você avança no seu próprio ritmo, com acesso a vídeos, ebooks, exercícios práticos e materiais complementares."
        },
        {
          q: "Os programas têm certificado?",
          a: "Sim! Ao concluir 100% de um programa, você recebe automaticamente um certificado digital de conclusão que pode ser baixado e compartilhado."
        },
        {
          q: "Posso assistir as aulas quantas vezes quiser?",
          a: "Sim! Enquanto sua assinatura estiver ativa, você tem acesso ilimitado a todos os programas do seu plano e pode revisitar as aulas sempre que desejar."
        },
        {
          q: "Novos programas são adicionados?",
          a: "Sim! Estamos constantemente criando novos programas e atualizando os existentes. Assinantes recebem acesso automático a todos os novos conteúdos sem custo adicional."
        },
        {
          q: "Posso baixar as aulas para assistir offline?",
          a: "Atualmente as aulas são apenas para visualização online (streaming). Porém, os ebooks e materiais complementares podem ser baixados em PDF."
        },
      ]
    },
    {
      category: "Suporte e Dúvidas",
      questions: [
        {
          q: "Como entro em contato com o suporte?",
          a: "Você pode entrar em contato através do WhatsApp (+55 47 99142-6662), email (contato@shadiahasan.club) ou pelo formulário na página de Contato. Respondemos em até 24 horas úteis."
        },
        {
          q: "Há alguma comunidade ou grupo de alunos?",
          a: "Sim! Assinantes dos planos Premium e VIP têm acesso a uma comunidade exclusiva onde podem trocar experiências, fazer perguntas e receber suporte adicional."
        },
        {
          q: "Posso sugerir temas para novos programas?",
          a: "Com certeza! Adoramos ouvir nossos alunos. Envie suas sugestões através do WhatsApp ou email e elas serão consideradas para futuros programas."
        },
      ]
    },
    {
      category: "Técnico",
      questions: [
        {
          q: "Quais navegadores são compatíveis?",
          a: "A plataforma funciona em todos os navegadores modernos: Chrome, Firefox, Safari, Edge. Para VR, recomendamos o navegador nativo do Meta Quest."
        },
        {
          q: "Qual velocidade de internet é necessária?",
          a: "Recomendamos no mínimo 5 Mbps para streaming em qualidade padrão e 10 Mbps ou mais para HD. Para VR, idealmente 20 Mbps para melhor experiência."
        },
        {
          q: "Meus dados estão seguros?",
          a: "Sim! Utilizamos criptografia SSL/TLS em todas as conexões, armazenamento seguro e cumprimos rigorosamente a LGPD (Lei Geral de Proteção de Dados)."
        },
      ]
    },
  ];

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
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-6">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Perguntas Frequentes</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Encontre respostas para as dúvidas mais comuns sobre nossos programas, planos e tecnologia VR.
          </p>
        </div>
      </section>

      {/* FAQs */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto space-y-12">
          {faqs.map((category, idx) => (
            <div key={idx}>
              <h2 className="text-2xl font-bold mb-6">{category.category}</h2>
              <Accordion type="single" collapsible className="space-y-4">
                {category.questions.map((faq, qIdx) => (
                  <AccordionItem 
                    key={qIdx} 
                    value={`${idx}-${qIdx}`}
                    className="border rounded-lg px-6 bg-card"
                  >
                    <AccordionTrigger className="text-left hover:no-underline">
                      <span className="font-semibold">{faq.q}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/30 py-20">
        <div className="container">
          <Card className="max-w-3xl mx-auto text-center">
            <CardContent className="pt-12 pb-12">
              <MessageCircle className="h-12 w-12 text-primary mx-auto mb-6" />
              <h2 className="text-3xl font-bold mb-4">Ainda tem dúvidas?</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Nossa equipe está pronta para ajudar você. Entre em contato através do WhatsApp ou email.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => window.open("https://wa.me/5547991426662", "_blank")}
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  WhatsApp
                </Button>
                <Link href="/contact">
                  <Button size="lg" variant="outline">
                    Página de Contato
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
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
