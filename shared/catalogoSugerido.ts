/**
 * Textos de venda sugeridos para os Programas que já existem em produção.
 *
 * Não são gravados sozinhos: o admin abre "Venda" no Programa, clica em
 * "Usar texto sugerido", revisa e salva. A chave é o id do Programa em
 * produção e o título precisa bater (proteção contra id trocado em outro banco).
 *
 * Base: aulas reais de cada Programa (títulos e módulos no banco em 17/11/2026)
 * e as páginas da Hotmart. Não citam bônus, diário, meditação ou material
 * complementar porque o site ainda não tem esses arquivos (lessonMaterials vazio).
 */

export type TextoVenda = {
  /** Confere o título do Programa antes de sugerir. */
  titulo: RegExp;
  headline: string;
  salesDescription: string;
  forWhom: string;
  learnings: string;
  ctaText: string;
  priceCents: number;
  originalPriceCents: number;
};

export const TEXTOS_SUGERIDOS: Record<number, TextoVenda> = {
  1: {
    titulo: /permita-se\s+ser\s+livre/i,
    headline: "Você sente que repete os mesmos padrões, mesmo querendo mudar?",
    salesDescription: [
      "Muita gente vive no automático. Repete comportamentos, carrega crenças antigas e reage de jeitos que nem sabe explicar. Isso pesa nas escolhas, nos relacionamentos e no valor que a gente dá a si mesmo.",
      "No Permita-se Ser Livre, a psicóloga Shadia Hasan conduz uma jornada em sete módulos: crenças limitantes, criança interior, rejeição, medo, passado, amor-próprio e protagonismo. Cada módulo tem três aulas em vídeo, para assistir no seu ritmo.",
      "Algumas aulas trazem clareza. Outras mexem com emoções antigas. O objetivo não é ficar perfeito, é ficar mais consciente de quem você é e de como você escolhe.",
    ].join("\n\n"),
    forWhom: [
      "Quem percebe que repete padrões e quer entender de onde eles vêm",
      "Quem carrega culpa, medo de rejeição ou dificuldade de se valorizar",
      "Quem quer olhar para a própria história com mais calma e menos julgamento",
      "Quem prefere aprender no próprio ritmo, pelo celular ou computador",
    ].join("\n"),
    learnings: [
      "Identificar e questionar crenças limitantes",
      "Reconhecer marcas da infância e se reconectar com a criança interior",
      "Entender a ferida da rejeição e acolher as próprias emoções",
      "Perceber de onde nasce o medo e como lidar com ele",
      "Ressignificar o passado e transformar sua história em aprendizado",
      "Fortalecer o amor-próprio e construir relações mais saudáveis",
      "Assumir o protagonismo da própria vida",
    ].join("\n"),
    ctaText: "Permita-se conhecer melhor quem você é.",
    priceCents: 19700,
    originalPriceCents: 59700,
  },
  2: {
    titulo: /c[óo]digo\s+interno/i,
    headline: "Quais crenças continuam decidindo por você?",
    salesDescription: [
      "Boa parte das nossas reações vem de aprendizados e experiências acumulados ao longo da vida. Eles influenciam a forma como você se sente diante de dinheiro, de oportunidades e de si mesma, muitas vezes sem você perceber.",
      "A Jornada do Código Interno tem sete semanas, uma aula por semana. Começa pela consciência de prosperidade, passa por segurança interior, mentalidade de crescimento e nova identidade, e termina com abundância, abertura para receber e a consolidação do que mudou.",
      "É um convite para olhar os padrões que orientam seu jeito de pensar e agir, e abrir espaço para escolhas mais conscientes.",
    ].join("\n\n"),
    forWhom: [
      "Quem sente que trava diante de oportunidades ou de dinheiro",
      "Quem quer desenvolver segurança interior para decidir",
      "Quem gosta de um ritmo semanal, com tempo para refletir entre as aulas",
    ].join("\n"),
    learnings: [
      "Reconhecer crenças sobre prosperidade que limitam suas escolhas",
      "Desenvolver segurança interior",
      "Cultivar uma mentalidade de crescimento",
      "Integrar uma nova forma de se ver",
      "Abrir-se para receber e sustentar o que mudou",
    ].join("\n"),
    ctaText: "Comece a compreender seus padrões.",
    priceCents: 5700,
    originalPriceCents: 19700,
  },
  9: {
    titulo: /pensamentos\s+autom[áa]ticos/i,
    headline: "Nem tudo o que você pensa representa a realidade.",
    salesDescription: [
      "Já reparou como um único pensamento negativo muda seu humor, suas decisões e o jeito de ver uma situação? Esses pensamentos surgem sozinhos, rápido, e a gente costuma acreditar neles sem perguntar nada.",
      "Em Pensamentos Automáticos, Shadia Hasan mostra como a mente funciona no piloto automático, de onde vêm esses pensamentos, como eles se ligam às emoções e o que fazer para interromper padrões que se repetem.",
      "A sugestão é assistir uma aula de cada vez, fazer pausas e escrever o que perceber. É no intervalo entre as aulas que muita coisa se organiza.",
    ].join("\n\n"),
    forWhom: [
      "Quem se pega pensando sempre no pior",
      "Quem reage no impulso e se arrepende depois",
      "Quem quer entender a relação entre o que pensa e o que sente",
    ].join("\n"),
    learnings: [
      "O que são pensamentos automáticos e como a mente entra no piloto automático",
      "De onde vêm seus pensamentos e como eles se formaram ao longo da vida",
      "Como pensamentos e emoções se influenciam",
      "Estratégias para interromper padrões automáticos e construir novos caminhos",
    ].join("\n"),
    ctaText: "Aprenda a observar seus pensamentos com mais clareza.",
    priceCents: 5700,
    originalPriceCents: 19700,
  },
  8: {
    titulo: /vida\s+responde/i,
    headline: "O jeito como você interpreta a vida muda o jeito como reage a ela.",
    salesDescription: [
      "Pensamentos influenciam emoções, decisões e atitudes. Quando a gente repete interpretações negativas sobre si ou sobre o que está vivendo, acaba reforçando inseguranças e escolhas que não ajudam.",
      "Em A Vida Responde ao Que Você Pensa, Shadia Hasan une Psicologia, autoconhecimento e reflexões sobre neuroplasticidade e espiritualidade em cinco aulas curtas.",
      "A proposta é aprender a questionar interpretações e responder aos desafios com mais equilíbrio. Corrigir o pensamento não é negar a realidade. É enxergar a situação de um jeito mais realista e mais útil.",
    ].join("\n\n"),
    forWhom: [
      "Quem sente que o problema parece sempre maior do que é",
      "Quem quer uma primeira experiência curta com o trabalho da Shadia",
      "Quem busca mais coerência entre o que pensa, sente e faz",
    ].join("\n"),
    learnings: [
      "Por que o problema nem sempre é o problema",
      "Como o pensamento cria a sua postura interna",
      "Corrigir o pensamento sem negar a realidade",
      "Organizar-se por dentro para responder melhor ao que acontece fora",
    ].join("\n"),
    ctaText: "Mude a forma de interpretar e responder às situações.",
    priceCents: 5700,
    originalPriceCents: 19700,
  },
};

export function textoSugeridoPara(id: number, titulo: string): TextoVenda | null {
  const t = TEXTOS_SUGERIDOS[id];
  return t && t.titulo.test(titulo) ? t : null;
}
