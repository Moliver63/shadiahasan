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
  // Jornada Permita-se SER LIVRE: introdução + 7 módulos, 24 aulas, cerca de 6h15
  1: {
    titulo: /permita-se\s+ser\s+livre/i,
    headline: "Você muda de emprego, de relação, de cidade. E os mesmos padrões vão junto.",
    salesDescription: [
      "Tem coisas que se repetem não importa o cenário. O medo de ser deixada de lado. A culpa por dizer não. A sensação de que precisa provar o tempo todo que merece estar ali. Quase sempre isso tem uma origem, e ela costuma estar lá atrás.",
      "Permita-se Ser Livre é a jornada mais completa da Shadia Hasan. São 24 aulas em vídeo, pouco mais de seis horas, organizadas em sete módulos. Cada módulo olha para um ponto que costuma travar a vida adulta: as crenças que você aprendeu sobre si, a criança que você foi, a rejeição, o medo, o passado, o amor-próprio e, no fim, o protagonismo sobre as próprias escolhas.",
      "As aulas seguem uma ordem pensada para ir do entendimento à prática. Algumas trazem clareza rápida. Outras mexem com lembranças e pedem uma pausa antes da próxima. Vá no seu tempo. A proposta é você se conhecer melhor e escolher com mais consciência, sem a pressa de virar outra pessoa.",
    ].join("\n\n"),
    forWhom: [
      "Quem percebe que repete os mesmos padrões nas relações, no trabalho ou na família",
      "Quem sente culpa com facilidade ou tem dificuldade de se colocar",
      "Quem convive com o medo de rejeição ou de não ser suficiente",
      "Quem carrega mágoas do passado e quer olhar para elas com mais calma",
      "Quem quer um processo longo e organizado, para fazer no próprio ritmo",
    ].join("\n"),
    learnings: [
      "Módulo 1: identificar suas crenças limitantes e começar a ressignificá-las",
      "Módulo 2: reconhecer as marcas da infância e olhar para a relação com seus pais",
      "Módulo 3: entender a ferida da rejeição e aprender a acolher as próprias emoções",
      "Módulo 4: descobrir de onde vem o medo e montar estratégias para lidar com ele",
      "Módulo 5: perceber o apego ao passado e transformar sua história em aprendizado",
      "Módulo 6: fortalecer o amor-próprio e construir relações mais saudáveis",
      "Módulo 7: assumir o protagonismo da própria vida e integrar o que mudou",
    ].join("\n"),
    ctaText: "Sua história, no seu ritmo. Comece pela primeira aula hoje.",
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
    headline: "Nem tudo o que você pensa é verdade. Aprenda a perceber a diferença.",
    salesDescription: [
      "Uma mensagem fica sem resposta e a cabeça já conclui que a pessoa está chateada com você. Um erro pequeno no trabalho e vem a certeza de que você não serve para aquilo. Esses pensamentos chegam sozinhos, em segundos, e mudam o humor e as decisões antes que você perceba.",
      "Em Pensamentos Automáticos, a Shadia Hasan explica como a mente funciona no piloto automático, de onde vêm esses pensamentos e como eles se formaram ao longo da sua história, de que forma se ligam às emoções e o que fazer para interromper os padrões que se repetem. São uma aula de introdução e quatro módulos, quase duas horas de conteúdo. Os três últimos módulos são os mais longos e os mais práticos.",
      "A sugestão da Shadia é assistir uma aula de cada vez, fazer pausas e anotar o que perceber. Observar o próprio pensamento é uma habilidade, e ela melhora com a prática.",
    ].join("\n\n"),
    forWhom: [
      "Quem costuma pensar logo no pior cenário",
      "Quem reage no impulso e se arrepende depois",
      "Quem se cobra demais e fala consigo mesmo com dureza",
      "Quem quer entender a relação entre o que pensa e o que sente",
    ].join("\n"),
    learnings: [
      "O que são pensamentos automáticos e por que a mente entra no piloto automático",
      "De onde vêm seus pensamentos e como eles se formaram ao longo da vida",
      "Como pensamentos e emoções se influenciam, e qual vem primeiro",
      "Estratégias para interromper padrões automáticos e construir novos caminhos",
    ].join("\n"),
    ctaText: "Comece a observar seus pensamentos antes que eles decidam por você.",
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
