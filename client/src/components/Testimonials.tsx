import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export default function Testimonials() {
  const testimonials = [
    {
      name: "Maria Silva",
      role: "Psicologa, Sao Paulo",
      image: "https://ui-avatars.com/api/?name=Maria+Silva&background=7C3AED&color=fff&size=128",
      text: "Consegui superar minha ansiedade social em 3 meses. Hoje me sinto confiante e feliz. Recomendo de olhos fechados!",
      rating: 5,
    },
    {
      name: "Joao Santos",
      role: "Empresario, Rio de Janeiro",
      image: "https://ui-avatars.com/api/?name=Joao+Santos&background=1E3A8A&color=fff&size=128",
      text: "A transformacao que experimentei foi profunda. Aprendi a lidar com o estresse e encontrei equilibrio entre vida pessoal e profissional.",
      rating: 5,
    },
    {
      name: "Ana Costa",
      role: "Professora, Belo Horizonte",
      image: "https://ui-avatars.com/api/?name=Ana+Costa&background=F59E0B&color=fff&size=128",
      text: "Os cursos sao incriveis! Conteudo profundo, didatica excelente e comunidade acolhedora. Mudou minha vida!",
      rating: 5,
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-primary/5 to-purple-500/5">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">O Que Dizem Nossos Alunos</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Historias reais de transformacao e crescimento
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
              <CardContent className="p-8">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 italic">"{testimonial.text}"</p>
                <div className="flex items-center gap-4">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
