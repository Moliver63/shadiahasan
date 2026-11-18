import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import PrecoPrograma from "./PrecoPrograma";

/**
 * Vitrine da Home no modo "Compra individual": só os Programas à venda
 * (ativos e com preço). Fora desse modo, não aparece.
 */
export default function VitrineProgramas() {
  const { isAuthenticated } = useAuth();
  const { data: comercial } = trpc.comercial.config.useQuery(undefined, { staleTime: 30_000 });
  const { data: programas = [] } = trpc.collections.list.useQuery(undefined, { enabled: !!comercial?.vendaAvulsa, staleTime: 60_000 });
  const { data: meus = [] } = trpc.comercial.meusProgramas.useQuery(undefined, { enabled: isAuthenticated && !!comercial?.vendaAvulsa });
  if (!comercial?.vendaAvulsa) return null;
  const aVenda = (programas as any[]).filter((p) => comercial.programasAVenda.includes(p.id));
  if (aVenda.length === 0) return null;

  return (
    <section id="programas" className="container py-16 md:py-20">
      <div className="max-w-2xl mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Programas</p>
        <h2 className="font-serif text-3xl md:text-4xl font-semibold mt-2">Escolha por onde começar</h2>
        <p className="text-lg text-muted-foreground mt-3">Pagamento único, sem mensalidade. Você assiste no seu ritmo, pelo celular ou computador.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {aVenda.map((p) => (
          <Link key={p.id} href={`/collections/${p.id}`}>
            <article className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg">
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                {p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : null}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <h3 className="font-serif text-xl font-semibold leading-snug">{p.title}</h3>
                {(p.headline || p.description) && <p className="text-sm text-muted-foreground line-clamp-3">{p.headline || p.description}</p>}
                <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                  {meus.includes(p.id)
                    ? <span className="text-sm font-medium text-emerald-700">Você já tem</span>
                    : <PrecoPrograma priceCents={p.priceCents} originalPriceCents={p.originalPriceCents} />}
                  <span className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">{meus.includes(p.id) ? "Assistir" : "Quero começar"}</span>
                </div>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
