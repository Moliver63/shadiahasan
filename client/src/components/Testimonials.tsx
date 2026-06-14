import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

const avatarForName = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7C3AED&color=fff&size=128`;

export default function Testimonials() {
  const { data: testimonials, isLoading } = trpc.testimonials.listApproved.useQuery();

  if (isLoading || !testimonials || testimonials.length === 0) {
    return null;
  }

  return (
    <section className="bg-gradient-to-br from-primary/5 to-purple-500/5 py-20">
      <div className="container">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Depoimentos</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.id}
              className="border-2 transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <CardContent className="p-8">
                <p className="mb-6 italic text-muted-foreground">“{testimonial.text}”</p>
                <div className="flex items-center gap-4">
                  <img
                    src={avatarForName(testimonial.displayName)}
                    alt={testimonial.displayName}
                    className="h-12 w-12 rounded-full"
                  />
                  <div>
                    <div className="font-semibold">{testimonial.displayName}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.courseTitle}</div>
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
