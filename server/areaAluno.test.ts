import { describe, expect, it } from "vitest";
import { hojeEmBrasilia, lerConcluidas, montarAreaAluno, statusDaCompra, statusDoTeste, type DadosAreaAluno } from "./areaAluno";

const agora = new Date("2026-10-30T15:00:00Z");
const dia = (s: string) => new Date(s);

const base = (): DadosAreaAluno => ({
  assinaturas: [],
  planos: [
    { slug: "basic", name: "Básico", maxCourses: 3 },
    { slug: "premium", name: "Premium", maxCourses: null },
  ],
  matriculas: [],
  cursos: [
    { id: 1, title: "Autoconhecimento", slug: "autoconhecimento", thumbnail: null },
    { id: 2, title: "Ansiedade", slug: "ansiedade", thumbnail: null },
  ],
  aulas: [
    { id: 11, courseId: 1, title: "Aula 1", order: 1, isAccessRestricted: 0 },
    { id: 12, courseId: 1, title: "Aula 2", order: 2, isAccessRestricted: 1 },
    { id: 13, courseId: 1, title: "Aula 3", order: 3, isAccessRestricted: 1 },
    { id: 21, courseId: 2, title: "Respirar", order: 1, isAccessRestricted: 1 },
    { id: 22, courseId: 2, title: "Pausar", order: 2, isAccessRestricted: 1 },
  ],
  testes: [],
  pagamentos: [],
  certificados: [],
});

describe("datas e conversões", () => {
  it("dia de Brasília vira antes do UTC", () => {
    expect(hojeEmBrasilia(new Date("2026-10-30T02:00:00Z"))).toBe("2026-10-29");
  });
  it("lê aulas concluídas e tolera lixo", () => {
    expect([...lerConcluidas("[11, \"12\"]")]).toEqual([11, 12]);
    expect(lerConcluidas("x").size).toBe(0);
    expect(lerConcluidas(null).size).toBe(0);
  });
});

describe("status de compra", () => {
  const p = { status: "pending", providerStatus: null, dueDate: "2026-10-30", refundedAmount: 0 };
  it("pendente no prazo = aguardando; vencimento passado ou OVERDUE = vencido", () => {
    expect(statusDaCompra(p, "2026-10-30")).toBe("aguardando");
    expect(statusDaCompra({ ...p, dueDate: "2026-10-29" }, "2026-10-30")).toBe("vencido");
    expect(statusDaCompra({ ...p, providerStatus: "OVERDUE" }, "2026-10-30")).toBe("vencido");
  });
  it("pago, estornado e falhou", () => {
    expect(statusDaCompra({ ...p, status: "completed" }, "2026-10-30")).toBe("pago");
    expect(statusDaCompra({ ...p, status: "completed", refundedAmount: 1990 }, "2026-10-30")).toBe("estornado");
    expect(statusDaCompra({ ...p, status: "refunded" }, "2026-10-30")).toBe("estornado");
    expect(statusDaCompra({ ...p, status: "failed" }, "2026-10-30")).toBe("falhou");
  });
});

describe("status do teste de 1 aula", () => {
  it("ativo só dentro da validade", () => {
    expect(statusDoTeste({ status: "active", expiresAt: dia("2026-11-05T00:00:00Z"), dueDate: null }, agora, "2026-10-30")).toBe("ativo");
    expect(statusDoTeste({ status: "active", expiresAt: dia("2026-10-29T00:00:00Z"), dueDate: null }, agora, "2026-10-30")).toBe("expirado");
  });
  it("pendente vencido não oferece link de pagamento", () => {
    expect(statusDoTeste({ status: "pending", expiresAt: null, dueDate: "2026-10-28" }, agora, "2026-10-30")).toBe("vencido");
    expect(statusDoTeste({ status: "cancelled", expiresAt: null, dueDate: null }, agora, "2026-10-30")).toBe("cancelado");
  });
});

describe("painel do aluno", () => {
  it("quem só pagou o teste vê o curso e o botão vai direto para a aula comprada", () => {
    const d = base();
    d.testes = [{ lessonId: 12, courseId: 1, status: "active", invoiceUrl: "https://pag", dueDate: "2026-10-29", paidAt: dia("2026-10-29T16:00:00Z"), expiresAt: dia("2026-11-05T16:00:00Z"), createdAt: dia("2026-10-29T16:00:00Z") }];
    d.pagamentos = [{ id: 5, amount: 1990, status: "completed", providerStatus: "PAYMENT_RECEIVED", paymentUrl: "https://pag", dueDate: "2026-10-29", paidAt: dia("2026-10-29T16:00:00Z"), refundedAmount: 0, planSlug: "trial", description: "Teste de 1 aula (Asaas) — aula 12", createdAt: dia("2026-10-29T16:00:00Z") }];
    const a = montarAreaAluno(d, agora);
    expect(a.plano).toBeNull();
    expect(a.testes).toHaveLength(1);
    expect(a.testes[0]).toMatchObject({ status: "ativo", aulaTitulo: "Aula 2", cursoTitulo: "Autoconhecimento", linkPagamento: null });
    expect(a.cursos).toHaveLength(1);
    expect(a.cursos[0]).toMatchObject({ id: 1, origem: "teste", proximaAulaId: 12 });
    expect(a.compras[0]).toMatchObject({ descricao: "Teste de 1 aula", status: "pago", linkPagamento: null });
    expect(a.pendencia).toBeNull();
  });

  it("cobrança em aberto aparece como pendência com link; vencida não", () => {
    const d = base();
    d.pagamentos = [
      { id: 1, amount: 1990, status: "pending", providerStatus: "OVERDUE", paymentUrl: "https://velho", dueDate: "2026-10-24", paidAt: null, refundedAmount: 0, planSlug: "trial", description: null, createdAt: dia("2026-10-24T15:00:00Z") },
      { id: 2, amount: 4990, status: "pending", providerStatus: "PAYMENT_CREATED", paymentUrl: "https://novo", dueDate: "2026-10-31", paidAt: null, refundedAmount: 0, planSlug: "basic", description: null, createdAt: dia("2026-10-30T12:00:00Z") },
    ];
    const a = montarAreaAluno(d, agora);
    expect(a.compras.map((c) => c.status)).toEqual(["aguardando", "vencido"]);
    expect(a.compras[1].linkPagamento).toBeNull();
    expect(a.pendencia).toEqual({ descricao: "Plano Básico", valorCentavos: 4990, linkPagamento: "https://novo", vencimento: "2026-10-31" });
  });

  it("progresso conta aulas publicadas concluídas e 'continuar' aponta a primeira que falta", () => {
    const d = base();
    d.assinaturas = [{ plan: "basic", status: "active", startDate: dia("2026-10-01T00:00:00Z"), endDate: null, notes: null }];
    d.matriculas = [
      { courseId: 1, progress: 0, completedLessons: "[11,12]", enrolledAt: dia("2026-10-02T00:00:00Z"), lastAccessedAt: dia("2026-10-20T00:00:00Z") },
      { courseId: 2, progress: 0, completedLessons: "[]", enrolledAt: dia("2026-10-03T00:00:00Z"), lastAccessedAt: dia("2026-10-28T00:00:00Z") },
    ];
    const a = montarAreaAluno(d, agora);
    expect(a.plano).toMatchObject({ nome: "Básico", todosOsCursos: false, limiteCursos: 3, cursosUsados: 2 });
    expect(a.cursos.map((c) => c.id)).toEqual([2, 1]); // acesso mais recente primeiro
    const c1 = a.cursos.find((c) => c.id === 1)!;
    expect(c1).toMatchObject({ totalAulas: 3, concluidas: 2, progresso: 67, proximaAulaId: 13 });
  });

  it("premium libera todos os cursos; assinatura cancelada não conta", () => {
    const d = base();
    d.assinaturas = [
      { plan: "basic", status: "cancelled", startDate: null, endDate: null, notes: null },
      { plan: "premium", status: "active", startDate: null, endDate: null, notes: null },
    ];
    expect(montarAreaAluno(d, agora).plano).toMatchObject({ slug: "premium", todosOsCursos: true, limiteCursos: null });
    d.assinaturas = [{ plan: "basic", status: "cancelled", startDate: null, endDate: null, notes: null }];
    expect(montarAreaAluno(d, agora).plano).toBeNull();
  });

  it("vários testes da mesma aula: vale o mais recente; certificado liga ao curso", () => {
    const d = base();
    d.testes = [
      { lessonId: 21, courseId: 2, status: "cancelled", invoiceUrl: null, dueDate: "2026-10-20", paidAt: null, expiresAt: null, createdAt: dia("2026-10-20T00:00:00Z") },
      { lessonId: 21, courseId: 2, status: "pending", invoiceUrl: "https://pagar", dueDate: "2026-10-31", paidAt: null, expiresAt: null, createdAt: dia("2026-10-30T10:00:00Z") },
    ];
    d.matriculas = [{ courseId: 1, progress: 100, completedLessons: "[11,12,13]", enrolledAt: agora, lastAccessedAt: agora }];
    d.certificados = [{ id: 9, tipo: "aula", courseId: 1, numero: "SH-2026-AAAAAAAA", titulo: "Aula 1", subtitulo: "Autoconhecimento", emitidoEm: agora }];
    const a = montarAreaAluno(d, agora);
    expect(a.testes).toEqual([expect.objectContaining({ aulaId: 21, status: "aguardando", linkPagamento: "https://pagar" })]);
    expect(a.cursos.map((c) => c.id)).toEqual([1]); // teste aguardando não libera o curso
    expect(a.cursos[0]).toMatchObject({ progresso: 100, certificadoId: 9 });
    expect(a.certificados[0]).toMatchObject({ tipo: "aula", titulo: "Aula 1", numero: "SH-2026-AAAAAAAA" });
  });
});
