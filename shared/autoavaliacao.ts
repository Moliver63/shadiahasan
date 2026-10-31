/**
 * Autoavaliação "Como você se comunica quando o assunto é difícil".
 *
 * Isca da página /autoavaliacao (anúncio de Pesquisa no Google). Conteúdo e cálculo ficam
 * aqui, compartilhados: o navegador mostra o resultado na hora e o servidor recalcula
 * a partir das respostas, sem confiar no perfil que o cliente enviar.
 *
 * Importante: NÃO é teste psicológico nem diagnóstico. Teste psicológico é instrumento
 * validado e de uso do profissional; aqui é um convite à reflexão e o texto diz isso.
 * Todos os textos são rascunhos escritos para a Shadia revisar antes de ir ao ar em escala.
 */

export const ESTILOS = ["evita", "claro", "forte", "indireto"] as const;
export type Estilo = (typeof ESTILOS)[number];

export type Pergunta = {
  situacao: string;
  /** Respostas na ordem em que aparecem na tela. `estilo` diz a que padrão cada uma corresponde. */
  opcoes: { texto: string; estilo: Estilo }[];
};

export const PERGUNTAS: readonly Pergunta[] = [
  {
    situacao: "Um colega marca uma reunião no horário que você tinha reservado para algo importante.",
    opcoes: [
      { texto: "Remarco o que era meu e não digo nada.", estilo: "evita" },
      { texto: "Vou à reunião com ar de cansaço e deixo claro, nas entrelinhas, que me atrapalhou.", estilo: "indireto" },
      { texto: "Explico que esse horário já estava comprometido e proponho outro.", estilo: "claro" },
      { texto: "Digo que ele deveria ter perguntado antes e que isso é falta de respeito.", estilo: "forte" },
    ],
  },
  {
    situacao: "Alguém da família faz um comentário que te magoa durante um almoço.",
    opcoes: [
      { texto: "Respondo na hora, no mesmo tom, e faço questão de ter a última palavra.", estilo: "forte" },
      { texto: "Falo com calma que aquilo me chateou e pergunto o que a pessoa quis dizer.", estilo: "claro" },
      { texto: "Sorrio, mudo de assunto e engulo.", estilo: "evita" },
      { texto: "Fico em silêncio pelo resto do almoço e respondo só com monossílabos.", estilo: "indireto" },
    ],
  },
  {
    situacao: "Você precisa pedir um aumento ou uma condição melhor de trabalho.",
    opcoes: [
      { texto: "Faço comentários soltos sobre como o mercado paga mais, esperando que entendam o recado.", estilo: "indireto" },
      { texto: "Adio. Espero que percebam meu trabalho sem eu precisar pedir.", estilo: "evita" },
      { texto: "Chego exigindo e deixo claro que, se não der, eu saio.", estilo: "forte" },
      { texto: "Marco uma conversa, levo exemplos do que entreguei e digo o que espero.", estilo: "claro" },
    ],
  },
  {
    situacao: "Um amigo pede um favor que você não consegue fazer.",
    opcoes: [
      { texto: "Digo que não consigo, agradeço a confiança e, se der, sugiro outra ajuda.", estilo: "claro" },
      { texto: "Digo que vou ver e sumo, até ele entender sozinho.", estilo: "indireto" },
      { texto: "Digo sim e me viro depois, mesmo sem ter condição.", estilo: "evita" },
      { texto: "Corto logo: “não dá” e pronto, sem rodeio.", estilo: "forte" },
    ],
  },
  {
    situacao: "Uma discussão com seu parceiro, sua parceira ou alguém muito próximo esquenta.",
    opcoes: [
      { texto: "Aumento o tom e lembro de tudo o que ficou pendente.", estilo: "forte" },
      { texto: "Cedo para a briga acabar, mesmo achando que tenho razão.", estilo: "evita" },
      { texto: "Digo “tá tudo bem” e passo o resto do dia de cara fechada.", estilo: "indireto" },
      { texto: "Peço uma pausa, respiro e volto para falar do que me incomodou.", estilo: "claro" },
    ],
  },
  {
    situacao: "Alguém te faz uma crítica no trabalho que você considera injusta.",
    opcoes: [
      { texto: "Ouço até o fim, aponto o que concordo e explico o que vejo diferente.", estilo: "claro" },
      { texto: "Aceito na hora e depois comento com outras pessoas o quanto foi injusto.", estilo: "indireto" },
      { texto: "Peço desculpas e concordo, para encerrar logo.", estilo: "evita" },
      { texto: "Rebato cada ponto e mostro onde a pessoa errou.", estilo: "forte" },
    ],
  },
  {
    situacao: "Alguém fura a fila na sua frente.",
    opcoes: [
      { texto: "Suspiro alto e olho torto, torcendo para a pessoa perceber.", estilo: "indireto" },
      { texto: "Falo alto, para todo mundo ouvir o que penso.", estilo: "forte" },
      { texto: "Digo com educação que a fila começa lá atrás.", estilo: "claro" },
      { texto: "Deixo passar e fico remoendo.", estilo: "evita" },
    ],
  },
  {
    situacao: "No fim de um dia difícil, o que você costuma fazer com o que sentiu?",
    opcoes: [
      { texto: "Descarrego em quem estiver por perto.", estilo: "forte" },
      { texto: "Guardo para mim. Não quero incomodar ninguém.", estilo: "evita" },
      { texto: "Deixo pistas: um suspiro, uma resposta seca, uma porta fechada com mais força.", estilo: "indireto" },
      { texto: "Procuro alguém de confiança e digo o que está pesando.", estilo: "claro" },
    ],
  },
];

export type Perfil = {
  titulo: string;
  /** Uma frase curta, usada no e-mail. */
  resumo: string;
  texto: string[];
  passo: string;
};

export const PERFIS: Record<Estilo, Perfil> = {
  evita: {
    titulo: "Você tende a guardar para si",
    resumo: "Suas respostas mostram um padrão de evitar o desconforto: ceder, adiar ou engolir para manter a paz.",
    texto: [
      "Suas respostas mostram um padrão de evitar o desconforto. Você cede, adia ou engole para manter a paz. Isso costuma vir de um cuidado real com os outros e com os vínculos.",
      "O custo aparece depois: cansaço, ressentimento que vai se acumulando e a sensação de que ninguém sabe o que você realmente quer. Quem convive com você muitas vezes só descobre o que te incomodou quando o assunto já pesa demais.",
    ],
    passo: "Esta semana, escolha uma situação pequena e diga o que prefere em uma frase só, sem pedir desculpas antes. Começar pelo pequeno treina o resto.",
  },
  claro: {
    titulo: "Você fala com clareza e respeito",
    resumo: "Suas respostas mostram que você costuma dizer o que pensa sem atropelar o outro.",
    texto: [
      "Suas respostas mostram que você costuma dizer o que pensa e o que precisa sem atropelar o outro. Isso não quer dizer que seja fácil: mesmo quem se comunica bem tem dias e pessoas com quem escorrega.",
      "O ponto de atenção, para quem está aqui, é perceber em quais situações você sai do seu jeito de sempre, por cansaço, pressão ou por causa de alguém específico, e cuidar justamente dessas.",
    ],
    passo: "Observe nesta semana em qual conversa você saiu do seu jeito de sempre e anote o que estava acontecendo antes. O padrão costuma aparecer rápido.",
  },
  forte: {
    titulo: "Você fala com muita força",
    resumo: "Suas respostas mostram que você defende o que pensa com intensidade e rapidez.",
    texto: [
      "Suas respostas mostram que você defende o que pensa com intensidade. Há coragem nisso, e quem convive com você sabe exatamente onde você está.",
      "O custo costuma ser o outro se fechar ou concordar por medo, e não por concordar de verdade. A conversa termina, mas o assunto continua aberto por dentro de quem ouviu.",
    ],
    passo: "Antes da próxima conversa difícil, respire fundo e comece pelo que você precisa, e não pelo que o outro fez de errado. A mesma verdade chega diferente.",
  },
  indireto: {
    titulo: "Você diz sem dizer",
    resumo: "Suas respostas mostram um padrão de dar o recado pelas beiradas: silêncio, ironia, um suspiro.",
    texto: [
      "Suas respostas mostram um padrão de dar o recado pelas beiradas: silêncio, ironia, um suspiro, uma resposta seca. Isso costuma surgir quando falar de frente parece arriscado ou quando faltou espaço para dizer na hora.",
      "O custo é que o outro raramente entende, e você fica esperando uma resposta para um pedido que nunca foi feito. Dos dois lados, sobra mal-estar sem nome.",
    ],
    passo: "Na próxima vez que sentir vontade de dar uma indireta, troque por uma frase direta e curta: “Isso me incomodou. Preciso de tal coisa.” Vale mais pelo hábito que pelo acerto.",
  },
};

export const AVISO_AUTOAVALIACAO =
  "Esta autoavaliação é um convite à reflexão. Não é teste psicológico nem diagnóstico e não substitui a conversa com um profissional.";

/** Em caso de empate, vale esta ordem (determinística). */
const DESEMPATE: Estilo[] = ["claro", "evita", "indireto", "forte"];

export type Resultado = {
  principal: Estilo;
  /** Segundo padrão, só quando também aparece com força (3 respostas ou mais). */
  secundario: Estilo | null;
  contagens: Record<Estilo, number>;
};

/** `respostas[i]` é o índice (0 a 3) da opção escolhida na pergunta i. Devolve null se estiver incompleto ou inválido. */
export function calcularResultado(respostas: readonly number[]): Resultado | null {
  if (!Array.isArray(respostas) || respostas.length !== PERGUNTAS.length) return null;
  const contagens: Record<Estilo, number> = { evita: 0, claro: 0, forte: 0, indireto: 0 };
  for (let i = 0; i < PERGUNTAS.length; i++) {
    const r = respostas[i];
    if (!Number.isInteger(r) || r < 0 || r >= PERGUNTAS[i].opcoes.length) return null;
    contagens[PERGUNTAS[i].opcoes[r].estilo]++;
  }
  const ordenados = [...DESEMPATE].sort((a, b) => contagens[b] - contagens[a]);
  const principal = ordenados[0];
  const segundo = ordenados[1];
  return { principal, secundario: contagens[segundo] >= 3 ? segundo : null, contagens };
}
