/**
 * CollectionDetail — Página pública de um Programa (e página de venda)
 * Rota: /collections/:id
 *
 * Modelo "avulso" + preço válido: preço riscado/promocional e "Quero começar"
 * (checkout Asaas). Modelo "assinatura": convite para os planos, como antes.
 * Quem já comprou vê "Começar agora". Nada aqui libera acesso.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { trpc } from "@/lib/trpc";
import { formatDuration } from "@/lib/formatDuration";
import { ArrowLeft, Award, BookOpen, Check, Clock, Download, Gift, Infinity as InfinityIcon, Lock, PlayCircle, Smartphone } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import PublicHeader from "@/components/PublicHeader";
import { SEOHead } from "@/components/SEOHead";
import { programaSchema, textoLimpo } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import PrecoPrograma from "@/components/programa/PrecoPrograma";
import ProgramaCheckoutDialog from "@/components/programa/ProgramaCheckoutDialog";
import { linhas, paragrafos, precoVendavel } from "@shared/comercial";
import { trackEvent, trackViewContent } from "@/components/Analytics";

const FOTO_SHADIA = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663117104978/xzKfSOAtqexRDupD.jpeg";

type Item = { id: number; lessonId: number; lesson?: { title: string; duration: number | null; isPublished: number; courseId: number }; course?: { id: number; title: string; thumbnail: string | null } | null };

export default function CollectionDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [location, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [comprando, setComprando] = useState(false);

  const { data: collection, isLoading } = trpc.collections.getById.useQuery(
    { id: id || 0 },
    { enabled: id > 0, staleTime: 0, refetchOnMount: "always" },
  );
  const { data: comercial } = trpc.comercial.config.useQuery(undefined, { staleTime: 30_000 });
  const { data: meus = [] } = trpc.comercial.meusProgramas.useQuery(undefined, { enabled: isAuthenticated });
  const { data: presente } = trpc.comercial.presente.useQuery({ collectionId: id || 0 }, { enabled: id > 0 });

  const col = collection as any;
  const itens: Item[] = useMemo(() => (col?.lessons ?? []).filter((i: Item) => i.lesson?.isPublished === 1), [col]);
  const totalDuration = itens.reduce((acc, i) => acc + (i.lesson?.duration || 0), 0);

  // Módulos = cursos de origem, na ordem do Programa (ex.: "Módulo 1", "Semana 3")
  const modulos = useMemo(() => {
    const grupos: Array<{ chave: number; titulo: string; itens: Item[] }> = [];
    for (const i of itens) {
      const chave = i.course?.id ?? 0;
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.chave === chave) ultimo.itens.push(i);
      else grupos.push({ chave, titulo: i.course?.title?.trim() || "Aulas", itens: [i] });
    }
    return grupos;
  }, [itens]);

  const jaComprou = meus.includes(id);
  const aVenda = !!comercial?.programasAVenda?.includes(id) && precoVendavel(col?.priceCents) && (comercial?.metodos.length ?? 0) > 0;

  // ViewContent da página de venda do Programa (uma vez por Programa aberto).
  const programaVisto = useRef(0);
  useEffect(() => {
    if (!aVenda || programaVisto.current === id || !col?.priceCents) return;
    programaVisto.current = id;
    trackViewContent({ contentId: `programa:${id}`, contentName: col.title, value: col.priceCents / 100 });
  }, [aVenda, id, col?.priceCents, col?.title]);

  // Volta do login com intenção de compra (?comprar=1)
  useEffect(() => {
    if (!aVenda || jaComprou || !isAuthenticated) return;
    if (new URLSearchParams(window.location.search).get("comprar") === "1") {
      setComprando(true);
      window.history.replaceState(null, "", `/collections/${id}`);
    }
  }, [aVenda, jaComprou, isAuthenticated, id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-12 space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-12 w-3/4 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!col) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card><CardContent className="py-12 text-center">
          <p className="text-lg mb-4">Programa não encontrado</p>
          <Link href="/courses"><Button>Voltar ao catálogo</Button></Link>
        </CardContent></Card>
      </div>
    );
  }

  const primeiraAula = itens[0]?.lessonId;
  const descricao = paragrafos(col.salesDescription);
  const paraQuem = linhas(col.forWhom);
  const aprende = linhas(col.learnings);

  function abrirAula(item: Item) {
    if (!isAuthenticated) { setLocation(`/login?next=${encodeURIComponent(`/lesson/${item.lessonId}`)}`); return; }
    setLocation(`/lesson/${item.lessonId}`);
  }

  function queroComecar() {
    // Sem login também: o diálogo faz a compra sem conta (a conta nasce no pagamento)
    trackEvent("programa_quero_comecar", { programa_id: id });
    setComprando(true);
  }

  /** Bloco de preço/ação: usado na lateral (desktop), no fim da página e na barra fixa do celular. */
  function Acao({ compacto = false }: { compacto?: boolean }) {
    if (jaComprou) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-emerald-700 font-medium flex items-center gap-1.5"><Check className="h-4 w-4" /> Você já tem este programa</p>
          <Button className="w-full" size="lg" onClick={() => primeiraAula && setLocation(`/lesson/${primeiraAula}`)}>Começar agora</Button>
        </div>
      );
    }
    if (aVenda) {
      return (
        <div className={compacto ? "flex items-center justify-between gap-3" : "space-y-4"}>
          <PrecoPrograma priceCents={col.priceCents} originalPriceCents={col.originalPriceCents} tamanho={compacto ? "sm" : "lg"} />
          <Button size="lg" className={compacto ? "shrink-0" : "w-full text-base"} onClick={queroComecar}>Quero começar</Button>
        </div>
      );
    }
    if (comercial?.vendaAvulsa) {
      // Modo Compra individual, mas este programa ainda não tem preço: leva aos que estão à venda
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Este programa ainda não está disponível para compra.</p>
          <Button className="w-full" size="lg" onClick={() => setLocation("/courses")}>Ver programas disponíveis</Button>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <Button className="w-full" size="lg" onClick={() => setLocation("/pricing")}>Ver planos de assinatura</Button>
        {!isAuthenticated && (
          <Button className="w-full" variant="outline" onClick={() => setLocation(`/login?next=${encodeURIComponent(location)}`)}>Já sou aluno, entrar</Button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
      <SEOHead
        title={col.title}
        description={textoLimpo(col.headline || col.description || col.subtitle, 160) || `Programa ${col.title}, de Shadia Hasan.`}
      />
      <JsonLd dados={programaSchema({ id, title: col.title, description: col.headline || col.description, coverUrl: col.coverUrl, priceCents: aVenda ? col.priceCents : null })} />
      <PublicHeader
        items={[
          { label: "Programas", href: "/courses" },
          { label: "Sobre", href: "/about" },
          { label: "Contato", href: "/contact" },
        ]}
        className="bg-card"
      />

      {/* ── Topo ───────────────────────────────────────────────────────── */}
      <section className="border-b bg-gradient-to-b from-primary/[0.06] to-background">
        <div className="container py-6 md:py-12">
          <Link href="/courses">
            <Button variant="ghost" size="sm" className="mb-6 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />Todos os programas
            </Button>
          </Link>
          <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-start">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Programa · Shadia Hasan</p>
              <h1 className="font-serif text-3xl md:text-5xl font-semibold leading-tight text-balance">{col.title}</h1>
              {(col.headline || col.subtitle) && (
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl text-pretty">{col.headline || col.subtitle}</p>
              )}
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" />{itens.length} aulas em vídeo</li>
                {totalDuration > 0 && <li className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{formatDuration(totalDuration)} de conteúdo</li>}
                <li className="flex items-center gap-1.5"><Smartphone className="h-4 w-4" />Celular e computador</li>
              </ul>
              {col.coverUrl && (
                <div className="lg:hidden overflow-hidden rounded-xl border bg-muted aspect-video">
                  <img src={col.coverUrl} alt={col.title} className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Cartão de compra (desktop) */}
            <aside className="hidden lg:block lg:sticky lg:top-24">
              <Card className="overflow-hidden shadow-lg">
                {col.coverUrl && <img src={col.coverUrl} alt="" className="w-full aspect-video object-cover" />}
                <CardContent className="p-6 space-y-5">
                  <Acao />
                  <IncluiLista total={itens.length} duracao={totalDuration} presente={presente?.titulo} />
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </section>

      <div className="container py-10 md:py-14">
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12">
          <div className="space-y-14 min-w-0">
            {/* Presente: para quem já tem o programa, o download; para quem chega, o convite */}
            {presente && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 md:p-6 flex flex-col sm:flex-row gap-4 sm:items-center">
                <div className="h-12 w-12 shrink-0 rounded-full bg-amber-100 flex items-center justify-center"><Gift className="h-6 w-6 text-amber-700" /></div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">{presente.podeBaixar ? "Seu presente" : "Presente para quem entra"}</p>
                  <p className="font-serif text-xl font-semibold">{presente.titulo}</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{presente.descricao}</p>
                </div>
                {presente.podeBaixar ? (
                  <div className="flex shrink-0 flex-col gap-2 sm:items-stretch">
                    {presente.urlOnline && (
                      <a href={presente.urlOnline}><Button className="w-full">Abrir meu diário</Button></a>
                    )}
                    {presente.url && (
                      <a href={presente.url}><Button variant="outline" className="w-full border-amber-300 bg-white"><Download className="h-4 w-4 mr-2" />Baixar PDF</Button></a>
                    )}
                  </div>
                ) : presente.amostra ? (
                  <a href={presente.amostra} className="shrink-0">
                    <Button variant="outline" className="border-amber-300 bg-white">Fazer o 1º exercício grátis</Button>
                  </a>
                ) : null}
              </section>
            )}

            {/* Descrição */}
            {(descricao.length > 0 || col.description) && (
              <section className="space-y-4 max-w-2xl">
                {(descricao.length > 0 ? descricao : [col.description]).map((p: string, i: number) => (
                  <p key={i} className="text-base md:text-lg leading-relaxed text-foreground/85">{p}</p>
                ))}
              </section>
            )}

            {paraQuem.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl md:text-3xl font-semibold mb-5">Para quem é este programa</h2>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {paraQuem.map((t) => (
                    <li key={t} className="rounded-xl border bg-card p-4 text-sm leading-relaxed">{t}</li>
                  ))}
                </ul>
              </section>
            )}

            {aprende.length > 0 && (
              <section>
                <h2 className="font-serif text-2xl md:text-3xl font-semibold mb-5">O que você vai aprender</h2>
                <ul className="space-y-3">
                  {aprende.map((t) => (
                    <li key={t} className="flex gap-3 text-base leading-relaxed">
                      <Check className="h-5 w-5 mt-0.5 shrink-0 text-primary" />{t}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Conteúdo programático real (aulas publicadas do Programa) */}
            <section>
              <div className="flex items-end justify-between gap-4 mb-5">
                <h2 className="font-serif text-2xl md:text-3xl font-semibold">Conteúdo do programa</h2>
                <p className="text-sm text-muted-foreground shrink-0">{itens.length} aulas{totalDuration > 0 ? ` · ${formatDuration(totalDuration)}` : ""}</p>
              </div>
              {itens.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">As aulas estão sendo preparadas.</CardContent></Card>
              ) : (
                <div className="rounded-xl border divide-y overflow-hidden bg-card">
                  {modulos.map((m, mi) => (
                    <div key={`${m.chave}-${mi}`}>
                      {modulos.length > 1 && (
                        <p className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50">{m.titulo}</p>
                      )}
                      <ul className="divide-y">
                        {m.itens.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => abrirAula(item)}
                              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
                            >
                              {jaComprou ? <PlayCircle className="h-4 w-4 shrink-0 text-primary" /> : <Lock className="h-4 w-4 shrink-0 text-muted-foreground/70" />}
                              <span className="flex-1 text-sm">{item.lesson?.title}</span>
                              {item.lesson?.duration ? <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(item.lesson.duration)}</span> : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Quem conduz */}
            <section className="grid sm:grid-cols-[160px_1fr] gap-6 items-center rounded-2xl border bg-card p-6">
              <img src={FOTO_SHADIA} alt="Shadia Hasan" className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover mx-auto" loading="lazy" />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Quem conduz</p>
                <h2 className="font-serif text-2xl font-semibold">Shadia Hasan</h2>
                <p className="text-sm text-muted-foreground">Psicóloga · CRP 12/27052</p>
                <p className="text-sm leading-relaxed text-foreground/85">
                  Psicóloga e mentora de desenvolvimento humano, Shadia acompanha pessoas em atendimentos, mentorias e processos de
                  autoconhecimento. Ao longo desse caminho, percebeu que muitas dificuldades do presente têm raízes em crenças e
                  feridas antigas, e que ninguém está condenado a repetir para sempre os mesmos padrões.
                </p>
                <p className="text-sm leading-relaxed text-foreground/85 italic">
                  "A minha intenção não é trazer respostas prontas para a sua vida. É compartilhar reflexões, ferramentas e caminhos
                  que ajudem você a se compreender melhor."
                </p>
                <Link href="/about" className="text-sm font-medium text-primary hover:underline">Conheça a Shadia</Link>
              </div>
            </section>

            {/* Perguntas frequentes */}
            <section>
              <h2 className="font-serif text-2xl md:text-3xl font-semibold mb-3">Perguntas frequentes</h2>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="acesso">
                  <AccordionTrigger>Como eu acesso as aulas?</AccordionTrigger>
                  <AccordionContent>
                    Pelo site, com o e-mail da sua conta, no celular ou no computador. Depois da compra, o programa aparece na Minha Área.
                  </AccordionContent>
                </AccordionItem>
                {aVenda && (
                  <>
                    <AccordionItem value="tempo">
                      <AccordionTrigger>Por quanto tempo tenho acesso?</AccordionTrigger>
                      <AccordionContent>
                        Na compra avulsa, o acesso ao programa comprado é vitalício, conforme os <Link href="/terms" className="underline">Termos de Uso</Link>.
                        Não há mensalidade.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="pagamento">
                      <AccordionTrigger>Quando o acesso é liberado?</AccordionTrigger>
                      <AccordionContent>
                        Assim que o Asaas confirmar o pagamento. No Pix costuma levar poucos minutos; no cartão, depois da aprovação;
                        no boleto, depois da compensação. Você recebe um e-mail quando liberar.
                      </AccordionContent>
                    </AccordionItem>
                  </>
                )}
                <AccordionItem value="reembolso">
                  <AccordionTrigger>E se eu não gostar?</AccordionTrigger>
                  <AccordionContent>
                    Você tem 7 dias para pedir o reembolso integral, como diz a nossa <Link href="/faq" className="underline">página de perguntas frequentes</Link>.
                    É só escrever para contato@shadiahasan.com.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="terapia">
                  <AccordionTrigger>O programa substitui terapia?</AccordionTrigger>
                  <AccordionContent>
                    Não. É um conteúdo educativo de autoconhecimento. Não é atendimento psicológico, diagnóstico nem tratamento.
                    Se você está passando por um momento difícil, procure acompanhamento profissional.
                  </AccordionContent>
                </AccordionItem>
                {!comercial?.vendaAvulsa && (
                  <AccordionItem value="assinatura">
                    <AccordionTrigger>Como funciona a assinatura?</AccordionTrigger>
                    <AccordionContent>
                      Com um plano ativo você assiste aos programas incluídos no plano. Veja os detalhes em <Link href="/pricing" className="underline">Planos</Link>.
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </section>

            {/* Chamada final */}
            {!jaComprou && (
              <section className="rounded-2xl bg-primary/[0.06] border p-6 md:p-10 text-center space-y-5">
                <p className="font-serif text-2xl md:text-3xl font-semibold text-balance">{col.ctaText || "Comece no seu ritmo, hoje."}</p>
                <div className="max-w-sm mx-auto"><Acao /></div>
              </section>
            )}
          </div>
          <div className="hidden lg:block" aria-hidden />
        </div>
      </div>

      {/* Barra fixa no celular */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <Acao compacto />
      </div>

      {aVenda && (
        <ProgramaCheckoutDialog
          open={comprando}
          onOpenChange={setComprando}
          collectionId={id}
          titulo={col.title}
          priceCents={col.priceCents}
          metodos={comercial!.metodos}
          logado={isAuthenticated}
        />
      )}

      <footer className="border-t bg-card mt-4">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Shadia Hasan. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

function IncluiLista({ total, duracao, presente }: { total: number; duracao: number; presente?: string }) {
  const itens = [
    ...(presente ? [{ icone: Gift, texto: `Presente: ${presente} (PDF)` }] : []),
    { icone: BookOpen, texto: `${total} aulas em vídeo${duracao > 0 ? ` (${formatDuration(duracao)})` : ""}` },
    { icone: InfinityIcon, texto: "Assista no seu ritmo, quantas vezes quiser" },
    { icone: Smartphone, texto: "No celular ou no computador" },
    { icone: Award, texto: "Certificado por aula, ao cumprir as etapas" },
  ];
  return (
    <ul className="space-y-2.5 border-t pt-5">
      {itens.map(({ icone: I, texto }) => (
        <li key={texto} className="flex items-start gap-2.5 text-sm text-muted-foreground"><I className="h-4 w-4 mt-0.5 shrink-0" />{texto}</li>
      ))}
    </ul>
  );
}
