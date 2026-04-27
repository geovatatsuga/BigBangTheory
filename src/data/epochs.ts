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
    id: "big-bang",
    name: "Big Bang / Universo Inicial",
    shortName: "Big Bang",
    age: "0 anos",
    temperature: "Incalculável (Extremamente quente)",
    whatIsHappening: "O próprio espaço começa a se expandir.",
    description: "O Universo estava em um estado extremamente quente, denso e energético. Não era uma explosão dentro do espaço; era o próprio espaço começando a se expandir. O 'ponto' brilhante que imaginamos é apenas uma analogia.",
    progressMarker: 0
  },
  {
    id: "inflation",
    name: "Inflação Cósmica",
    shortName: "Inflação",
    age: "Fração minúscula de segundo",
    temperature: "10^27 K",
    whatIsHappening: "A expansão do espaço acelera violentamente.",
    description: "Em uma fração minúscula de segundo (cerca de 10^-36s), o espaço teria se expandido de forma extremamente rápida. Isso é chamado de inflação cósmica e explica porque o Universo parece tão uniforme em todas as direções.",
    progressMarker: 5
  },
  {
    id: "hot-plasma",
    name: "Universo Quente e Opaco",
    shortName: "Plasma",
    age: "Alguns minutos",
    temperature: "~1 bilhão a 3000 K",
    whatIsHappening: "O Universo é uma sopa fervente de partículas e luz aprisionada.",
    description: "O Universo era tão quente que a luz não conseguia viajar livremente, colidindo com elétrons soltos. Era como uma névoa brilhante e opaca de partículas carregadas (plasma).",
    progressMarker: 15
  },
  {
    id: "first-atoms",
    name: "Formação dos Primeiros Átomos",
    shortName: "Átomos",
    age: "380.000 anos",
    temperature: "3000 K",
    whatIsHappening: "A luz é liberada! A primeira radiação viaja livremente.",
    description: "Com a expansão, o Universo esfriou. Prótons e elétrons puderam, finalmente, se combinar para formar os primeiros átomos (hidrogênio e hélio). Sem elétrons livres para barrar a luz, o Universo se tornou transparente.",
    progressMarker: 25
  },
  {
    id: "dark-ages",
    name: "Idade das Trevas Cósmica",
    shortName: "Trevas",
    age: "Até ~100 milhões de anos",
    temperature: "Esfriando rapidamente (< 1000 K)",
    whatIsHappening: "O Universo está escuro, apenas com nuvens de gás invisíveis.",
    description: "Depois da formação dos átomos, a luz viajava livremente, mas ainda não existiam estrelas ou galáxias para emitir nova luz. O Universo ficou escuro por um longo período.",
    progressMarker: 35
  },
  {
    id: "first-stars",
    name: "Primeiras Estrelas",
    shortName: "1ª Estrelas",
    age: "~100 a 200 milhões de anos",
    temperature: "~50 K (fundo)",
    whatIsHappening: "A gravidade concentra o gás hidrogênio até inflamar.",
    description: "A gravidade juntou as densas nuvens de hidrogênio primitivo. No centro dessas nuvens gigantes, a pressão e o calor provocaram as primeiras fusões nucleares, e as primeiras estrelas nasceram, iluminando novamente o Universo.",
    progressMarker: 50
  },
  {
    id: "first-galaxies",
    name: "Primeiras Galáxias",
    shortName: "1ª Galáxias",
    age: "~500 milhões de anos",
    temperature: "~20 K (fundo)",
    whatIsHappening: "Agrupamentos de estrelas formam pequenas galáxias irregulares.",
    description: "As primeiras galáxias surgiram quando estrelas, enormes nuvens de gás e matéria escura se agruparam sob a influência da gravidade mútua. Eram menores e mais caóticas que as atuais.",
    progressMarker: 65
  },
  {
    id: "spiral-galaxy-clusters",
    name: "Aglomerados de Galáxias Espirais Gigantes",
    shortName: "Galáxias Espirais",
    age: "~1 a 3 bilhões de anos",
    temperature: "~10 K (fundo)",
    whatIsHappening: "Partículas e gás se concentram em galáxias espirais densas e massivas.",
    description: "Após as primeiras galáxias irregulares, regiões densas do Universo deram origem a galáxias espirais gigantes, com braços bem definidos e núcleos densos. Esses aglomerados formaram estruturas impressionantes, precursoras das grandes teias cósmicas.",
    progressMarker: 75
  },
  {
    id: "cosmic-web",
    name: "Universo com Grandes Estruturas",
    shortName: "Rede Cósmica",
    age: "~3 a 10 bilhões de anos",
    temperature: "~5 K (fundo)",
    whatIsHappening: "Galáxias se unem em aglomerados e filamentos imensos.",
    description: "Ao longo de bilhões de anos, as galáxias não ficaram espalhadas ao acaso. A gravidade esculpiu o Universo em uma grande teia cósmica: longos filamentos de galáxias, imensos aglomerados em seus cruzamentos e enormes regiões vazias entre eles.",
    progressMarker: 85
  },
  {
    id: "current",
    name: "Universo Atual",
    shortName: "Hoje",
    age: "13.8 bilhões de anos",
    temperature: "2.7 K (fundo cósmico)",
    whatIsHappening: "As distâncias entre grupos de galáxias continuam aumentando.",
    description: "O Universo de hoje está maduro. Galáxias formaram espirais organizadas e a expansão continua. Graças à energia escura, essa expansão do espaço está até mesmo se acelerando. As galáxias distantes se afastam não porque se movem pelo espaço, mas porque o próprio espaço entre elas aumenta.",
    progressMarker: 100
  }
];
