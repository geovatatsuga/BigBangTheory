export interface Epoch {
  id: string;
  name: string;
  shortName: string;
  age: string;
  temperature: string;
  whatIsHappening: string;
  description: string;
  progressMarker: number; // 0 to 100
}

export const epochs: Epoch[] = [
  {
    id: "singularity",
    name: "Singularidade",
    shortName: "Tempo 0",
    age: "0 segundos",
    temperature: "Calor e densidade extremos",
    whatIsHappening: "O inicio de tudo.",
    description: "Toda a energia, materia, espaco e tempo estavam comprimidos em um estado extremamente quente e denso. A simulacao representa isso como um nucleo brilhante instavel, porque nao havia galaxias, estrelas ou atomos ainda.",
    progressMarker: 0
  },
  {
    id: "inflation",
    name: "Inflacao Cosmica",
    shortName: "Inflacao",
    age: "10^-36 a 10^-32 segundos",
    temperature: "Extremamente quente",
    whatIsHappening: "O Universo se expande quase instantaneamente.",
    description: "Durante a inflacao, o Universo teria crescido de algo menor que um atomo para uma escala imensa em uma fracao de segundo. Essa fase explica por que o Universo parece tao uniforme em grandes escalas.",
    progressMarker: 5
  },
  {
    id: "particle-soup",
    name: "Sopa de Particulas",
    shortName: "Particulas",
    age: "3 minutos",
    temperature: "~1 bilhao K",
    whatIsHappening: "Formam-se os primeiros nucleos atomicos.",
    description: "O Universo ainda era uma sopa quente de particulas. Protons e neutrons comecaram a formar os primeiros nucleos atomicos, principalmente hidrogenio e helio.",
    progressMarker: 15
  },
  {
    id: "recombination",
    name: "Recombinacao",
    shortName: "Luz livre",
    age: "380.000 anos",
    temperature: "~3000 K",
    whatIsHappening: "A luz finalmente viaja livre.",
    description: "Com o resfriamento, eletrons puderam se prender aos nucleos. O Universo deixou de ser opaco: a luz passou a atravessar o espaco, formando a radiacao cosmica de fundo que observamos hoje.",
    progressMarker: 25
  },
  {
    id: "cosmic-dawn",
    name: "Alvorecer Cosmico",
    shortName: "1as estrelas",
    age: "100 a 200 milhoes de anos",
    temperature: "Gas frio em colapso",
    whatIsHappening: "Surgem as primeiras estrelas, chamadas Populacao III.",
    description: "Depois de um periodo escuro, a gravidade concentrou nuvens de gas primordial ate acender as primeiras estrelas. Elas eram massivas, brilhantes e mudaram a quimica do Universo.",
    progressMarker: 50
  },
  {
    id: "young-galaxies",
    name: "Galaxias Jovens",
    shortName: "Galaxias jovens",
    age: "1 bilhao de anos",
    temperature: "~20 K no fundo cosmico",
    whatIsHappening: "As primeiras galaxias e buracos negros supermassivos se formam.",
    description: "Estrelas, gas e materia escura se agruparam em galaxias jovens. No centro de algumas delas, buracos negros supermassivos comecaram a crescer.",
    progressMarker: 65
  },
  {
    id: "solar-birth",
    name: "Nascimento do Sol",
    shortName: "Sol nasce",
    age: "9 bilhoes de anos",
    temperature: "~5 K no fundo cosmico",
    whatIsHappening: "O Sistema Solar comeca a se formar a partir de poeira estelar.",
    description: "Bilhoes de anos apos o Big Bang, uma nuvem enriquecida por geracoes anteriores de estrelas colapsou e deu origem ao Sol, aos planetas e ao nosso Sistema Solar.",
    progressMarker: 92
  },
  {
    id: "today",
    name: "Hoje",
    shortName: "Hoje",
    age: "13,8 bilhoes de anos",
    temperature: "2,7 K no fundo cosmico",
    whatIsHappening: "O Universo continua se expandindo de forma acelerada.",
    description: "O Universo atual contem galaxias maduras, grandes estruturas cosmicas e uma expansao acelerada. Galaxias distantes se afastam porque o proprio espaco entre elas aumenta.",
    progressMarker: 100
  }
];
