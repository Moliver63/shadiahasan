import { Card, CardContent } from "@/components/ui/card";
import { BadgeCheck, ShieldCheck } from "lucide-react";

type ApprovedTestimonial = {
  id: string;
  name: string;
  role: string;
  image: string;
  text: string;
};

export default function Testimonials() {
  // IMPORTANTE: manter vazio até existirem depoimentos reais, autorizados e aprovados no fluxo administrativo.
  const testimonials: ApprovedTestimonial[] = [];

  return (
    <section className="bg-gradient-to-br from-primary/5 to-purple-500/5 py-20">
      <div className="container">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Depoimentos</h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Publicamos apenas relatos reais, com autorização e aprovação administrativa.
          </p>
        </div>

        {testimonials.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card
                key={testimonial.id}
                className="border-2 transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <CardContent className="p-8">
                  <div className="mb-4 flex items-center gap-2 text-primary">
                    <BadgeCheck className="h-5 w-5" />
                    <span className="text-sm font-medium">Depoimento verificado</span>
                  </div>
                  <p className="mb-6 italic text-muted-foreground">“{testimonial.text}”</p>
                  <div className="flex items-center gap-4">
                    <img
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="h-12 w-12 rounded-full object-cover"
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
        ) : (
          <Card className="mx-auto max-w-3xl border-2 border-dashed border-primary/30 bg-background/80 shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center md:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Depoimentos em validação</h3>
                <p className="text-muted-foreground">
                  Os depoimentos anteriores foram removidos por não representarem relatos reais verificados.
                  Novos depoimentos só serão exibidos após autorização da pessoa e aprovação do admin.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
