import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Glasses, Award, TrendingUp } from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Cadastre-se Gratuitamente",
      description: "Crie sua conta em menos de 1 minuto e comece sua jornada de transformacao.",
      icon: CheckCircle2,
    },
    {
      number: "02",
      title: "Escolha Sua Trilha",
      description: "Descubra qual programa se alinha melhor com seus objetivos e necessidades.",
      icon: Glasses,
    },
    {
      number: "03",
      title: "Acesse Conteudo Premium",
      description: "Mergulhe em cursos, lives exclusivas e material de apoio de alta qualidade.",
      icon: Award,
    },
    {
      number: "04",
      title: "Transforme Sua Vida",
      description: "Aplique o conhecimento e veja resultados reais na sua vida pessoal e profissional.",
      icon: TrendingUp,
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 to-background">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Como Funciona</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Sua transformacao comeca aqui, em 4 passos simples
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <Card key={index} className="relative border-2 hover:border-primary/50 transition-all hover:shadow-lg">
              <CardContent className="p-6">
                <div className="text-6xl font-bold text-primary/10 mb-4">{step.number}</div>
                <step.icon className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
