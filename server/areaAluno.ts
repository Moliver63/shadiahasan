/**
 * Área do aluno (/minha-area): junta num lugar só o que o aluno comprou e o que pode assistir.
 *
 *  - acesso: plano ativo (assinatura) e testes de 1 aula (ativos, aguardando pagamento, expirados)
 *  - cursos: cursos com matrícula + curso de cada teste de 1 aula, com progresso e "continuar"
 *  - compras: histórico de pagamentos com status legível e link quando ainda dá para pagar
 *  - certificados
 *
 * `montarAreaAluno` é pura (testável); `carregarAreaAluno` só busca as linhas no banco.
 * Nada aqui libera acesso: quem libera é o webhook do Asaas e checkUserHasAccess (videos.ts).
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import * as db from "./db";
import { consertarAcentos } from "../shared/acentos";
import {
  certificates, courses, enrollments, lessons, paymentHistory, subscriptionPlans, subscriptions, trialPasses,
} from "../drizzle/schema";

// ─── Linhas de entrada (o mínimo que o painel usa) ───────────────────────────

export type LinhaAssinatura = { plan: string; status: string; startDate: Date | null; endDate: Date | null; notes: string | null };
export type LinhaPlano = { slug: string; name: string; maxCourses: number | null };
export type LinhaMatricula = { courseId: number; progress: number; completedLessons: string | null; enrolledAt: Date; lastAccessedAt: Date };
export type LinhaCurso = { id: number; title: string; slug: string; thumbnail: string | null };
export type LinhaAula = { id: number; courseId: number; title: string; order: number; isAccessRestricted: number };
export type LinhaTeste = {
  lessonId: number; courseId: number; status: string; invoiceUrl: string | null; dueDate: string | null;
  paidAt: Date | null; expiresAt: Date | null; createdAt: Date;
};
export type LinhaPagamento = {
  id: number; amount: number; status: string; providerStatus: string | null; paymentUrl: string | null;
  dueDate: string | null; paidAt: Date | null; refundedAmount: number; planSlug: string | null;
  description: string | null; createdAt: Date;
};
export type LinhaCertificado = { id: number; courseId: number; certificateNumber: string; pdfUrl: string | null; issuedAt: Date };

export type DadosAreaAluno = {
  assinaturas: LinhaAssinatura[];
  planos: LinhaPlano[];
  matriculas: LinhaMatricula[];
  cursos: LinhaCurso[];
  aulas: LinhaAula[]; // aulas publicadas dos cursos (base do progresso)
  aulasDosTestes?: LinhaAula[]; // só para o título da aula do teste, mesmo se despublicada
  testes: LinhaTeste[];
  pagamentos: LinhaPagamento[];
  certificados: LinhaCertificado[];
};

// ─── Saída ───────────────────────────────────────────────────────────────────

export type StatusCompra = "pago" | "aguardando" | "vencido" | "estornado" | "falhou";
export type StatusTeste = "ativo" | "aguardando" | "vencido" | "expirado" | "cancelado";

export type AreaAluno = {
  plano: null | {
    slug: string; nome: string; status: string; desde: Date | null; ate: Date | null;
    todosOsCursos: boolean; limiteCursos: number | null; cursosUsados: number;
  };
  testes: Array<{
    aulaId: number; aulaTitulo: string; cursoId: number; cursoTitulo: string; cursoSlug: string | null;
    status: StatusTeste; expiraEm: Date | null; linkPagamento: string | null;
  }>;
  cursos: Array<{
    id: number; titulo: string; slug: string; thumbnail: string | null;
    origem: "matricula" | "teste";
    totalAulas: number; concluidas: number; progresso: number;
    proximaAulaId: number | null; proximaAulaTitulo: string | null;
    ultimoAcesso: Date | null; certificadoId: number | null;
  }>;
  compras: Array<{
    id: number; data: Date; descricao: string; valorCentavos: number; status: StatusCompra;
    linkPagamento: string | null; vencimento: string | null; pagoEm: Date | null;
  }>;
  pendencia: null | { descricao: string; valorCentavos: number; linkPagamento: string; vencimento: string | null };
  certificados: Array<{ id: number; cursoId: number; cursoTitulo: string; numero: string; pdfUrl: string | null; emitidoEm: Date }>;
};

const NOMES_PLANO: Record<string, string> = { free: "Gratuito", basic: "Básico", premium: "Premium", vip: "VIP" };

/** "2026-10-30" em Brasília. */
export function hojeEmBrasilia(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

export function lerConcluidas(texto: string | null | undefined): Set<number> {
  try {
    const v = JSON.parse(texto || "[]");
    return new Set(Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n)) : []);
  } catch {
    return new Set();
  }
}

/** Status que o aluno entende. Cobrança pendente com vencimento passado (ou OVERDUE no Asaas) = vencida. */
export function statusDaCompra(p: Pick<LinhaPagamento, "status" | "providerStatus" | "dueDate" | "refundedAmount">, hoje: string): StatusCompra {
  if (p.status === "completed") return p.refundedAmount > 0 ? "estornado" : "pago";
  if (p.status === "refunded") return "estornado";
  if (p.status === "failed") return "falhou";
  const atrasado = (p.providerStatus || "").toUpperCase().includes("OVERDUE") || (!!p.dueDate && p.dueDate < hoje);
  return atrasado ? "vencido" : "aguardando";
}

export function statusDoTeste(t: Pick<LinhaTeste, "status" | "expiresAt" | "dueDate">, agora: Date, hoje: string): StatusTeste {
  if (t.status === "active") return t.expiresAt && t.expiresAt > agora ? "ativo" : "expirado";
  if (t.status === "pending") return t.dueDate && t.dueDate < hoje ? "vencido" : "aguardando";
  if (t.status === "expired") return "expirado";
  return "cancelado";
}

function descricaoCompra(p: LinhaPagamento): string {
  const d = (p.description || "").trim();
  if (p.planSlug === "trial" || /teste de 1 aula/i.test(d)) return "Teste de 1 aula";
  if (p.planSlug && NOMES_PLANO[p.planSlug]) return `Plano ${NOMES_PLANO[p.planSlug]}`;
  return d.replace(/\s*\((asaas|stripe)\)/i, "") || "Pagamento";
}

export function montarAreaAluno(d: DadosAreaAluno, agora = new Date()): AreaAluno {
  const hoje = hojeEmBrasilia(agora);
  const cursoPorId = new Map(d.cursos.map((c) => [c.id, c]));
  const aulaPorId = new Map([...(d.aulasDosTestes ?? []), ...d.aulas].map((a) => [a.id, a]));
  const aulasDoCurso = new Map<number, LinhaAula[]>();
  for (const a of [...d.aulas].sort((x, y) => x.order - y.order || x.id - y.id)) {
    const lista = aulasDoCurso.get(a.courseId) ?? [];
    lista.push(a);
    aulasDoCurso.set(a.courseId, lista);
  }
  const certificadoPorCurso = new Map(d.certificados.map((c) => [c.courseId, c]));

  // Plano: a assinatura ativa de maior nível
  const ordem = ["free", "basic", "premium", "vip"];
  const ativa = d.assinaturas
    .filter((s) => s.status === "active" && s.plan !== "free")
    .sort((a, b) => ordem.indexOf(b.plan) - ordem.indexOf(a.plan))[0];
  const cursosPagos = new Set(d.aulas.filter((a) => a.isAccessRestricted).map((a) => a.courseId));
  let plano: AreaAluno["plano"] = null;
  if (ativa) {
    const info = d.planos.find((p) => p.slug === ativa.plan);
    const todos = ativa.plan === "premium" || ativa.plan === "vip";
    plano = {
      slug: ativa.plan,
      nome: consertarAcentos(info?.name) || NOMES_PLANO[ativa.plan] || ativa.plan,
      status: ativa.status,
      desde: ativa.startDate,
      ate: ativa.endDate,
      todosOsCursos: todos,
      limiteCursos: todos ? null : (info?.maxCourses ?? 3),
      cursosUsados: d.matriculas.filter((m) => cursosPagos.has(m.courseId)).length,
    };
  }

  // Testes de 1 aula: o mais recente por aula
  const vistos = new Set<number>();
  const testes: AreaAluno["testes"] = [];
  for (const t of [...d.testes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    if (vistos.has(t.lessonId)) continue;
    vistos.add(t.lessonId);
    const status = statusDoTeste(t, agora, hoje);
    const aula = aulaPorId.get(t.lessonId);
    const curso = cursoPorId.get(t.courseId);
    testes.push({
      aulaId: t.lessonId,
      aulaTitulo: aula?.title || "Aula",
      cursoId: t.courseId,
      cursoTitulo: curso?.title || "Curso",
      cursoSlug: curso?.slug ?? null,
      status,
      expiraEm: t.expiresAt,
      linkPagamento: status === "aguardando" ? t.invoiceUrl : null,
    });
  }

  // Cursos: matrículas + cursos de testes ativos
  const cursos: AreaAluno["cursos"] = [];
  const montarCurso = (courseId: number, origem: "matricula" | "teste", m?: LinhaMatricula) => {
    const c = cursoPorId.get(courseId);
    if (!c) return;
    const aulas = aulasDoCurso.get(courseId) ?? [];
    const feitas = lerConcluidas(m?.completedLessons);
    const concluidas = aulas.filter((a) => feitas.has(a.id)).length;
    const teste = origem === "teste" ? testes.find((t) => t.cursoId === courseId && t.status === "ativo") : undefined;
    const proxima = teste ? aulaPorId.get(teste.aulaId) : aulas.find((a) => !feitas.has(a.id)) ?? aulas[0];
    const progresso = aulas.length ? Math.round((concluidas / aulas.length) * 100) : (m?.progress ?? 0);
    cursos.push({
      id: c.id, titulo: c.title, slug: c.slug, thumbnail: c.thumbnail, origem,
      totalAulas: aulas.length, concluidas, progresso: Math.max(progresso, Math.min(100, m?.progress ?? 0)),
      proximaAulaId: proxima?.id ?? null, proximaAulaTitulo: proxima?.title ?? null,
      ultimoAcesso: m?.lastAccessedAt ?? null,
      certificadoId: certificadoPorCurso.get(c.id)?.id ?? null,
    });
  };
  const matriculados = new Set<number>();
  for (const m of d.matriculas) {
    if (matriculados.has(m.courseId)) continue;
    matriculados.add(m.courseId);
    montarCurso(m.courseId, "matricula", m);
  }
  for (const t of testes) {
    if (t.status === "ativo" && !matriculados.has(t.cursoId) && !cursos.some((c) => c.id === t.cursoId)) montarCurso(t.cursoId, "teste");
  }
  cursos.sort((a, b) => (b.ultimoAcesso?.getTime() ?? 0) - (a.ultimoAcesso?.getTime() ?? 0));

  // Compras
  const compras: AreaAluno["compras"] = [...d.pagamentos]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((p) => {
      const status = statusDaCompra(p, hoje);
      return {
        id: p.id, data: p.createdAt, descricao: descricaoCompra(p), valorCentavos: p.amount, status,
        linkPagamento: status === "aguardando" ? p.paymentUrl : null,
        vencimento: p.dueDate, pagoEm: p.paidAt,
      };
    });
  const aberta = compras.find((c) => c.status === "aguardando" && c.linkPagamento);
  const pendencia = aberta
    ? { descricao: aberta.descricao, valorCentavos: aberta.valorCentavos, linkPagamento: aberta.linkPagamento!, vencimento: aberta.vencimento }
    : null;

  const certificadosSaida = d.certificados.map((c) => ({
    id: c.id, cursoId: c.courseId, cursoTitulo: cursoPorId.get(c.courseId)?.title || "Curso",
    numero: c.certificateNumber, pdfUrl: c.pdfUrl, emitidoEm: c.issuedAt,
  }));

  return { plano, testes, cursos, compras, pendencia, certificados: certificadosSaida };
}

// ─── Banco ───────────────────────────────────────────────────────────────────

export async function carregarAreaAluno(userId: number): Promise<AreaAluno> {
  const d = await db.getDb();
  const vazio: DadosAreaAluno = { assinaturas: [], planos: [], matriculas: [], cursos: [], aulas: [], testes: [], pagamentos: [], certificados: [] };
  if (!d) return montarAreaAluno(vazio);

  // Tabelas criadas em tempo de execução (trialPasses) podem não existir num banco novo
  const seguro = async <T>(p: Promise<T>, padrao: T): Promise<T> => {
    try { return await p; } catch (e) { console.warn("[areaAluno]", e instanceof Error ? e.message : e); return padrao; }
  };

  const [assinaturas, planos, matriculas, testes, pagamentos, certificadosRows] = await Promise.all([
    seguro(d.select({ plan: subscriptions.plan, status: subscriptions.status, startDate: subscriptions.startDate, endDate: subscriptions.endDate, notes: subscriptions.notes })
      .from(subscriptions).where(eq(subscriptions.userId, userId)), [] as LinhaAssinatura[]),
    seguro(d.select({ slug: subscriptionPlans.slug, name: subscriptionPlans.name, maxCourses: subscriptionPlans.maxCourses }).from(subscriptionPlans), [] as LinhaPlano[]),
    seguro(d.select({ courseId: enrollments.courseId, progress: enrollments.progress, completedLessons: enrollments.completedLessons, enrolledAt: enrollments.enrolledAt, lastAccessedAt: enrollments.lastAccessedAt })
      .from(enrollments).where(eq(enrollments.userId, userId)).orderBy(desc(enrollments.lastAccessedAt)), [] as LinhaMatricula[]),
    seguro(d.select({ lessonId: trialPasses.lessonId, courseId: trialPasses.courseId, status: trialPasses.status, invoiceUrl: trialPasses.invoiceUrl, dueDate: trialPasses.dueDate, paidAt: trialPasses.paidAt, expiresAt: trialPasses.expiresAt, createdAt: trialPasses.createdAt })
      .from(trialPasses).where(eq(trialPasses.userId, userId)), [] as LinhaTeste[]),
    seguro(d.select({ id: paymentHistory.id, amount: paymentHistory.amount, status: paymentHistory.status, providerStatus: paymentHistory.providerStatus, paymentUrl: paymentHistory.paymentUrl, dueDate: paymentHistory.dueDate, paidAt: paymentHistory.paidAt, refundedAmount: paymentHistory.refundedAmount, planSlug: paymentHistory.planSlug, description: paymentHistory.description, createdAt: paymentHistory.createdAt })
      .from(paymentHistory).where(eq(paymentHistory.userId, userId)).orderBy(desc(paymentHistory.createdAt)).limit(50), [] as LinhaPagamento[]),
    seguro(d.select({ id: certificates.id, courseId: certificates.courseId, certificateNumber: certificates.certificateNumber, pdfUrl: certificates.pdfUrl, issuedAt: certificates.issuedAt })
      .from(certificates).where(eq(certificates.userId, userId)), [] as LinhaCertificado[]),
  ]);

  const idsCursos = Array.from(new Set([...matriculas.map((m) => m.courseId), ...testes.map((t) => t.courseId), ...certificadosRows.map((c) => c.courseId)]));
  const [cursosRows, aulasPublicadas, aulasDosTestes] = idsCursos.length
    ? await Promise.all([
        seguro(d.select({ id: courses.id, title: courses.title, slug: courses.slug, thumbnail: courses.thumbnail }).from(courses).where(inArray(courses.id, idsCursos)), [] as LinhaCurso[]),
        seguro(d.select({ id: lessons.id, courseId: lessons.courseId, title: lessons.title, order: lessons.order, isAccessRestricted: lessons.isAccessRestricted })
          .from(lessons).where(and(inArray(lessons.courseId, idsCursos), eq(lessons.isPublished, 1))).orderBy(asc(lessons.order)), [] as LinhaAula[]),
        testes.length
          ? seguro(d.select({ id: lessons.id, courseId: lessons.courseId, title: lessons.title, order: lessons.order, isAccessRestricted: lessons.isAccessRestricted })
              .from(lessons).where(inArray(lessons.id, Array.from(new Set(testes.map((t) => t.lessonId))))), [] as LinhaAula[])
          : Promise.resolve([] as LinhaAula[]),
      ])
    : [[], [], []] as [LinhaCurso[], LinhaAula[], LinhaAula[]];

  return montarAreaAluno({
    assinaturas, planos, matriculas, cursos: cursosRows, aulas: aulasPublicadas, aulasDosTestes, testes, pagamentos, certificados: certificadosRows,
  });
}
