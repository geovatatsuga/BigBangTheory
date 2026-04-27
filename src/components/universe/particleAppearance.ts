import * as THREE from 'three';
import { getVisualPhase, smoothstep } from '../../utils/visualPhase';

export function getScale(progress: number) {
  if (progress < 4) return 0.012;
  if (progress < 8) return THREE.MathUtils.lerp(0.012, 0.44, Math.pow(smoothstep(4, 8, progress), 0.22));
  if (progress < 12) return THREE.MathUtils.lerp(0.44, 0.68, smoothstep(8, 12, progress));
  if (progress < 22) return THREE.MathUtils.lerp(0.68, 0.86, smoothstep(12, 22, progress));
  if (progress < 75) return 0.86 + smoothstep(22, 75, progress) * 0.12;
  return THREE.MathUtils.lerp(0.98, 1.12, smoothstep(75, 100, progress));
}

export function applyPhaseColor(color: THREE.Color, progress: number, seed: number, kind: number) {
  if (progress >= 4 && progress < 52) {
    const clear = smoothstep(24, 50, progress);
    const cool = smoothstep(34, 56, progress);
    const plasmaHue = 0.015 + seed * 0.055;
    const atomicHue = 0.55 + seed * 0.07;
    const hue = THREE.MathUtils.lerp(plasmaHue, atomicHue, clear);
    const saturation = THREE.MathUtils.lerp(0.98, 0.48, Math.max(clear, cool));
    const lightness = THREE.MathUtils.lerp(0.5 + seed * 0.22, 0.18 + seed * 0.08, cool);
    color.setHSL(hue, saturation, lightness);
    return;
  }

  if (progress < 100) {
    const earlyIgnition = (kind < 0.18 ? smoothstep(52 + seed * 8, 80, progress) : 0);
    const galaxyIgnition = (kind < 0.72 ? smoothstep(64 + seed * 12, 96, progress) : 0);
    const ignition = Math.max(earlyIgnition, galaxyIgnition);
    const born = smoothstep(52, 96, progress);
    if (kind < 0.72) {
      const warm = seed > 0.58;
      color.setHSL(
        THREE.MathUtils.lerp(0.58, warm ? 0.09 : 0.6, ignition),
        THREE.MathUtils.lerp(0.5, warm ? 0.86 : 0.78, born),
        THREE.MathUtils.lerp(0.13 + seed * 0.08, warm ? 0.58 : 0.74, ignition)
      );
      return;
    }
    color.setHSL(0.58, 0.5, THREE.MathUtils.lerp(0.1 + seed * 0.05, 0.22 + seed * 0.08, born));
    return;
  }

  const warm = kind < 0.24 || seed > 0.82;
  if (kind > 0.9) {
    color.setHSL(0.6, 0.34, 0.2 + seed * 0.1);
    return;
  }
  color.setHSL(warm ? 0.09 : 0.6, warm ? 0.8 : 0.74, warm ? 0.58 : 0.76);
}

export function getParticleAlpha(progress: number, seed: number, kind: number) {
  const phase = getVisualPhase(progress);
  if (phase === 'big-bang') return 0.22 + seed * 0.34;
  const hot = smoothstep(4, 14, progress);
  const clear = smoothstep(22, 52, progress);
  const hotAlpha = THREE.MathUtils.lerp(0.28 + seed * 0.14, 0.34 + seed * 0.16, hot);
  const dawnBase = THREE.MathUtils.lerp(hotAlpha, 0.07 + seed * 0.04, clear);

  if (progress < 52) {
    return dawnBase;
  }

  const earlyGlow = THREE.MathUtils.lerp(dawnBase, 0.42 + seed * 0.18, smoothstep(52, 68, progress) * (kind < 0.18 ? 1 : 0));

  if (phase === 'atoms') return THREE.MathUtils.lerp(0.18 + seed * 0.04, 0.1, smoothstep(34, 48, progress));
  if (phase === 'dark-ages') return 0.07 + (kind > 0.72 ? 0.04 : 0.01);
  if (phase === 'first-stars' || phase === 'galaxies' || phase === 'spiral-clusters' || phase === 'cosmic-web') {
    const formation = smoothstep(56, 88, progress);
    const earlyStar = kind < 0.18;
    const galaxyStar = smoothstep(64, 80, progress);
    const starShare = earlyStar ? 1 : galaxyStar;
    const ignition = Math.max(
      smoothstep(52, 68, progress) * (kind < 0.18 ? 1 : 0),
      smoothstep(58 + seed * 16, 84, progress) * starShare
    );
    const spiralT = smoothstep(74, 100, progress);
    const densityT = smoothstep(72, 100, progress);
    const spiralBoost = THREE.MathUtils.lerp(0.18, 0.64, Math.max(spiralT, densityT * 0.85));
    const darkBase = 0.07 + (kind > 0.72 ? 0.04 : 0.01);
    const darkAlpha = darkBase + spiralBoost * 0.38;
    const galaxyAlpha = (kind < 0.72
      ? THREE.MathUtils.lerp(0.72 + seed * 0.16, 1.08 + seed * 0.08, Math.max(spiralT, densityT))
      : kind > 0.9 ? 0.08 + seed * 0.04
      : 0.22) + spiralBoost;
    const formedAlpha = THREE.MathUtils.lerp(darkAlpha, galaxyAlpha, kind < 0.72 ? ignition : formation * 0.72);
    return THREE.MathUtils.lerp(earlyGlow, formedAlpha, smoothstep(54, 68, progress));
  }

  const fromSpiral = smoothstep(90, 100, progress);
  return kind < 0.72
    ? THREE.MathUtils.lerp(1.28 + seed * 0.14, 1.12 + seed * 0.12, fromSpiral)
    : kind > 0.9 ? THREE.MathUtils.lerp(0.24, 0.18, fromSpiral)
    : THREE.MathUtils.lerp(0.52, 0.38, fromSpiral);
}

export function getParticleSize(progress: number, seed: number, kind: number) {
  const phase = getVisualPhase(progress);
  if (phase === 'big-bang') return 7 + seed * 12;
  const hot = smoothstep(4, 12, progress);
  const clear = smoothstep(22, 52, progress);
  const hotSize = THREE.MathUtils.lerp(22 + seed * 32, 34 + seed * 46, hot);
  const cooledSize = THREE.MathUtils.lerp(hotSize, 5 + seed * 6, clear);

  if (progress < 52) {
    return cooledSize;
  }

  const earlySize = THREE.MathUtils.lerp(cooledSize, 7 + seed * 7, smoothstep(52, 68, progress) * (kind < 0.18 ? 1 : 0));

  if (phase === 'atoms') return 5 + seed * 6;
  if (phase === 'dark-ages') return 5 + seed * 6;
  if (phase === 'first-stars' || phase === 'galaxies' || phase === 'spiral-clusters' || phase === 'cosmic-web') {
    const earlyStar = kind < 0.18;
    const galaxyStar = smoothstep(64, 80, progress);
    const starShare = earlyStar ? 1 : galaxyStar;
    const ignition = Math.max(
      smoothstep(52, 68, progress) * (kind < 0.18 ? 1 : 0),
      smoothstep(58 + seed * 12, 82, progress) * starShare
    );
    const spiralT = smoothstep(74, 100, progress);
    const densityT = smoothstep(72, 100, progress);
    const spiralBoost = THREE.MathUtils.lerp(1, 2.08, Math.max(spiralT, densityT * 0.8));
    const baseGalaxy = spiralBoost * (kind < 0.72 ? 3.8 + seed * 6.8 : kind > 0.9 ? 2.4 + seed * 2.4 : 2 + seed * 2.6);
    const coreBoost = kind < 0.15 ? 1 + spiralT * 1.4 : 1;
    const formedSize = THREE.MathUtils.lerp(3 + seed * 2.5, baseGalaxy * coreBoost, kind < 0.72 ? ignition : smoothstep(52, 84, progress) * 0.8);
    return THREE.MathUtils.lerp(earlySize, formedSize, smoothstep(54, 68, progress));
  }

  return kind < 0.72 ? 3.8 + seed * 6.8 : kind > 0.9 ? 2.4 + seed * 2.4 : 2 + seed * 2.6;
}
