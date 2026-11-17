/**
 * Textos de venda sugeridos para os Programas que já existem em produção.
 *
 * Não são gravados sozinhos: o admin abre "Venda" no Programa, clica em
 * "Usar texto sugerido", revisa e salva. A chave é o id do Programa em
 * produção e o título precisa bater (proteção contra id trocado em outro banco).
 *
 * Base: aulas reais de cada Programa (títulos e módulos no banco em 17/11/2026),
 * as páginas da Hotmart e os textos da própria Shadia ("Materiais dos cursos",
 * PDF enviado em 17/11/2026). Pensamentos Automáticos cita o Diário da
 * Transformação, que é entregue como presente (shared/presentes.ts). Os demais
 * materiais citados no PDF (Diário da Autoconsciência, meditações) não existem
 * no site e por isso não aparecem.
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
  // Jornada Permita-se SER LIVRE: introdução + 7 módulos, 24 aulas, cerca de 6h15
  1: {
    titulo: /permita-se\s+ser\s+livre/i,
    headline: "Você muda de emprego, de relação, de cidade. E os mesmos padrões vão junto.",
    salesDescription: [
      "Tem coisas que se repetem não importa o cenário. O medo de ser deixada de lado. A culpa por dizer não. A sensação de que precisa provar o tempo todo que merece estar ali. Quase sempre isso tem uma origem, e ela costuma estar lá atrás, em crenças e feridas que nem sempre conseguimos olhar.",
      "Permita-se Ser Livre nasceu da experiência da Shadia Hasan com atendimentos, mentorias e histórias reais de mudança. Foi desenvolvido a partir de técnicas psicoterapêuticas e de fundamentos da psicologia positiva para ajudar você a compreender seus pensamentos, emoções e comportamentos, e a identificar crenças limitantes e bloqueios emocionais que interferem na sua vida.",
      "São 24 aulas em vídeo, pouco mais de seis horas, em sete módulos de três aulas. A jornada começa por como as crenças limitantes se formam e influenciam suas escolhas, e segue pela criança interior, a rejeição, o medo, o passado, o amor-próprio e o protagonismo. Ao longo das aulas há reflexões, exercícios e propostas de prática.",
      "A Shadia faz um pedido: não apenas assista, se envolva. Reserve um tempo para você, anote suas reflexões, permita-se sentir e questionar. Algumas reflexões podem tocar fundo na sua história, e isso é natural. Cada pessoa tem o seu ritmo, e é ele que vale aqui.",
    ].join("\n\n"),
    forWhom: [
      "Quem percebe que repete os mesmos padrões nas relações, no trabalho ou na família",
      "Quem sente culpa com facilidade ou tem dificuldade de se colocar",
      "Quem convive com o medo de rejeição ou de não ser suficiente",
      "Quem carrega mágoas do passado e quer olhar para elas com mais calma",
      "Quem quer um processo longo e organizado, para fazer no próprio ritmo",
    ].join("\n"),
    learnings: [
      "Módulo 1: entender como as crenças limitantes se formam e começar a ressignificá-las",
      "Módulo 2: reconhecer as marcas da infância e olhar para a relação com seus pais",
      "Módulo 3: entender a ferida da rejeição e aprender a acolher as próprias emoções",
      "Módulo 4: descobrir de onde vem o medo e montar estratégias para lidar com ele",
      "Módulo 5: perceber o apego ao passado e transformar sua história em aprendizado",
      "Módulo 6: fortalecer o amor-próprio e construir relações mais saudáveis",
      "Módulo 7: assumir o protagonismo da própria vida e integrar o que mudou",
    ].join("\n"),
    ctaText: "A liberdade que você busca pode começar quando você se permite olhar para si com mais amor, consciência e verdade.",
    priceCents: 19700,
    originalPriceCents: 59700,
  },
  // Jornada do Código Interno: 7 semanas, 1 aula por semana, cerca de 1h30
  2: {
    titulo: /c[óo]digo\s+interno/i,
    headline: "Você quer prosperar, mas parece que algo dentro de você puxa o freio?",
    salesDescription: [
      "Muita gente trabalha, se dedica e mesmo assim trava na hora de cobrar o que vale, aceitar uma oportunidade ou se permitir ter mais. Por trás disso costumam estar ideias antigas sobre dinheiro, merecimento e segurança, que a gente carrega sem perceber.",
      "A Jornada do Código Interno propõe olhar para essas ideias uma semana de cada vez. São sete aulas de 12 a 15 minutos, uma por semana. A jornada começa pela consciência de prosperidade e pela segurança interior, passa pela mentalidade de crescimento e pela construção de uma nova identidade, e termina com abundância, abertura para receber e a consolidação do que mudou.",
      "O ritmo semanal é proposital. Entre uma aula e outra você tem tempo de observar como pensa e reage no dia a dia, e é ali, na rotina, que as escolhas começam a mudar.",
    ].join("\n\n"),
    forWhom: [
      "Quem sente culpa ou desconforto ao ganhar, cobrar ou receber",
      "Quem adia decisões importantes por insegurança",
      "Quem quer rever as crenças que carrega sobre dinheiro e merecimento",
      "Quem prefere aulas curtas, com tempo para colocar em prática entre uma e outra",
    ].join("\n"),
    learnings: [
      "Semana 1: perceber como você pensa sobre prosperidade",
      "Semana 2: desenvolver segurança interior para decidir",
      "Semana 3: trocar o \"não consigo\" por uma mentalidade de crescimento",
      "Semana 4: integrar uma forma nova de se ver",
      "Semana 5: ampliar a consciência de abundância",
      "Semana 6: abrir espaço para receber",
      "Semana 7: consolidar na rotina o que mudou",
    ].join("\n"),
    ctaText: "Uma aula por semana. Sete semanas para rever o que te trava.",
    priceCents: 5700,
    originalPriceCents: 19700,
  },
  // Pensamentos Automáticos: introdução + 4 módulos, cerca de 1h45
  9: {
    titulo: /pensamentos\s+autom[áa]ticos/i,
    headline: "Até quando você vai desistir de si por acreditar em pensamentos que talvez nem sejam verdadeiros?",
    salesDescription: [
      "Quantas oportunidades você deixou passar por achar que não era capaz? Quantas vezes ficou numa situação que fazia mal por acreditar que não merecia algo melhor? Talvez você tenha vontade de mudar, mas a mente sempre encontra um motivo para desistir. Você se cobra, se compara e se critica tanto que nunca parece ser suficiente.",
      "Na psicologia, pensamentos automáticos são aqueles que surgem rápido, muitas vezes sem a gente perceber, e mexem com emoções e comportamentos. Quem cresceu ouvindo que nunca fazia nada direito pode pensar \"não vou conseguir\" diante de uma oportunidade e desistir antes de tentar. E esse padrão se repete no trabalho, nos relacionamentos e nas escolhas.",
      "Em Pensamentos Automáticos, a Shadia Hasan ajuda você a reconhecer esses pensamentos, entender de onde eles vêm e responder a eles com mais consciência, sem fingir que os problemas não existem e sem tentar eliminar todo pensamento negativo. São uma aula de introdução e quatro módulos, quase duas horas de conteúdo.",
      "Quem entra recebe de presente o Diário da Transformação, um caderno para responder ao fim de cada módulo. É nele que o conhecimento começa a virar consciência. A sugestão da Shadia é simples: uma aula de cada vez, com pausas, reflexão e escrita.",
    ].join("\n\n"),
    forWhom: [
      "Quem começa projetos e desiste no meio do caminho",
      "Quem busca aprovação o tempo todo ou tem medo da rejeição",
      "Quem sente que precisa provar o próprio valor o tempo inteiro",
      "Quem se cobra, se compara e se critica demais",
      "Quem quer entender os próprios padrões e construir uma relação mais saudável consigo",
    ].join("\n"),
    learnings: [
      "Módulo 1, O piloto automático da mente: como os pensamentos automáticos surgem e por que acreditamos tanto na voz interna que critica, compara e antecipa o pior",
      "Módulo 2, De onde vêm seus pensamentos: como a infância, as experiências e as mensagens recebidas formam crenças sobre amor, dinheiro, valor pessoal e merecimento",
      "Módulo 3, Pensamentos e emoções: a relação entre pensar, sentir e agir, as distorções cognitivas e como reconhecer o que sente para responder com mais consciência",
      "Módulo 4, Reprogramando a mente: como questionar um pensamento, construir interpretações mais realistas e interromper padrões automáticos",
    ].join("\n"),
    ctaText: "Você não precisa acreditar em tudo o que pensa. Pode aprender a reconhecer seus pensamentos e escolher como responder.",
    priceCents: 5700,
    originalPriceCents: 19700,
  },
  // A vida responde ao que você pensa: 5 aulas, menos de 40 minutos
  8: {
    titulo: /vida\s+responde/i,
    headline: "O problema pesa. O jeito como você pensa sobre ele pode pesar ainda mais.",
    salesDescription: [
      "Duas pessoas passam pela mesma situação e saem dela de jeitos muito diferentes. Muitas vezes a diferença está na interpretação, naquilo que cada uma diz a si mesma sobre o que aconteceu. Interpretações negativas repetidas viram postura, e a postura acaba guiando as escolhas.",
      "A Vida Responde ao Que Você Pensa é o programa mais curto da Shadia Hasan: cinco aulas, menos de 40 minutos no total. Ela une Psicologia, autoconhecimento e reflexões sobre neuroplasticidade e espiritualidade para mostrar como o pensamento cria a sua postura interna e como mudar isso sem fingir que está tudo bem.",
      "Corrigir o pensamento não significa negar a realidade. Significa enxergar a situação de forma mais realista e responder a ela com mais equilíbrio. É um bom começo para quem quer conhecer o trabalho da Shadia antes de uma jornada mais longa.",
    ].join("\n\n"),
    forWhom: [
      "Quem sente que os problemas parecem sempre maiores do que são",
      "Quem quer uma primeira experiência curta com o trabalho da Shadia",
      "Quem busca mais coerência entre o que pensa, sente e faz",
      "Quem tem pouco tempo e quer um conteúdo direto",
    ].join("\n"),
    learnings: [
      "Por que o problema nem sempre é o problema",
      "Como o pensamento cria a sua postura interna",
      "Como corrigir o pensamento sem negar o que está acontecendo",
      "Como se organizar por dentro para responder melhor ao que vem de fora",
    ].join("\n"),
    ctaText: "Menos de 40 minutos para mudar o jeito de olhar para o que acontece.",
    priceCents: 5700,
    originalPriceCents: 19700,
  },
};

export function textoSugeridoPara(id: number, titulo: string): TextoVenda | null {
  const t = TEXTOS_SUGERIDOS[id];
  return t && t.titulo.test(titulo) ? t : null;
}
