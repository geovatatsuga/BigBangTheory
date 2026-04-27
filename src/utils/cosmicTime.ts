import { smoothstep } from './visualPhase';

const MILLION = 1_000_000;
const BILLION = 1_000_000_000;

const timelineAnchors = [
  { progress: 0, years: 0 },
  { progress: 4, years: 1 / (365 * 24 * 60 * 60) },
  { progress: 12, years: 3 / (365 * 24 * 60) },
  { progress: 22, years: 380_000 },
  { progress: 40, years: 1 * MILLION },
  { progress: 52, years: 100 * MILLION },
  { progress: 65, years: 500 * MILLION },
  { progress: 75, years: 1.5 * BILLION },
  { progress: 85, years: 4 * BILLION },
  { progress: 94, years: 10 * BILLION },
  { progress: 100, years: 13.8 * BILLION },
];

export function getCosmicAgeYears(progress: number) {
  const clamped = Math.max(0, Math.min(100, progress));

  for (let i = 0; i < timelineAnchors.length - 1; i++) {
    const start = timelineAnchors[i];
    const end = timelineAnchors[i + 1];

    if (clamped <= end.progress) {
      const t = smoothstep(start.progress, end.progress, clamped);
      return start.years + (end.years - start.years) * t;
    }
  }

  return timelineAnchors[timelineAnchors.length - 1].years;
}

export function formatCosmicAge(progress: number) {
  const years = getCosmicAgeYears(progress);

  if (years === 0) return 'Tempo 0';
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
