/**
 * /autoavaliacao: página de entrada para o anúncio de Pesquisa do Google.
 *
 * A pessoa responde 8 situações, vê o resultado NA HORA (sem pedir e-mail antes) e só então
 * recebe o convite de guardar o resultado por e-mail. A autorização de marketing nunca é
 * condição para ver o resultado: consentimento amarrado a um benefício não é livre (LGPD).
 * Regras do cálculo e textos: shared/autoavaliacao.ts.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import { SEOHead } from "@/components/SEOHead";
import { AutorizacaoEmail } from "@/components/AutorizacaoEmail";
import { trackLead } from "@/components/Analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { atribuicaoAtual } from "@/lib/metaAttribution";
import { trpc } from "@/lib/trpc";
import { AVISO_AUTOAVALIACAO, calcularResultado, ESTILOS, PERFIS, PERGUNTAS, type Estilo } from "@shared/autoavaliacao";

const ROTULO: Record<Estilo, string> = {
  claro: "Falar com clareza",
  evita: "Guardar para si",
  indireto: "Dizer sem dizer",
  forte: "Falar com força",
};

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.trim());
const TOTAL = PERGUNTAS.length;

export default function Autoavaliacao() {
  // -1 = início; 0..TOTAL-1 = perguntas; TOTAL = resultado
  const [passo, setPasso] = useState(-1);
  const [respostas, setRespostas] = useState<(number | null)[]>(() => Array(TOTAL).fill(null));
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
    if (passo >= 0) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [passo]);

  const resultado = passo === TOTAL && respostas.every((r) => r !== null) ? calcularResultado(respostas as number[]) : null;

  const escolher = (indice: number) => {
    setRespostas((r) => r.map((v, i) => (i === passo ? indice : v)));
    window.setTimeout(() => setPasso((p) => Math.min(p + 1, TOTAL)), 240);
  };

  const recomecar = () => {
    setRespostas(Array(TOTAL).fill(null));
    setPasso(-1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title="Autoavaliação: como você se comunica quando o assunto é difícil"
        description="Responda 8 situações do dia a dia e veja seu padrão de comunicação em conflitos. Leva 2 minutos e o resultado aparece na hora."
        keywords="estilo de comunicação, comunicação assertiva, como falar em conflitos, autoavaliação, comunicação emocional"
      />
      <PublicHeader
        items={[
          { label: "Programas", href: "/courses" },
          { label: "Sobre", href: "/about" },
          { label: "Contato", href: "/contact" },
        ]}
      />

      <main className="flex-1 bg-gradient-to-b from-primary/[0.06] to-background">
        <div className="container max-w-2xl py-10 md:py-16">
          {passo === -1 && (
            <section className="space-y-7 text-center">
              <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Clock className="h-4 w-4" />
                2 minutos
              </p>
              <h1 ref={titulo} tabIndex={-1} className="text-3xl font-bold leading-tight tracking-tight outline-none md:text-5xl">
                Como você se comunica quando o assunto é difícil?
              </h1>
              <p className="mx-auto max-w-xl text-lg text-muted-foreground">
                São 8 situações do dia a dia: no trabalho, na família, entre amigos. Você escolhe o que mais se parece com o que você faz de verdade, não com o que gostaria de fazer.
              </p>
              <div>
                <Button size="lg" className="h-12 px-8 text-base" onClick={() => setPasso(0)}>
                  Começar
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
              <ul className="mx-auto flex max-w-md flex-col gap-2 text-left text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />O resultado aparece na hora, sem pedir e-mail antes.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Elaborada pela psicóloga Shadia Hasan.</li>
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Nada é gravado enquanto você responde. Se deixar o e-mail, guardamos só o seu resultado.</li>
              </ul>
            </section>
          )}

          {passo >= 0 && passo < TOTAL && (
            <section aria-labelledby="pergunta" className="space-y-7">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Situação {passo + 1} de {TOTAL}</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded px-1 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-0"
                    disabled={passo === 0}
                    onClick={() => setPasso((p) => Math.max(0, p - 1))}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={passo + 1}>
                  <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((passo + 1) / TOTAL) * 100}%` }} />
                </div>
              </div>

              <h2 id="pergunta" ref={titulo} tabIndex={-1} className="text-2xl font-semibold leading-snug outline-none md:text-3xl">
                {PERGUNTAS[passo].situacao}
              </h2>
              <p className="-mt-3 text-sm text-muted-foreground">O que você mais provavelmente faria?</p>

              <div role="radiogroup" aria-labelledby="pergunta" className="space-y-3">
                {PERGUNTAS[passo].opcoes.map((o, i) => {
                  const marcada = respostas[passo] === i;
                  return (
                    <button
                      key={`${passo}-${i}`}
                      type="button"
                      role="radio"
                      aria-checked={marcada}
                      onClick={() => escolher(i)}
                      className={`w-full rounded-xl border-2 bg-card px-5 py-4 text-left text-base leading-snug transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                        marcada ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      {o.texto}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {resultado && (
            <Resultado
              resultado={resultado}
              respostas={respostas as number[]}
              tituloRef={titulo}
              onRecomecar={recomecar}
            />
          )}
        </div>
      </main>

      <footer className="border-t bg-card py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2026 Shadia Hasan. Todos os direitos reservados.</p>
          <div className="mt-3 flex justify-center gap-6">
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacidade</Link>
            <Link href="/contact" className="hover:text-primary transition-colors">Contato</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Resultado({
  resultado, respostas, tituloRef, onRecomecar,
}: {
  resultado: NonNullable<ReturnType<typeof calcularResultado>>;
  respostas: number[];
  tituloRef: React.RefObject<HTMLHeadingElement | null>;
  onRecomecar: () => void;
}) {
  const perfil = PERFIS[resultado.principal];
  const secundario = resultado.secundario ? PERFIS[resultado.secundario] : null;
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [aceita, setAceita] = useState(false);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);

  const inscrever = trpc.marketing.inscreverAutoavaliacao.useMutation({
    onSuccess: () => {
      setEnviadoPara(email.trim().toLowerCase());
      trackLead("autoavaliacao");
    },
    onError: (e) => toast.error(e.message || "Não foi possível concluir. Tente novamente em instantes."),
  });

  const pronto = emailOk(email) && aceita;
  const enviar = () => {
    if (!pronto || inscrever.isPending) return;
    const a = atribuicaoAtual();
    inscrever.mutate({
      email: email.trim(),
      nome: nome.trim() || undefined,
      aceito: true,
      respostas,
      utmSource: a.utmSource,
      utmCampaign: a.utmCampaign,
      utmTerm: a.utmTerm,
    });
  };

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">Seu resultado</p>
        <h1 ref={tituloRef} tabIndex={-1} className="text-3xl font-bold leading-tight tracking-tight outline-none md:text-4xl">
          {perfil.titulo}
        </h1>
      </div>

      <div className="space-y-4 text-lg leading-relaxed">
        {perfil.texto.map((t, i) => <p key={i}>{t}</p>)}
        {secundario && (
          <p className="text-muted-foreground">
            Em algumas situações, também apareceu outro padrão: <strong className="text-foreground">{secundario.titulo.toLowerCase()}</strong>. Muita gente mistura mais de um jeito, dependendo de quem está na frente.
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <p className="mb-4 text-sm font-medium">Como suas respostas se distribuíram</p>
        <ul className="space-y-3">
          {ESTILOS.map((e) => {
            const n = resultado.contagens[e];
            return (
              <li key={e} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className={e === resultado.principal ? "font-semibold" : "text-muted-foreground"}>{ROTULO[e]}</span>
                  <span className="tabular-nums text-muted-foreground">{n} de {TOTAL}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${e === resultado.principal ? "bg-primary" : "bg-primary/35"}`}
                    style={{ width: `${(n / TOTAL) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border-l-4 border-primary bg-primary/5 p-5">
        <p className="mb-1 text-sm font-semibold text-primary">Um primeiro passo para esta semana</p>
        <p className="text-base leading-relaxed">{perfil.passo}</p>
      </div>

      <p className="text-sm text-muted-foreground">{AVISO_AUTOAVALIACAO}</p>

      {enviadoPara ? (
        <div className="space-y-2 rounded-xl border bg-card p-6 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-primary" />
          <h2 className="text-xl font-semibold">Falta só um passo</h2>
          <p className="text-muted-foreground">
            Enviamos um e-mail para <strong className="[overflow-wrap:anywhere]">{enviadoPara}</strong> com o seu resultado e um link para confirmar a inscrição. Se não encontrar, olhe a caixa de spam.
          </p>
        </div>
      ) : (
        <form
          className="space-y-4 rounded-xl border bg-card p-6"
          onSubmit={(ev) => {
            ev.preventDefault();
            enviar();
          }}
        >
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Receber este resultado por e-mail</h2>
            <p className="text-sm text-muted-foreground">
              Guardamos seu resultado na sua caixa de entrada e, se você quiser, você passa a receber os conteúdos da Shadia sobre comunicação e emoções.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
            <div className="space-y-1.5">
              <Label htmlFor="aaNome">Seu nome (opcional)</Label>
              <Input id="aaNome" autoComplete="given-name" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aaEmail">Seu melhor e-mail</Label>
              <Input id="aaEmail" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <AutorizacaoEmail id="autoavaliacaoNovidades" marcada={aceita} onChange={setAceita} />
          <Button type="submit" disabled={!pronto || inscrever.isPending} className="w-full sm:w-auto">
            {inscrever.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
            Enviar para o meu e-mail
          </Button>
          <p className="text-xs text-muted-foreground">Você confirma a inscrição por um link enviado ao seu e-mail e pode cancelar quando quiser.</p>
        </form>
      )}

      <div className="flex flex-col items-center gap-4 border-t pt-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">Quer aprofundar? Conheça o programa de comunicação da Shadia.</p>
        <div className="flex shrink-0 flex-wrap justify-center gap-3">
          <Button variant="ghost" onClick={onRecomecar}>Refazer</Button>
          <Button asChild variant="outline"><Link href="/courses">Conhecer o programa</Link></Button>
        </div>
      </div>
    </section>
  );
}
