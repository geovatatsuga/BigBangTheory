
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
  // first-stars (48→65): câmera desce suavemente de 308 → 298, sem estagnação nem salto
  if (progress < 65) return 308 - smoothstep(48, 65, progress) * 10;
  // galaxies (65→75): abre levemente de 298 → 360 de forma gradual
  if (progress < 75) return 298 + smoothstep(65, 75, progress) * 62;
  // Spiral-clusters: zoom in closer to appreciate the dense spiral arms
  if (progress < 85) return 360 - smoothstep(75, 85, progress) * 60; // zoom in to 300
  return 360 + smoothstep(85, 100, progress) * 120; // slow pull-back: expanding universe feel
}

export function getVisualProfile(progress: number): VisualProfile {
  const phase = getVisualPhase(progress);

  if (phase === 'big-bang') {
    return {
      title: 'Big Bang',
      scaleLabel: 'Nucleo instavel',
      caption: 'Sem estrelas: um amontoado minimo, quente e caotico prestes a inflar.',
      light: 1,
      gas: 0,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'inflation') {
    return {
      title: 'Inflacao cosmica',
      scaleLabel: 'Plasma inflando',
      caption: 'O espaco infla enquanto tudo ainda e uma sopa quente e opaca.',
      light: 0.95,
      gas: 0.88,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'plasma') {
    return {
      title: 'Plasma quente',
      scaleLabel: 'Malha quente e densa',
      caption: 'Uma nevoa vermelha de plasma prende a luz; o universo ainda nao e transparente.',
      light: 0.88,
      gas: 1,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'recombination') {
    const clear = smoothstep(22, 42, progress);
    return {
      title: 'Luz se soltando',
      scaleLabel: 'Plasma virando atomos',
      caption: 'A nevoa quente clareia aos poucos enquanto eletrons e protons formam atomos.',
      light: 0.84 - clear * 0.42,
      gas: 1,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'atoms') {
    const cooling = smoothstep(34, 48, progress);
    return {
      title: 'Primeiros atomos',
      scaleLabel: 'Universo esfriando',
      caption: 'A luz ja atravessa o espaco enquanto o gas primordial esfria lentamente.',
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
      scaleLabel: 'Gas frio, sem estrelas',
      caption: 'Nao e vazio: ha gas escuro, mas ainda nao ha estrelas acesas.',
      light: 0.24 - darkness * 0.16,
      gas: 0.82,
      stars: 0,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'first-stars') {
    const born = smoothstep(52, 70, progress);
    return {
      title: 'Primeiras estrelas',
      scaleLabel: 'A luz volta',
      caption: 'Nuvens de gas colapsam e os primeiros pontos de luz nascem.',
      light: 0.08 + born * 0.72,
      gas: 0.82 - born * 0.3,
      stars: born,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'galaxies') {
    return {
      title: 'Galaxias',
      scaleLabel: 'Estruturas enormes',
      caption: 'Estrelas se agrupam em galaxias, aglomerados e filamentos.',
      light: 0.85,
      gas: 0.25,
      stars: 1,
      cameraDistance: getCameraDistance(progress)
    };
  }

  if (phase === 'spiral-clusters') {
    const density = smoothstep(75, 85, progress);
    return {
      title: 'Aglomerados Espirais Gigantes',
      scaleLabel: 'Galáxias densas e massivas',
      caption: 'Enormes amontoados de gás e partículas colapsam em galáxias espirais com braços deslumbrantes e núcleos densos.',
      light: 0.92 + density * 0.08,
      gas: 0.22 - density * 0.08,
      stars: 1,
      cameraDistance: getCameraDistance(progress)
    };
  }

  const webT = smoothstep(85, 100, progress);
  return {
    title: 'Universo atual',
    scaleLabel: 'Rede cosmica madura',
    caption: 'Galáxias espirais maduras de todas as cores preenchem a rede cósmica. A expansão acelerada afasta suavemente cada grupo.',
    light: 1,
    gas: 0.15 - webT * 0.05,
    stars: 1,
    cameraDistance: getCameraDistance(progress)
  };
}
