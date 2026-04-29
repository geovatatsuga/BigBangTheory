import * as THREE from 'three';
import { getVisualPhase } from '../../utils/visualPhase';

function smoothstep(min: number, max: number, value: number) {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

export function getScale(progress: number) {
  if (progress < 4) return 0.012;
  if (progress < 8) return THREE.MathUtils.lerp(0.012, 0.44, Math.pow(smoothstep(4, 8, progress), 0.22));
  if (progress < 12) return THREE.MathUtils.lerp(0.44, 0.68, smoothstep(8, 12, progress));
  if (progress < 22) return THREE.MathUtils.lerp(0.68, 0.86, smoothstep(12, 22, progress));
  if (progress < 75) return 0.86 + smoothstep(22, 75, progress) * 0.12;
  return THREE.MathUtils.lerp(0.98, 1.12, smoothstep(75, 100, progress));
}

export function applyPhaseColor(color: THREE.Color, progress: number, seed: number, kind: number) {
  const inflation = smoothstep(4, 12, progress);
  const plasma = smoothstep(12, 22, progress);
  const recombination = smoothstep(22, 34, progress);
  const cooling = smoothstep(34, 48, progress);
  const dawn = smoothstep(52, 64, progress);

  const plasmaHot = new THREE.Color('#ffffff');
  const plasmaWarm = new THREE.Color('#fef9c3');
  const plasmaCool = new THREE.Color('#fbbf24');
  const recombinationAmber = new THREE.Color('#f97316');
  const neutralGas = new THREE.Color('#1f130b');
  const darkGas = new THREE.Color('#06070a');
  const popIIIBlueWhite = new THREE.Color('#dbeafe');
  const warmStar = new THREE.Color('#ffd27a');
  const coolStar = new THREE.Color('#ff9b54');

  if (progress < 4) {
    color.copy(plasmaHot);
    return;
  }
  if (progress < 12) {
    color.lerpColors(plasmaHot, plasmaWarm, inflation);
    return;
  }
  if (progress < 22) {
    color.lerpColors(plasmaWarm, plasmaCool, plasma);
    return;
  }
  if (progress < 34) {
    color.lerpColors(plasmaCool, recombinationAmber, recombination);
    return;
  }
  if (progress < 48) {
    color.lerpColors(neutralGas, darkGas, cooling);
    return;
  }

  const warm = seed > 0.56;
  const isPopIII = kind < 0.18;
  
  if (progress < 64) {
    const preStar = kind < 0.72 ? darkGas : neutralGas;
    const firstLight = isPopIII ? popIIIBlueWhite : warmStar;
    color.lerpColors(preStar, firstLight, dawn * (isPopIII ? 1 : 0.28));
    return;
  }

  if (kind > 0.9) {
    color.setHSL(0.07, 0.28, 0.16 + seed * 0.08);
    return;
  }
  color.copy(warm ? warmStar : popIIIBlueWhite);
  color.lerp(coolStar, warm ? seed * 0.22 : 0);
}

export function getParticleAlpha(progress: number, seed: number, kind: number) {
  const phase = getVisualPhase(progress);
  if (phase === 'big-bang') return 0.8 + seed * 0.2; 
  
  if (progress < 22) {
    // No início, as partículas são parte do fluido (quase invisíveis individualmente)
    return 0.0; 
  }
  
  if (progress < 38) {
    // Recombinação: Átomos começam a aparecer conforme o fog limpa
    return THREE.MathUtils.lerp(0.0, 0.045, smoothstep(22, 38, progress)) * (0.8 + seed * 0.4);
  }

  const dawnBase = 0.018;
  const earlyGlow = THREE.MathUtils.lerp(dawnBase, 0.36 + seed * 0.16, smoothstep(52, 64, progress) * (kind < 0.18 ? 1 : 0));

  if (phase === 'atoms' || phase === 'dark-ages') return dawnBase;

  if (phase === 'first-stars' || phase === 'galaxies' || phase === 'spiral-clusters' || phase === 'cosmic-web') {
    const formation = smoothstep(52, 85, progress);
    const earlyStar = kind < 0.18;
    const galaxyStar = smoothstep(60, 78, progress);
    const starShare = earlyStar ? 1 : galaxyStar;
    const ignition = Math.max(
      smoothstep(52, 64, progress) * (kind < 0.18 ? 1 : 0),
      smoothstep(54 + seed * 16, 80, progress) * starShare
    );
    const spiralT = smoothstep(70, 96, progress);
    const densityT = smoothstep(68, 96, progress);
    const spiralBoost = THREE.MathUtils.lerp(0.18, 0.48, Math.max(spiralT, densityT * 0.85));
    const darkBase = 0.07 + (kind > 0.72 ? 0.04 : 0.01);
    const darkAlpha = darkBase + spiralBoost * 0.32;
    const galaxyAlpha = (kind < 0.72
      ? THREE.MathUtils.lerp(0.52 + seed * 0.14, 0.78 + seed * 0.12, Math.max(spiralT, densityT))
      : kind > 0.9 ? 0.06 + seed * 0.03
      : 0.16) + spiralBoost;
    const formedAlpha = THREE.MathUtils.lerp(darkAlpha, galaxyAlpha, kind < 0.72 ? ignition : formation * 0.72);
    return THREE.MathUtils.lerp(earlyGlow, formedAlpha, smoothstep(54, 66, progress));
  }

  return kind < 0.72 ? 0.78 + seed * 0.12 : 0.22;
}

export function getParticleSize(progress: number, seed: number, kind: number) {
  const phase = getVisualPhase(progress);
  if (phase === 'big-bang') return 18 + seed * 10;
  
  if (progress < 22) {
    // Partículas são "nadas" individuais, apenas parte da sopa
    return 0.1;
  }
  
  if (progress < 38) {
    // Átomos surgindo (pequenos e difusos)
    return THREE.MathUtils.lerp(0.1, 0.8, smoothstep(22, 38, progress)) + seed * 0.25;
  }

  const baseSize = 0.85;
  const earlySize = THREE.MathUtils.lerp(baseSize, 6 + seed * 6, smoothstep(52, 64, progress) * (kind < 0.18 ? 1 : 0));

  if (phase === 'atoms' || phase === 'dark-ages') return baseSize;

  if (phase === 'first-stars' || phase === 'galaxies' || phase === 'spiral-clusters' || phase === 'cosmic-web') {
    const massive = kind < 0.18;
    const formation = smoothstep(52, 85, progress);
    const earlyStar = massive;
    const galaxyStar = smoothstep(60, 78, progress);
    const starShare = earlyStar ? 1 : galaxyStar;
    const ignition = Math.max(
      smoothstep(52, 64, progress) * (massive ? 1 : 0),
      smoothstep(54 + seed * 12, 82, progress) * starShare
    );
    const spiralT = smoothstep(70, 96, progress);
    const densityT = smoothstep(68, 96, progress);
    const spiralBoost = THREE.MathUtils.lerp(1, 1.28, Math.max(spiralT, densityT * 0.8));
    const baseGalaxy = spiralBoost * (kind < 0.72 ? 1.4 + seed * 2.8 : kind > 0.9 ? 1.2 + seed * 1.2 : 1.0 + seed * 1.4);
    const coreBoost = kind < 0.15 ? 1 + spiralT * 0.5 : 1;
    const formedSize = THREE.MathUtils.lerp(2 + seed * 1.5, baseGalaxy * coreBoost, kind < 0.72 ? ignition : formation * 0.8);
    return THREE.MathUtils.lerp(earlySize, formedSize, smoothstep(54, 66, progress));
  }

  return kind < 0.72 ? 1.4 + seed * 2.8 : 1.0 + seed * 1.4;
}
