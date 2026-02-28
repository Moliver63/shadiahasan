import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "wouter";

export default function FAQSection() {
  const faqs = [
    {
      question: "O que e a Shadia Hasan Platform?",
      answer: "E uma plataforma completa de psicologia e desenvolvimento humano que oferece cursos online, comunidade exclusiva, lives com especialistas e mentoria personalizada para sua transformacao interior.",
    },
    {
      question: "Como funciona a assinatura?",
      answer: "Oferecemos planos mensais e anuais com acesso ilimitado a todos os cursos, lives e comunidade. Voce pode cancelar quando quiser, sem multas ou taxas adicionais.",
    },
    {
      question: "Os cursos tem certificado?",
      answer: "Sim! Todos os cursos oferecem certificado de conclusao digital apos voce completar 100% do conteudo e atividades propostas.",
    },
    {
      question: "Posso assistir no celular?",
      answer: "Sim! Nossa plataforma e 100% responsiva e funciona perfeitamente em celular, tablet e computador. Voce pode estudar de onde estiver.",
    },
    {
      question: "Tem garantia de reembolso?",
      answer: "Sim! Oferecemos garantia incondicional de 7 dias. Se nao ficar satisfeito, devolvemos 100% do seu investimento, sem perguntas.",
    },
    {
      question: "Como funciona o suporte?",
      answer: "Temos suporte tecnico via email e chat, com resposta em ate 24h uteis. Alem disso, voce tem acesso a comunidade para tirar duvidas sobre o conteudo.",
    },
  ];

  return (
    <section className="py-20">
      <div className="container">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Perguntas Frequentes</h2>
            <p className="text-lg text-muted-foreground">
              Tire suas duvidas sobre a plataforma
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border-2 rounded-lg px-6"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="text-center mt-8">
            <p className="text-muted-foreground mb-4">Nao encontrou sua resposta?</p>
            <Link href="/contact">
              <Button variant="outline">Entre em Contato</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
