import { useState } from "react";
import { Link } from "wouter";
import { Lock, PlayCircle, ShieldCheck, RefreshCcwDot, Clock, Eye } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDuration } from "@/lib/formatDuration";
import TrialPassDialog, { formatBRL } from "@/components/TrialPassDialog";
import { getLoginUrl } from "@/const";

/**
 * Oferta de degustação: 1 aula completa por um valor único (Asaas).
 * A faixa aparece para todos os visitantes. Sem Asaas configurado ou sem aula de entrada, o botão leva
 * para a lista de cursos em vez de abrir a compra, e só administradores veem um aviso do que falta.
 */
export default function TrialOfferSection() {
  const { data: info } = trpc.trial.info.useQuery();
  const { data: entries } = trpc.trial.entryLessons.useQuery();
  const { user, isAuthenticated } = useAuth();
  const [payLessonId, setPayLessonId] = useState<number | null>(null);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  if (!info || !entries) return null;

  const missing: string[] = [];
  if (!info.enabled) missing.push("o Asaas não está configurado (falta ASAAS_API_KEY no servidor)");
  if (entries.length === 0) missing.push("nenhum curso publicado tem aula paga, publicada e com vídeo para ser a aula de entrada");
  // A faixa aparece para todos. O aviso do que falta é só para administradores.
  const showAdminNotice = missing.length > 0 && isAdmin;
  // Só dá para comprar com Asaas configurado e ao menos uma aula de entrada.
  const canBuy = info.enabled && entries.length > 0;

  /** Abre o pagamento da aula; quem ainda não entrou na conta passa antes pelo login. */
  const startPayment = (lessonId: number) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    setPayLessonId(lessonId);
  };
  const scrollToCards = () =>
    document.getElementById("aulas-de-entrada")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const price = formatBRL(info.priceCents);

  return (
    <section
      id="experimente-uma-aula"
      className="relative overflow-hidden text-[#f4ece4]"
      style={{ background: "linear-gradient(135deg, #1d1410 0%, #2b1d16 55%, #3a2619 100%)" }}
    >
      {showAdminNotice && (
        <div className="border-b border-[#d9b27c]/30 bg-[#d9b27c]/15 text-[#f4ece4]">
          <div className="container flex items-start gap-3 py-3 text-sm">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-[#e8c48f]" />
            <p>
              <strong className="font-semibold text-[#e8c48f]">Aviso para administradores.</strong>{" "}
              A compra ainda não funciona para os alunos porque {missing.join(" e ")}. O botão leva para a lista de cursos.
            </p>
          </div>
        </div>
      )}
      <div className="container py-14 md:py-20">
        {/* Oferta */}
        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div className="space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[#d9b27c]">Teste de 1 aula</p>
            <h2 className="font-serif text-3xl leading-tight sm:text-4xl md:text-5xl">
              Experimente uma aula
              <span className="block italic text-[#e8c48f]">antes de decidir</span>
            </h2>
            <p className="max-w-md text-base text-[#d8cabd]">
              Assista a uma aula inteira, no seu ritmo. Se fizer sentido para você, é só assinar para continuar.
            </p>
          </div>

          <div className="space-y-3 lg:border-x lg:border-[#d9b27c]/20 lg:px-8">
            <p className="font-serif text-6xl leading-none text-[#e8c48f] sm:text-7xl">{price}</p>
            <p className="text-sm text-[#d8cabd]">
              Pagamento único. Você assiste em até {info.validDays} dias.
            </p>
            {(() => {
              const cls = "inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#d9b27c] to-[#f0d3a4] px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-[#2b1d16] shadow-lg transition hover:brightness-105 sm:w-auto";
              if (!canBuy) return <Link href="/courses" className={cls}>Quero experimentar</Link>;
              // Com uma única aula de entrada vai direto ao pagamento; com várias, o aluno escolhe o curso.
              const onClick = entries.length === 1 ? () => startPayment(entries[0].lessonId) : scrollToCards;
              return <button type="button" onClick={onClick} className={cls}>Quero experimentar</button>;
            })()}
          </div>

          <ul className="space-y-4 text-sm">
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#d9b27c]" />
              <span>Pagamento seguro por PIX, boleto ou cartão</span>
            </li>
            <li className="flex items-center gap-3">
              <Clock className="h-5 w-5 shrink-0 text-[#d9b27c]" />
              <span>Liberação após a confirmação do pagamento</span>
            </li>
            <li className="flex items-center gap-3">
              <RefreshCcwDot className="h-5 w-5 shrink-0 text-[#d9b27c]" />
              <span>Sem renovação automática</span>
            </li>
          </ul>
        </div>

        {/* Uma aula de entrada por curso */}
        {canBuy && (
        <div id="aulas-de-entrada" className="mt-12 scroll-mt-24">
          <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.3em] text-[#d9b27c]">Escolha por onde começar</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {entries.map((entry) => (
              <button
                type="button"
                key={entry.lessonId}
                onClick={() => startPayment(entry.lessonId)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[#d9b27c]/20 bg-[#1d1410]/60 text-left transition hover:border-[#d9b27c]/60"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#3a2619]">
                  {entry.courseThumbnail ? (
                    <img
                      src={entry.courseThumbnail}
                      alt={entry.courseTitle}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <PlayCircle className="h-10 w-10 text-[#d9b27c]/60" />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#1d1410]/80 px-3 py-1 text-[11px] uppercase tracking-wider text-[#e8c48f]">
                    <Lock className="h-3 w-3" /> {price}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <p className="font-serif text-lg leading-snug">{entry.courseTitle}</p>
                  <p className="line-clamp-2 text-sm text-[#d8cabd]">
                    Aula: {entry.lessonTitle}
                    {entry.duration ? ` (${formatDuration(entry.duration)})` : ""}
                  </p>
                  <span className="mt-3 text-sm font-medium text-[#e8c48f]">Assistir por {price}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        )}
      </div>

      {canBuy && payLessonId !== null && (
        <TrialPassDialog
          open
          onOpenChange={(open) => { if (!open) setPayLessonId(null); }}
          lessonId={payLessonId}
          priceCents={info.priceCents}
          validDays={info.validDays}
        />
      )}
    </section>
  );
}
