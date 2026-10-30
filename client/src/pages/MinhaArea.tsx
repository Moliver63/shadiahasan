/**
 * Minha Área — painel do aluno: o que ele comprou, o que pode assistir e por onde continuar.
 * Dados: trpc.areaAluno.resumo (server/areaAluno.ts).
 */
import { useAuth } from "@/_core/hooks/useAuth";
import PublicHeader from "@/components/PublicHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  Award, BookOpen, CheckCircle2, Clock, CreditCard, ExternalLink, MessageSquareQuote, PlayCircle, Receipt, Sparkles,
} from "lucide-react";
import { Link } from "wouter";

const brl = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
const dataYmd = (s: string | null | undefined) => (s ? s.split("-").reverse().join("/") : "");

const STATUS_COMPRA: Record<string, { rotulo: string; classe: string }> = {
  pago: { rotulo: "Pago", classe: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  aguardando: { rotulo: "Aguardando pagamento", classe: "bg-amber-100 text-amber-800 border-amber-200" },
  vencido: { rotulo: "Vencido", classe: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  estornado: { rotulo: "Estornado", classe: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  falhou: { rotulo: "Não aprovado", classe: "bg-red-100 text-red-700 border-red-200" },
};

const STATUS_TESTE: Record<string, string> = {
  ativo: "Liberada",
  aguardando: "Aguardando pagamento",
  vencido: "Cobrança vencida",
  expirado: "Acesso encerrado",
  cancelado: "Cancelada",
};

export default function MinhaArea() {
  const { user, isAuthenticated, loading } = useAuth();
  const { data: area, isLoading, error } = trpc.areaAluno.resumo.useQuery(undefined, { enabled: isAuthenticated });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  const primeiroNome = (user?.name || "").split(" ")[0];
  const continuar = area?.cursos.find((c) => c.proximaAulaId && c.progresso < 100) ?? area?.cursos.find((c) => c.proximaAulaId);
  const testesVisiveis = (area?.testes ?? []).filter((t) => t.status !== "cancelado");
  const temAcesso = !!area?.plano || testesVisiveis.some((t) => t.status === "ativo") || (area?.cursos.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader
        items={[
          { label: "Minha Área", href: "/minha-area" },
          { label: "Catálogo", href: "/courses", match: "prefix" },
        ]}
        className="bg-card"
      />

      <main className="container max-w-5xl space-y-8 py-8 md:py-12">
        <header>
          <h1 className="text-3xl font-bold sm:text-4xl">Minha Área</h1>
          <p className="mt-1 text-lg text-muted-foreground">
            {primeiroNome ? `Olá, ${primeiroNome}! ` : ""}Aqui ficam seus cursos, seu acesso e suas compras.
          </p>
        </header>

        {error && (
          <Card className="border-red-200">
            <CardContent className="py-6 text-sm text-red-700">
              Não foi possível carregar sua área agora. Recarregue a página em instantes.
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}
          </div>
        )}

        {area && (
          <>
            {/* Cobrança em aberto */}
            {area.pendencia && (
              <Card className="border-amber-300 bg-amber-50">
                <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    <div>
                      <p className="font-semibold text-amber-900">
                        {area.pendencia.descricao}: {brl(area.pendencia.valorCentavos)} aguardando pagamento
                      </p>
                      <p className="text-sm text-amber-800">
                        O acesso é liberado automaticamente assim que o pagamento é confirmado (Pix leva poucos minutos).
                        {area.pendencia.vencimento ? ` Vence em ${dataYmd(area.pendencia.vencimento)}.` : ""}
                      </p>
                    </div>
                  </div>
                  <Button asChild className="shrink-0">
                    <a href={area.pendencia.linkPagamento} target="_blank" rel="noopener noreferrer">
                      Pagar agora <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Continuar de onde parou */}
            {continuar?.proximaAulaId && (
              <Card className="overflow-hidden border-primary/30">
                <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-primary">Continue de onde parou</p>
                    <p className="mt-1 text-xl font-semibold">{continuar.titulo}</p>
                    {continuar.proximaAulaTitulo && <p className="text-muted-foreground">Próxima aula: {continuar.proximaAulaTitulo}</p>}
                  </div>
                  <Button asChild size="lg" className="shrink-0">
                    <Link href={`/lesson/${continuar.proximaAulaId}`}>
                      <PlayCircle className="mr-2 h-5 w-5" /> Assistir
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Meu acesso */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Sparkles className="h-5 w-5 text-primary" /> Meu acesso</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {area.plano ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-lg">
                        Plano {area.plano.nome}
                        <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800" variant="outline">Ativo</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      {area.plano.todosOsCursos ? (
                        <p>Todos os cursos estão liberados para você.</p>
                      ) : (
                        <>
                          <p>
                            Seu plano inclui até {area.plano.limiteCursos} cursos. Você está usando{" "}
                            <strong className="text-foreground">{Math.min(area.plano.cursosUsados, area.plano.limiteCursos ?? 0)} de {area.plano.limiteCursos}</strong>.
                          </p>
                          {area.plano.cursosUsados >= (area.plano.limiteCursos ?? 0) && (
                            <p>Para fazer outros cursos, conheça o plano Premium, com todos os cursos liberados.</p>
                          )}
                        </>
                      )}
                      {area.plano.desde && <p>Assinante desde {data(area.plano.desde)}.</p>}
                      {area.plano.ate && <p>Acesso garantido até {data(area.plano.ate)}.</p>}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button asChild variant="outline" size="sm"><Link href="/courses">{area.plano.todosOsCursos ? "Ver todos os cursos" : "Ver catálogo"}</Link></Button>
                        <Button asChild variant="ghost" size="sm"><Link href="/my-subscription">Gerenciar assinatura</Link></Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-lg">Sem plano ativo</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                      <p>Com um plano você assiste aos cursos completos, no seu ritmo.</p>
                      <Button asChild size="sm"><Link href="/pricing">Conhecer os planos</Link></Button>
                    </CardContent>
                  </Card>
                )}

                {testesVisiveis.map((t) => (
                  <Card key={t.aulaId}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between gap-2 text-lg">
                        Teste de 1 aula
                        <Badge
                          variant="outline"
                          className={t.status === "ativo" ? "border-emerald-200 bg-emerald-100 text-emerald-800" : t.status === "aguardando" ? "border-amber-200 bg-amber-100 text-amber-800" : "border-zinc-200 bg-zinc-100 text-zinc-600"}
                        >
                          {STATUS_TESTE[t.status]}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{t.aulaTitulo}</p>
                      <p>{t.cursoTitulo}</p>
                      {t.status === "ativo" && t.expiraEm && <p>Disponível até {data(t.expiraEm)}.</p>}
                      {t.status === "expirado" && <p>Gostou? Assine um plano para continuar o curso.</p>}
                      {t.status === "vencido" && <p>Essa cobrança venceu. Você pode gerar outra na página do curso.</p>}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {t.status === "ativo" && (
                          <Button asChild size="sm"><Link href={`/lesson/${t.aulaId}`}><PlayCircle className="mr-2 h-4 w-4" /> Assistir à aula</Link></Button>
                        )}
                        {t.status === "aguardando" && t.linkPagamento && (
                          <Button asChild size="sm"><a href={t.linkPagamento} target="_blank" rel="noopener noreferrer">Pagar agora</a></Button>
                        )}
                        {(t.status === "expirado" || t.status === "vencido") && (
                          <Button asChild size="sm" variant="outline">
                            <Link href={t.status === "expirado" ? "/pricing" : t.cursoSlug ? `/courses/${t.cursoSlug}` : "/courses"}>
                              {t.status === "expirado" ? "Ver planos" : "Ir para o curso"}
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Meus cursos */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><BookOpen className="h-5 w-5 text-primary" /> Meus cursos</h2>
              {area.cursos.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground">
                    <p className="mb-4">
                      {temAcesso && area.plano?.todosOsCursos
                        ? "Escolha um curso para começar. Ele aparece aqui assim que você assistir à primeira aula."
                        : "Você ainda não começou nenhum curso."}
                    </p>
                    <Button asChild><Link href="/courses">Explorar cursos</Link></Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {area.cursos.map((c) => (
                    <Card key={c.id} className="flex flex-col overflow-hidden">
                      {c.thumbnail && <img src={c.thumbnail} alt="" className="aspect-[16/7] w-full object-cover" loading="lazy" />}
                      <CardContent className="flex flex-1 flex-col gap-3 pt-5">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/courses/${c.slug}`} className="font-semibold hover:underline">{c.titulo}</Link>
                          {c.origem === "teste" && <Badge variant="outline">Teste de 1 aula</Badge>}
                          {c.progresso >= 100 && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />}
                        </div>
                        {c.origem === "matricula" && (
                          <div className="space-y-1">
                            <Progress value={c.progresso} />
                            <p className="text-xs text-muted-foreground">
                              {c.concluidas} de {c.totalAulas} aulas · {c.progresso}%
                              {c.ultimoAcesso ? ` · último acesso em ${data(c.ultimoAcesso)}` : ""}
                            </p>
                          </div>
                        )}
                        <div className="mt-auto flex flex-wrap gap-2">
                          {c.proximaAulaId && (
                            <Button asChild size="sm">
                              <Link href={`/lesson/${c.proximaAulaId}`}>
                                <PlayCircle className="mr-2 h-4 w-4" /> {c.progresso >= 100 ? "Rever" : c.concluidas > 0 ? "Continuar" : "Começar"}
                              </Link>
                            </Button>
                          )}
                          {c.certificadoId && (
                            <Button asChild size="sm" variant="outline"><Link href="/certificates"><Award className="mr-2 h-4 w-4" /> Certificado</Link></Button>
                          )}
                          {c.origem === "matricula" && (
                            <Button asChild size="sm" variant="ghost"><Link href="/my-courses"><MessageSquareQuote className="mr-2 h-4 w-4" /> Depoimento</Link></Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Compras */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Receipt className="h-5 w-5 text-primary" /> Compras</h2>
              {area.compras.length === 0 ? (
                <Card><CardContent className="py-6 text-sm text-muted-foreground">Nenhuma compra ainda.</CardContent></Card>
              ) : (
                <Card>
                  <CardContent className="divide-y p-0">
                    {area.compras.map((p) => {
                      const st = STATUS_COMPRA[p.status];
                      return (
                        <div key={p.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{p.descricao} · {brl(p.valorCentavos)}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.pagoEm ? `Pago em ${data(p.pagoEm)}` : p.vencimento ? `Vencimento ${dataYmd(p.vencimento)}` : data(p.data)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-7 sm:pl-0">
                            <Badge variant="outline" className={st?.classe}>{st?.rotulo ?? p.status}</Badge>
                            {p.linkPagamento && (
                              <Button asChild size="sm" variant="outline">
                                <a href={p.linkPagamento} target="_blank" rel="noopener noreferrer">Pagar</a>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Certificados */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Award className="h-5 w-5 text-primary" /> Certificados</h2>
              <Card>
                <CardContent className="py-5 text-sm">
                  {area.certificados.length === 0 ? (
                    <p className="text-muted-foreground">Ao concluir um curso, o certificado aparece aqui.</p>
                  ) : (
                    <ul className="space-y-2">
                      {area.certificados.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span><span className="font-medium">{c.cursoTitulo}</span> <span className="text-muted-foreground">· emitido em {data(c.emitidoEm)}</span></span>
                          <Button asChild size="sm" variant="outline"><Link href="/certificates">Ver certificado</Link></Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
