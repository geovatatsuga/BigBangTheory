import { smoothstep } from './visualPhase';

const SECOND_IN_YEARS = 1 / (365 * 24 * 60 * 60);
const MINUTE_IN_YEARS = 60 * SECOND_IN_YEARS;
const MILLION = 1_000_000;
const BILLION = 1_000_000_000;

export const cosmicTimelineMilestones = [
  {
    progress: 0,
    timeLabel: '0 s',
    stateLabel: 'Singularidade',
    eventLabel: 'Inicio de tudo',
    years: 0,
  },
  {
    progress: 5,
    timeLabel: '10^-36 s',
    stateLabel: 'Inflacao',
    eventLabel: 'Expansao instantanea',
    years: 1e-36 * SECOND_IN_YEARS,
  },
  {
    progress: 15,
    timeLabel: '3 min',
    stateLabel: 'Sopa de particulas',
    eventLabel: 'Nucleos de H e He',
    years: 3 * MINUTE_IN_YEARS,
  },
  {
    progress: 25,
    timeLabel: '380 mil anos',
    stateLabel: 'Recombinacao',
    eventLabel: 'Luz livre',
    years: 380_000,
  },
  {
    progress: 50,
    timeLabel: '100-200 mi anos',
    stateLabel: 'Alvorecer cosmico',
    eventLabel: 'Primeiras estrelas',
    years: 150 * MILLION,
  },
  {
    progress: 65,
    timeLabel: '1 bi anos',
    stateLabel: 'Galaxias jovens',
    eventLabel: 'Galaxias e buracos negros',
    years: 1 * BILLION,
  },
  {
    progress: 92,
    timeLabel: '9 bi anos',
    stateLabel: 'Nascimento do Sol',
    eventLabel: 'Sistema Solar se forma',
    years: 9 * BILLION,
  },
  {
    progress: 100,
    timeLabel: '13,8 bi anos',
    stateLabel: 'Hoje',
    eventLabel: 'Expansao acelerada',
    years: 13.8 * BILLION,
  },
];

export function getCosmicAgeYears(progress: number) {
  const clamped = Math.max(0, Math.min(100, progress));

  for (let i = 0; i < cosmicTimelineMilestones.length - 1; i++) {
    const start = cosmicTimelineMilestones[i];
    const end = cosmicTimelineMilestones[i + 1];

    if (clamped <= end.progress) {
      const t = smoothstep(start.progress, end.progress, clamped);
      return start.years + (end.years - start.years) * t;
    }
  }

  return cosmicTimelineMilestones[cosmicTimelineMilestones.length - 1].years;
}

export function getCurrentMilestone(progress: number) {
  return [...cosmicTimelineMilestones].reverse().find((milestone) => progress >= milestone.progress) || cosmicTimelineMilestones[0];
}

export function formatCosmicAge(progress: number) {
  const years = getCosmicAgeYears(progress);

  if (years === 0) return 'Tempo 0';
  if (years < SECOND_IN_YEARS) return '10^-36 a 10^-32 segundos';
  if (years < 1 / 365) return 'Primeiros minutos';
  if (years < 1) return 'Menos de 1 ano';
  if (years < 1_000) return `${Math.round(years).toLocaleString('pt-BR')} anos`;
  if (years < MILLION) return `${Math.round(years / 1_000).toLocaleString('pt-BR')} mil anos`;
  if (years < BILLION) return `${formatNumber(years / MILLION)} milhoes de anos`;
  return `${formatNumber(years / BILLION)} bilhoes de anos`;
}

function formatNumber(value: number) {
  const digits = value >= 10 ? 0 : 1;
  return value.toLocaleString('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: value < 10 && value % 1 !== 0 ? 1 : 0,
  });
}
