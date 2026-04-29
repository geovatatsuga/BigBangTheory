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
  if (progress < 36) return 'recombination';
  if (progress < 48) return 'atoms';
  if (progress < 58) return 'dark-ages';
  if (progress < 70) return 'first-stars';
  if (progress < 80) return 'galaxies';
  if (progress < 90) return 'spiral-clusters';
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
  // 0-22%: Câmera dentro do plasma/neblina
  if (progress < 4) return 0.1;
  if (progress < 12) return 0.1 + smoothstep(4, 12, progress) * 2;
  if (progress < 22) return 2.1 + smoothstep(12, 22, progress) * 10;
  
  // 22-48%: Recuando enquanto o universo fica transparente
  if (progress < 36) return 12.1 + smoothstep(22, 36, progress) * 150;
  if (progress < 58) return 162.1 + smoothstep(36, 58, progress) * 100;
  
  // 48-100%: Visão de larga escala (fora)
  if (progress < 65) return 262.1 + smoothstep(48, 65, progress) * 45;
  if (progress < 75) return 307.1 + smoothstep(65, 75, progress) * 50;
  if (progress < 85) return 357.1 - smoothstep(75, 85, progress) * 50;
  return 307.1 + smoothstep(85, 100, progress) * 180;
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
    const clear = smoothstep(22, 36, progress);
    return {
      title: 'Recombinacao',
      scaleLabel: '380.000 anos',
      caption: 'Eletrons se prendem aos nucleos e a luz passa a viajar livre.',
      light: 0.78 - clear * 0.48,
      gas: 0.9 - clear * 0.2,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'atoms') {
    const cooling = smoothstep(36, 48, progress);
    return {
      title: 'Primeiros atomos',
      scaleLabel: 'Antes das estrelas',
      caption: 'Hidrogenio e helio neutros dominam um Universo ainda sem estrelas.',
      light: 0.3 - cooling * 0.16,
      gas: 0.7 - cooling * 0.08,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'dark-ages') {
    const darkness = smoothstep(48, 58, progress);
    return {
      title: 'Idade das Trevas',
      scaleLabel: 'Rumo ao alvorecer',
      caption: 'Nuvens de gas escuro se preparam para formar as primeiras estrelas.',
      light: 0.12 - darkness * 0.07,
      gas: 0.54,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'first-stars') {
    const born = smoothstep(60, 70, progress);
    return {
      title: 'Alvorecer cosmico',
      scaleLabel: '100-300 milhoes de anos',
      caption: 'Surgem estrelas Populacao III: massivas, quentes e azul-brancas.',
      light: 0.05 + born * 0.72,
      gas: 0.54 - born * 0.24,
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
    const density = smoothstep(80, 90, progress);
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

  const webT = smoothstep(90, 100, progress);
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
