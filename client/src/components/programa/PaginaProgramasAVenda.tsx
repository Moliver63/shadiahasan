import { Link } from "wouter";
import PublicHeader from "@/components/PublicHeader";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import VitrineProgramas from "./VitrineProgramas";
import TrialOfferSection from "@/components/TrialOfferSection";
import { CreditCard, Infinity as InfinityIcon, ShieldCheck } from "lucide-react";

/**
 * /pricing no modo "Compra individual": no lugar dos planos, os programas à
 * venda. Quem já assina não perde nada: o plano continua valendo e o link
 * para gerenciar fica aqui.
 */
export default function PaginaProgramasAVenda() {
  const { isAuthenticated } = useAuth();
  const garantias = [
    { icone: CreditCard, titulo: "Pagamento único", texto: "Pix ou cartão. Sem mensalidade e sem renovação automática." },
    { icone: InfinityIcon, titulo: "Acesso vitalício", texto: "O programa comprado fica na sua conta para assistir quando quiser." },
    { icone: ShieldCheck, titulo: "7 dias de garantia", texto: "Se não fizer sentido para você, devolvemos o valor integral." },
  ];
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Programas e preços" description="Programas de autoconhecimento da psicóloga Shadia Hasan, em pagamento único e sem mensalidade." />
      <PublicHeader items={[{ label: "Programas", href: "/courses" }, { label: "Sobre", href: "/about" }, { label: "Contato", href: "/contact" }]} className="bg-card" />

      <section className="border-b bg-gradient-to-b from-primary/[0.06] to-background">
        <div className="container py-12 md:py-16 max-w-3xl text-center space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Preços</p>
          <h1 className="font-serif text-3xl md:text-5xl font-semibold text-balance">Você escolhe o programa e paga uma vez só</h1>
          <p className="text-lg text-muted-foreground text-pretty">Cada programa tem preço próprio. Sem plano, sem mensalidade.</p>
        </div>
      </section>

      <VitrineProgramas />

      <section className="container pb-14">
        <div className="grid gap-4 sm:grid-cols-3">
          {garantias.map(({ icone: I, titulo, texto }) => (
            <div key={titulo} className="rounded-xl border bg-card p-5">
              <I className="h-5 w-5 text-primary" />
              <p className="mt-3 font-medium">{titulo}</p>
              <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
            </div>
          ))}
        </div>
        {isAuthenticated && (
          <p className="mt-6 text-sm text-muted-foreground">
            Já é assinante? Seu plano continua valendo normalmente.{" "}
            <Link href="/my-subscription" className="font-medium text-primary underline">Ver minha assinatura</Link>
          </p>
        )}
      </section>

      <TrialOfferSection />
    </div>
  );
}
