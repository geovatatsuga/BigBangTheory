export type VisualPhase =
  | 'big-bang'
  | 'inflation'
  | 'plasma'
  | 'recombination'
  | 'atoms'
  | 'dark-ages'
  | 'first-stars'
  | 'galaxies'
  | 'spiral-clusters'
  | 'cosmic-web';

export function getVisualPhase(progress: number): VisualPhase {
  if (progress < 4) return 'big-bang';
  if (progress < 12) return 'inflation';
  if (progress < 22) return 'plasma';
  if (progress < 34) return 'recombination';
  if (progress < 42) return 'atoms';
  if (progress < 52) return 'dark-ages';
  if (progress < 65) return 'first-stars';
  if (progress < 75) return 'galaxies';
  if (progress < 85) return 'spiral-clusters';
  return 'cosmic-web';
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  const x = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

type VisualProfile = {
  title: string;
  scaleLabel: string;
  caption: string;
  light: number;
  gas: number;
  stars: number;
  cameraDistance: number;
};

function getCameraDistance(progress: number) {
  if (progress < 4) return 95;
  if (progress < 8) return 95 + Math.pow(smoothstep(4, 8, progress), 0.28) * 425;
  if (progress < 22) return 520 - smoothstep(8, 22, progress) * 48;
  if (progress < 34) return 472 - smoothstep(22, 34, progress) * 92;
  if (progress < 48) return 380 - smoothstep(34, 48, progress) * 72;
  if (progress < 65) return 308 - smoothstep(48, 65, progress) * 10;
  if (progress < 75) return 298 + smoothstep(65, 75, progress) * 62;
  if (progress < 85) return 360 - smoothstep(75, 85, progress) * 60;
  return 300 + smoothstep(85, 100, progress) * 180;
}

export function getVisualProfile(progress: number): VisualProfile {
  const phase = getVisualPhase(progress);

  if (phase === 'big-bang') {
    return {
      title: 'Singularidade',
      scaleLabel: '0 segundos',
      caption: 'O inicio de tudo: energia, densidade e calor extremos.',
      light: 1,
      gas: 0,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'inflation') {
    return {
      title: 'Inflacao',
      scaleLabel: '10^-36 a 10^-32 s',
      caption: 'O Universo cresce quase instantaneamente de uma escala menor que um atomo.',
      light: 0.95,
      gas: 0.88,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'plasma') {
    return {
      title: 'Sopa de particulas',
      scaleLabel: '3 minutos',
      caption: 'Formam-se os primeiros nucleos atomicos: hidrogenio e helio.',
      light: 0.88,
      gas: 1,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'recombination') {
    const clear = smoothstep(22, 42, progress);
    return {
      title: 'Recombinacao',
      scaleLabel: '380.000 anos',
      caption: 'Eletrons se prendem aos nucleos e a luz passa a viajar livre.',
      light: 0.84 - clear * 0.42,
      gas: 1,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'atoms') {
    const cooling = smoothstep(34, 48, progress);
    return {
      title: 'Universo transparente',
      scaleLabel: 'Antes das estrelas',
      caption: 'A luz ja atravessa o espaco, mas ainda nao ha estrelas acesas.',
      light: 0.42 - cooling * 0.18,
      gas: 0.96 - cooling * 0.1,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'dark-ages') {
    const darkness = smoothstep(42, 52, progress);
    return {
      title: 'Idade das Trevas',
      scaleLabel: 'Rumo ao alvorecer',
      caption: 'Nuvens de gas escuro se preparam para formar as primeiras estrelas.',
      light: 0.24 - darkness * 0.16,
      gas: 0.82,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'first-stars') {
    const born = smoothstep(52, 70, progress);
    return {
      title: 'Alvorecer cosmico',
      scaleLabel: '100-200 milhoes de anos',
      caption: 'Surgem as primeiras estrelas, chamadas Populacao III.',
      light: 0.08 + born * 0.72,
      gas: 0.82 - born * 0.3,
      stars: born,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'galaxies') {
    return {
      title: 'Galaxias jovens',
      scaleLabel: '1 bilhao de anos',
      caption: 'As primeiras galaxias crescem junto com buracos negros supermassivos.',
      light: 0.85,
      gas: 0.25,
      stars: 1,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'spiral-clusters') {
    const density = smoothstep(75, 85, progress);
    return {
      title: 'Grandes estruturas',
      scaleLabel: 'Galaxias maduras',
      caption: 'A gravidade organiza galaxias em aglomerados, filamentos e regioes vazias.',
      light: 0.92 + density * 0.08,
      gas: 0.22 - density * 0.08,
      stars: 1,
      cameraDistance: getCameraDistance(progress)
    };
  }

  const webT = smoothstep(85, 100, progress);
  if (progress < 98) {
    return {
      title: 'Nascimento do Sol',
      scaleLabel: '9 bilhoes de anos',
      caption: 'Uma nuvem de poeira estelar colapsa e o Sistema Solar comeca a se formar.',
      light: 1,
      gas: 0.15 - webT * 0.05,
      stars: 1,
      cameraDistance: getCameraDistance(progress)
    };
  }

  return {
    title: 'Hoje',
    scaleLabel: '13,8 bilhoes de anos',
    caption: 'O Universo continua se expandindo de forma acelerada.',
    light: 1,
    gas: 0.15 - webT * 0.05,
    stars: 1,
    cameraDistance: getCameraDistance(progress)
  };
}
