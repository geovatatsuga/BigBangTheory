import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useUniverseStore } from '../store/useUniverseStore';
import { getVisualPhase, getVisualProfile, smoothstep } from '../utils/visualPhase';

const NUM_PARTICLES = 26000;
const BOUNDS = 820;
const VECTOR_COUNT = 34;
const PARTICLE_RAYCASTER = { params: { Points: { threshold: 7 } } } as any;

// Per-anchor galaxy types
// 0 = 2-arm grand spiral
// 1 = 3-arm spiral
// 2 = 4-arm spiral
// 3 = barred spiral (bar + 2 arms)
// 4 = elliptical (no arms)
// 5 = 5-arm irregular spiral
// 6 = ring / lenticular transition galaxy
type GalaxyType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type ParticleField = {
  positions: Float32Array;
  colors: Float32Array;
  alphas: Float32Array;
  sizes: Float32Array;
  seeds: Float32Array;
  basePositions: Float32Array;
  clusterCenters: Float32Array;
  kind: Float32Array;
  anchors: THREE.Vector3[];
  vectorIndices: number[];
  // Per-particle anchor index
  anchorIndex: Int32Array;
  // Per-anchor galaxy config (indexed by anchor index)
  anchorArms: Uint8Array;    // arm count
  anchorType: Uint8Array;    // GalaxyType
  anchorTwist: Float32Array; // arm tightness
  anchorTiltX: Float32Array; // disk tilt around X
  anchorTiltZ: Float32Array; // disk tilt around Z
  anchorHue: Float32Array;   // base colour hue (0..360)
  anchorScale: Float32Array; // radius scale multiplier
};

type GlowShaderMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uTime: { value: number };
    uPixelRatio: { value: number };
  };
};

type PlasmaShaderMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uTime: { value: number };
    uDensity: { value: number };
    uClearing: { value: number };
  };
};

type ShowcaseField = {
  count: number;
  positions: Float32Array;
  colors: Float32Array;
  alphas: Float32Array;
  sizes: Float32Array;
  seeds: Float32Array;
};

function makeGlowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
    },
    vertexShader: `
      attribute float alpha;
      attribute float size;
      attribute float seed;
      varying vec3 vColor;
      varying float vAlpha;

      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vAlpha = alpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 0.88 + 0.12 * sin(uTime * 2.0 + seed * 23.0);
        gl_PointSize = size * twinkle * uPixelRatio * (230.0 / max(36.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        if (dist > 0.5) discard;

        float core = smoothstep(0.42, 0.0, dist);
        float halo = smoothstep(0.5, 0.08, dist) * 0.42;
        float alpha = vAlpha * (core + halo);
        gl_FragColor = vec4(vColor * (1.0 + core * 0.9), alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }) as GlowShaderMaterial;
}

function makePlasmaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDensity: { value: 0 },
      uClearing: { value: 0 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vNormal;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDensity;
      uniform float uClearing;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        return mix(
          mix(
            mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
            mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
            f.y
          ),
          mix(
            mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
            mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
            f.y
          ),
          f.z
        );
      }

      float fbm(vec3 p) {
        float value = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 5; i++) {
          value += noise(p) * amp;
          p = p * 2.04 + vec3(8.2, 1.7, 4.4);
          amp *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 p = vWorldPosition * 0.012;
        p.xy += vec2(sin(uTime * 0.18), cos(uTime * 0.14)) * 0.7;
        p.z += uTime * 0.16;

        float cloud = fbm(p);
        float filaments = smoothstep(0.48, 0.82, fbm(p * 2.1 + vec3(2.0, uTime * 0.08, 0.0)));
        float hotCells = smoothstep(0.62, 0.92, cloud + filaments * 0.28);
        float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 0.65);
        float opacity = uDensity * (0.13 + cloud * 0.22 + filaments * 0.18 + rim * 0.14) * (1.0 - uClearing * 0.82);

        vec3 deepRed = vec3(0.42, 0.035, 0.012);
        vec3 plasmaOrange = vec3(1.0, 0.25, 0.045);
        vec3 whiteHot = vec3(1.0, 0.76, 0.34);
        vec3 color = mix(deepRed, plasmaOrange, cloud);
        color = mix(color, whiteHot, hotCells * (1.0 - uClearing * 0.6));
        color = mix(color, vec3(0.2, 0.5, 0.95), uClearing * 0.35);

        gl_FragColor = vec4(color, opacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  }) as PlasmaShaderMaterial;
}

// Deterministic seeded pseudo-random (LCG) — no globals needed
function lcg(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function createPlasmaMistField(): ShowcaseField {
  const count = 260;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const color = new THREE.Color();
  const rng = lcg(712);

  for (let i = 0; i < count; i++) {
    const base = i * 3;
    const radius = Math.pow(rng(), 0.58) * BOUNDS * 0.68;
    const angle = rng() * Math.PI * 2;
    const height = (rng() - 0.5) * BOUNDS * 0.34;
    const depth = (rng() - 0.5) * BOUNDS * 0.42;
    const seed = rng();

    positions[base] = Math.cos(angle) * radius + (rng() - 0.5) * 120;
    positions[base + 1] = height;
    positions[base + 2] = Math.sin(angle) * radius * 0.42 + depth;

    color.setHSL(0.01 + seed * 0.05, 0.95, 0.26 + seed * 0.24);
    colors[base] = color.r;
    colors[base + 1] = color.g;
    colors[base + 2] = color.b;

    alphas[i] = 0;
    sizes[i] = 180 + seed * 360;
    seeds[i] = seed;
  }

  return { count, positions, colors, alphas, sizes, seeds };
}

function createParticleField(): ParticleField {
  const positions    = new Float32Array(NUM_PARTICLES * 3);
  const colors       = new Float32Array(NUM_PARTICLES * 3);
  const alphas       = new Float32Array(NUM_PARTICLES);
  const sizes        = new Float32Array(NUM_PARTICLES);
  const seeds        = new Float32Array(NUM_PARTICLES);
  const basePositions = new Float32Array(NUM_PARTICLES * 3);
  const clusterCenters = new Float32Array(NUM_PARTICLES * 3);
  const kind         = new Float32Array(NUM_PARTICLES);
  const anchorIndex  = new Int32Array(NUM_PARTICLES).fill(-1);

  // ---- galactic anchors distributed across the full volume ----
  // Lay them on a loose Fibonacci lattice in 3-D for even coverage then jitter
  const NUM_ANCHORS = 60;
  const anchors: THREE.Vector3[] = [];
  const anchorArms   = new Uint8Array(NUM_ANCHORS);
  const anchorType   = new Uint8Array(NUM_ANCHORS);
  const anchorTwist  = new Float32Array(NUM_ANCHORS);
  const anchorTiltX  = new Float32Array(NUM_ANCHORS);
  const anchorTiltZ  = new Float32Array(NUM_ANCHORS);
  const anchorHue    = new Float32Array(NUM_ANCHORS);
  const anchorScale  = new Float32Array(NUM_ANCHORS);

  // Galaxy type palette — varied but realistic
  const GALAXY_CONFIGS: Array<{ type: GalaxyType; arms: number; twist: number }> = [
    { type: 0, arms: 2, twist: 0.052 }, // grand design 2-arm
    { type: 0, arms: 2, twist: 0.038 }, // loose 2-arm
    { type: 1, arms: 3, twist: 0.046 }, // 3-arm spiral M33-like
    { type: 1, arms: 3, twist: 0.065 }, // tight 3-arm
    { type: 2, arms: 4, twist: 0.044 }, // 4-arm Milky Way-like
    { type: 2, arms: 4, twist: 0.058 }, // tighter 4-arm
    { type: 3, arms: 2, twist: 0.042 }, // barred spiral
    { type: 3, arms: 2, twist: 0.035 }, // barred with wide bar
    { type: 4, arms: 1, twist: 0 },     // elliptical
    { type: 4, arms: 1, twist: 0 },     // elliptical (compact)
    { type: 5, arms: 5, twist: 0.048 }, // 5-arm flocculent
    { type: 0, arms: 2, twist: 0.06  }, // tight grand design
    { type: 6, arms: 1, twist: 0.018 }, // lenticular/ring
    { type: 6, arms: 1, twist: 0.026 }, // warmer ring galaxy
    { type: 1, arms: 3, twist: 0.032 }, // loose diffuse spiral
    { type: 2, arms: 4, twist: 0.072 }, // compact tight spiral
  ];

  const rng = lcg(42); // deterministic layout
  const hues = [220, 45, 280, 170, 340, 30, 200, 260, 90, 320, 15, 180, 120, 350, 240, 55, 205, 12, 300, 155,
                305, 175, 48, 265, 10, 190, 315, 160, 330, 70, 285, 52, 308, 168, 5, 215, 275, 145, 325, 65];

  for (let a = 0; a < NUM_ANCHORS; a++) {
    // Fibonacci sphere mapping for even distribution
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const phi = Math.acos(1 - 2 * (a + 0.5) / NUM_ANCHORS);
    const theta = 2 * Math.PI * a / goldenRatio;
    const r = BOUNDS * (0.28 + rng() * 0.36); // keep away from extreme edges
    const jx = (rng() - 0.5) * BOUNDS * 0.18;
    const jy = (rng() - 0.5) * BOUNDS * 0.18;
    const jz = (rng() - 0.5) * BOUNDS * 0.18;
    anchors.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * r + jx,
      Math.cos(phi) * r * 0.72 + jy,       // slightly flattened vertically
      Math.sin(phi) * Math.sin(theta) * r + jz
    ));

    const cfg = GALAXY_CONFIGS[a % GALAXY_CONFIGS.length];
    anchorArms[a]  = cfg.arms;
    anchorType[a]  = cfg.type;
    anchorTwist[a] = cfg.twist + (rng() - 0.5) * 0.012;
    anchorTiltX[a] = (rng() - 0.5) * Math.PI * 0.55;
    anchorTiltZ[a] = (rng() - 0.5) * Math.PI * 0.35;
    anchorHue[a]   = hues[a % hues.length];
    anchorScale[a] = 0.58 + rng() * 1.18;  // broad variety: compact dwarfs through giant spirals
  }

  const vectorIndices: number[] = [];

  // Assign each particle to its nearest anchor
  // We do a fast approximate: assign randomly but weighted by inverse distance
  // Actually: just hash-assign, then set clusterCenter from anchor
  for (let i = 0; i < NUM_PARTICLES; i++) {
    const seed = Math.random();
    seeds[i] = seed;

    const inCluster = Math.random() < 0.91; // keep late galaxies visibly dense
    // pick anchor — prefer ones that haven't been filled yet by weighting
    const aIdx = Math.floor(Math.random() * NUM_ANCHORS);
    const anchor = anchors[aIdx];

    const theta2 = Math.random() * Math.PI * 2;
    const phi2   = Math.acos(Math.random() * 2 - 1);
    // Cluster radius varies by galaxy scale
    const clusterR = 48 * anchorScale[aIdx];
    const spreadR  = inCluster
      ? Math.pow(Math.random(), 1.8) * clusterR
      : Math.pow(Math.random(), 0.55) * BOUNDS * 0.52;

    let x = spreadR * Math.sin(phi2) * Math.cos(theta2);
    let y = spreadR * Math.sin(phi2) * Math.sin(theta2);
    let z = spreadR * Math.cos(phi2);

    if (inCluster) {
      x += anchor.x;
      y += anchor.y;
      z += anchor.z;
    }

    basePositions[i * 3]     = x;
    basePositions[i * 3 + 1] = y;
    basePositions[i * 3 + 2] = z;
    clusterCenters[i * 3]     = inCluster ? anchor.x : x;
    clusterCenters[i * 3 + 1] = inCluster ? anchor.y : y;
    clusterCenters[i * 3 + 2] = inCluster ? anchor.z : z;
    anchorIndex[i] = inCluster ? aIdx : -1;
    kind[i]  = inCluster ? Math.random() * 0.72 : 0.72 + Math.random() * 0.28;
    sizes[i] = 1;
    alphas[i] = 0;

    if (vectorIndices.length < VECTOR_COUNT && i > NUM_PARTICLES * 0.25 && Math.random() < 0.015) {
      vectorIndices.push(i);
    }
  }

  while (vectorIndices.length < VECTOR_COUNT) {
    vectorIndices.push(Math.floor(Math.random() * NUM_PARTICLES));
  }

  return {
    positions, colors, alphas, sizes, seeds, basePositions,
    clusterCenters, kind, anchors, vectorIndices,
    anchorIndex, anchorArms, anchorType, anchorTwist,
    anchorTiltX, anchorTiltZ, anchorHue, anchorScale
  };
}

function getScale(progress: number) {
  if (progress < 4) return 0.012;
  if (progress < 8) return THREE.MathUtils.lerp(0.012, 0.44, Math.pow(smoothstep(4, 8, progress), 0.22));
  if (progress < 12) return THREE.MathUtils.lerp(0.44, 0.68, smoothstep(8, 12, progress));
  if (progress < 22) return THREE.MathUtils.lerp(0.68, 0.86, smoothstep(12, 22, progress));
  // primeira estrelas (22→75): cresce suavemente até 0.98 sem plateto
  if (progress < 75) return 0.86 + smoothstep(22, 75, progress) * 0.12;
  return THREE.MathUtils.lerp(0.98, 1.12, smoothstep(75, 100, progress));
}

function applyPhaseColor(color: THREE.Color, progress: number, seed: number, kind: number) {
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

function getParticleAlpha(progress: number, seed: number, kind: number) {
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
    // ignition: começa mais tarde (seed*16 em vez de *12) e termina depois (78) para fade mais longo
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
    // alpha base das partículas escuras cresce gradualmente ao entrar em first-stars
    const darkBase = 0.07 + (kind > 0.72 ? 0.04 : 0.01);
    const darkAlpha = darkBase + spiralBoost * 0.38;
    const galaxyAlpha = (kind < 0.72
      ? THREE.MathUtils.lerp(0.72 + seed * 0.16, 1.08 + seed * 0.08, Math.max(spiralT, densityT))
      : kind > 0.9 ? 0.08 + seed * 0.04
      : 0.22) + spiralBoost;
    const formedAlpha = THREE.MathUtils.lerp(darkAlpha, galaxyAlpha, kind < 0.72 ? ignition : formation * 0.72);
    return THREE.MathUtils.lerp(earlyGlow, formedAlpha, smoothstep(54, 68, progress));
  }
  // cosmic-web: estrelas de galáxias mais brilhantes, web intergalática mais visível
  const fromSpiral = smoothstep(90, 100, progress);
  return kind < 0.72
    ? THREE.MathUtils.lerp(1.28 + seed * 0.14, 1.12 + seed * 0.12, fromSpiral)
    : kind > 0.9 ? THREE.MathUtils.lerp(0.24, 0.18, fromSpiral)
    : THREE.MathUtils.lerp(0.52, 0.38, fromSpiral);
}

function getParticleSize(progress: number, seed: number, kind: number) {
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
    // spiral-clusters: estrelas do braco muito maiores e mais brilhantes
    const spiralT = smoothstep(74, 100, progress);
    const densityT = smoothstep(72, 100, progress);
    const spiralBoost = THREE.MathUtils.lerp(1, 2.08, Math.max(spiralT, densityT * 0.8));
    const baseGalaxy = spiralBoost * (kind < 0.72 ? 3.8 + seed * 6.8 : kind > 0.9 ? 2.4 + seed * 2.4 : 2 + seed * 2.6);
    // core particles: even brighter in spiral-clusters
    const coreBoost = kind < 0.15 ? 1 + spiralT * 1.4 : 1;
    const formedSize = THREE.MathUtils.lerp(3 + seed * 2.5, baseGalaxy * coreBoost, kind < 0.72 ? ignition : smoothstep(52, 84, progress) * 0.8);
    return THREE.MathUtils.lerp(earlySize, formedSize, smoothstep(54, 68, progress));
  }
  return kind < 0.72 ? 3.8 + seed * 6.8 : kind > 0.9 ? 2.4 + seed * 2.4 : 2 + seed * 2.6;
}

function CosmicParticles({ field }: { field: ParticleField }) {
  const { progress, activeMode, observerIndex, setObserverIndex } = useUniverseStore();
  const pointsRef = useRef<THREE.Points>(null);
  const material = useMemo(() => makeGlowMaterial(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const anchorColor = useMemo(() => new THREE.Color(), []);
  const shouldRenderParticles = true;

  useFrame((state) => {
    if (!pointsRef.current || !shouldRenderParticles) return;

    material.uniforms.uTime.value = state.clock.elapsedTime;

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const colors = pointsRef.current.geometry.attributes.color.array as Float32Array;
    const alphas = pointsRef.current.geometry.attributes.alpha.array as Float32Array;
    const sizes = pointsRef.current.geometry.attributes.size.array as Float32Array;
    const scale = getScale(progress);
    const phase = getVisualPhase(progress);
    const time = state.clock.elapsedTime;
    const selected = observerIndex ?? Math.floor(NUM_PARTICLES * 0.38);
    const observerX = activeMode === 'centerless' ? field.basePositions[selected * 3] * scale : 0;
    const observerY = activeMode === 'centerless' ? field.basePositions[selected * 3 + 1] * scale : 0;
    const observerZ = activeMode === 'centerless' ? field.basePositions[selected * 3 + 2] * scale : 0;

    for (let i = 0; i < NUM_PARTICLES; i++) {
      const base = i * 3;
      const seed = field.seeds[i];
      const kind = field.kind[i];
      let bx = field.basePositions[base];
      let by = field.basePositions[base + 1];
      let bz = field.basePositions[base + 2];
      const pressure = smoothstep(0, 4, progress);
      const agitation = 1 + pressure * 2.4;
      const knot = 8 + Math.sin(time * 12 * agitation + seed * 50) * (2.5 + pressure * 4.5);
      const theta = seed * Math.PI * 2 * 19;
      const wobble = Math.sin(time * (13 + pressure * 18) + seed * 120);
      const shear = Math.sin(time * 21 + seed * 160) * pressure;
      const collapsePulse = 1 - Math.abs(Math.sin(time * 9.5 + seed * 9)) * pressure * 0.28;
      const clumpX = (Math.cos(theta + wobble * 0.62 + shear * 0.35) * knot + Math.sin(seed * 80 + time * 18) * (3 + pressure * 8)) * collapsePulse;
      const clumpY = (Math.sin(theta * 1.7 + wobble * 0.48) * knot * 0.72 + Math.cos(seed * 90 + time * 16) * (3 + pressure * 7)) * collapsePulse;
      const clumpZ = (Math.sin(theta + seed * 20 + shear * 0.45) * knot + Math.sin(seed * 70 + time * 19) * (3 + pressure * 8)) * collapsePulse;

      if (phase === 'big-bang') {
        bx = clumpX;
        by = clumpY;
        bz = clumpZ;
      }

      if (progress >= 4 && progress < 68) {
        const blast = smoothstep(4, 8, progress);
        const expansionTail = smoothstep(8, 22, progress);
        const cooling = smoothstep(22, 66, progress);
        // settle vai a 0 suavemente em 66 — radialStretch retorna a 1 juntos, sem salto
        const settle = 1 - smoothstep(48, 66, progress);
        const wave = Math.sin(seed * 24 + time * 7) * (10 * (1 - blast) + 2.5) * settle;
        const ignitionShock = Math.sin(seed * 40 + blast * Math.PI * 5) * (1 - blast) * 0.18 * settle;
        // radialStretch decai para 1 junto com settle — zero corte ao sair do bloco
        const radialStretch = 1 + (blast * 0.2 + expansionTail * 0.28 - cooling * 0.08 + ignitionShock) * settle;
        bx = THREE.MathUtils.lerp(clumpX, bx, blast) * radialStretch + bx * 0.018 * wave;
        by = THREE.MathUtils.lerp(clumpY, by, blast) * radialStretch + by * 0.012 * wave;
        bz = THREE.MathUtils.lerp(clumpZ, bz, blast) * radialStretch + bz * 0.018 * wave;

        const turbulence = smoothstep(5, 13, progress) * (1 - smoothstep(24, 66, progress) * 0.92);
        const jitter = THREE.MathUtils.lerp(0, 22, turbulence);
        const outward = 1 + expansionTail * 0.14 * (1 - cooling * 0.75) + Math.sin(seed * 18 + time * 1.4) * 0.025 * turbulence;
        bx = bx * outward + Math.sin(time * 2.1 + seed * 80) * jitter;
        by = by * outward + Math.cos(time * 1.9 + seed * 90) * jitter * 0.7;
        bz = bz * outward + Math.sin(time * 2.3 + seed * 70) * jitter;
      }

      if (progress >= 42 && progress < 70) {
        const calmDrift = 3 * (1 - smoothstep(52, 68, progress));
        const collapseDrift = 1.4 * smoothstep(56, 72, progress);
        const jitter = calmDrift + collapseDrift;
        bx += Math.sin(time * 2.1 + seed * 80) * jitter;
        by += Math.cos(time * 1.9 + seed * 90) * jitter * 0.7;
        bz += Math.sin(time * 2.3 + seed * 70) * jitter;
      }

      if (phase === 'first-stars' || phase === 'galaxies' || phase === 'spiral-clusters' || phase === 'cosmic-web') {
        const centerX = field.clusterCenters[base];
        const centerY = field.clusterCenters[base + 1];
        const centerZ = field.clusterCenters[base + 2];
        const formation = smoothstep(54, 94, progress);
        const mature    = smoothstep(64, 94, progress);
        const spiralT   = phase === 'spiral-clusters' ? smoothstep(74, 88, progress) : (phase === 'cosmic-web' ? 1 : 0);

        const rawDx = field.basePositions[base] - centerX;
        const rawDy = field.basePositions[base + 1] - centerY;
        const rawDz = field.basePositions[base + 2] - centerZ;

        // Collapse strength grows through phases
        const collapseStrength = kind < 0.72
          ? THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.22, 0.5, mature), 0.82, spiralT)
          : 0.08;
        const collapse = formation * collapseStrength;

        bx = THREE.MathUtils.lerp(bx, centerX, collapse);
        by = THREE.MathUtils.lerp(by, centerY, collapse);
        bz = THREE.MathUtils.lerp(bz, centerZ, collapse);

        if (kind < 0.72) {
          // Per-anchor galaxy configuration
          const aIdx        = field.anchorIndex[i];
          const gType       = aIdx >= 0 ? field.anchorType[aIdx]  : 2;
          const numArms     = aIdx >= 0 ? field.anchorArms[aIdx]  : 4;
          const twist       = aIdx >= 0 ? field.anchorTwist[aIdx] : 0.044;
          const tiltX       = aIdx >= 0 ? field.anchorTiltX[aIdx] : 0;
          const tiltZ       = aIdx >= 0 ? field.anchorTiltZ[aIdx] : 0;
          const gScale      = aIdx >= 0 ? field.anchorScale[aIdx] : 1.0;

          const spiralBoost = THREE.MathUtils.lerp(1, 1.55, spiralT) * gScale;
          const sourceRadius = Math.sqrt(rawDx * rawDx + rawDz * rawDz);
          const radius = THREE.MathUtils.clamp(sourceRadius * THREE.MathUtils.lerp(0.72, 0.98, mature), 6, 130) * spiralBoost;

          let gx = 0, gy = 0, gz = 0;

          if (gType === 4) {
            // Elliptical — no arms, just a triaxial blob
            const squash = 0.52 + seed * 0.36;
            const theta3  = seed * Math.PI * 2 * 17;
            const phi3    = Math.acos(Math.max(-1, Math.min(1, (seed * 2 - 1))));
            const er = Math.pow(seed, 0.55) * radius * 0.88;
            gx = er * Math.sin(phi3) * Math.cos(theta3);
            gy = er * Math.cos(phi3) * squash * 0.52;
            gz = er * Math.sin(phi3) * Math.sin(theta3) * 0.78;
          } else if (gType === 6) {
            // Lenticular/ring galaxy: compact core plus a broad stellar ring.
            const theta4 = seed * Math.PI * 2 * 23;
            const twistFactor = THREE.MathUtils.lerp(twist, twist * 1.25, spiralT);
            const ring = radius * THREE.MathUtils.lerp(0.42, 0.98, smoothstep(0.16, 0.92, seed));
            const ringNoise = Math.sin(seed * 140 + progress * 0.05) * THREE.MathUtils.lerp(6, 1.8, spiralT);
            gx = Math.cos(theta4 + radius * twistFactor) * ring + ringNoise;
            gy = rawDy * THREE.MathUtils.lerp(0.2, 0.035, spiralT);
            gz = Math.sin(theta4 + radius * twistFactor) * ring * THREE.MathUtils.lerp(0.5, 0.28, spiralT);
          } else {
            // Spiral family (grand, 3-arm, 4-arm, barred, 5-arm)
            const arm       = Math.floor(seed * numArms);
            const armOffset = arm * ((Math.PI * 2) / numArms);
            const twistFactor = THREE.MathUtils.lerp(twist, twist * 1.55, spiralT);
            const armNoise  = Math.sin(seed * 80 + progress * 0.08) * (1 - mature) * THREE.MathUtils.lerp(11, 2, spiralT);

            if (gType === 3) {
              // Barred spiral — inner core forms a elongated bar, outer arms spiral
              const barFraction = 0.38; // fraction of radius that is bar
              if (radius < sourceRadius * gScale * barFraction) {
                // Bar: elongate along one axis
                gx = radius * 1.6 * (seed - 0.5) * 2;
                gy = rawDy * THREE.MathUtils.lerp(0.22, 0.04, spiralT);
                gz = radius * 0.18 * (seed - 0.5) * 2;
              } else {
                const spin = armOffset + radius * twistFactor + formation * (0.42 + seed * 0.55);
                const diskR = radius * THREE.MathUtils.lerp(0.74, 1.02, mature);
                gx = Math.cos(spin) * diskR + armNoise;
                gy = rawDy * THREE.MathUtils.lerp(0.26, 0.05, spiralT);
                gz = Math.sin(spin) * diskR * THREE.MathUtils.lerp(0.55, 0.35, spiralT);
              }
            } else {
              // Standard spiral
              const spin  = armOffset + radius * twistFactor + formation * (0.48 + seed * 0.6);
              const diskR = radius * THREE.MathUtils.lerp(0.76, 1.04, mature);
              gx = Math.cos(spin) * diskR + armNoise;
              gy = rawDy * THREE.MathUtils.lerp(0.28, 0.045, spiralT);
              gz = Math.sin(spin) * diskR * THREE.MathUtils.lerp(0.56, 0.34, spiralT);
            }
          }

          // Apply per-galaxy disk tilt so they face different directions in 3D
          const cosTX = Math.cos(tiltX), sinTX = Math.sin(tiltX);
          const cosTZ = Math.cos(tiltZ), sinTZ = Math.sin(tiltZ);
          // Rotate around X
          const gy2 = gy * cosTX - gz * sinTX;
          const gz2 = gy * sinTX + gz * cosTX;
          // Rotate around Z
          const gx3 = gx * cosTZ - gy2 * sinTZ;
          const gy3 = gx * sinTZ + gy2 * cosTZ;
          const gz3 = gz2;

          const armPull = formation * smoothstep(54, 94, progress);
          bx = THREE.MathUtils.lerp(bx, centerX + gx3, armPull);
          by = THREE.MathUtils.lerp(by, centerY + gy3, armPull * 0.85);
          bz = THREE.MathUtils.lerp(bz, centerZ + gz3, armPull);
        }
      }

      let x = bx * scale;
      let y = by * scale;
      let z = bz * scale;

      if (activeMode === 'centerless') {
        x -= observerX;
        y -= observerY;
        z -= observerZ;
      }

      positions[base] = x;
      positions[base + 1] = y;
      positions[base + 2] = z;
      applyPhaseColor(color, progress, seed, kind);
      const colorAnchor = field.anchorIndex[i];
      if (colorAnchor >= 0 && progress >= 58) {
        const hue = field.anchorHue[colorAnchor] / 360;
        const baseWarmth = smoothstep(58, 92, progress);
        // na cosmic-web as cores das galáxias ficam muito mais vivas e distintas
        const cosmicBoost = smoothstep(85, 100, progress) * 0.5;
        const anchorWarmth = Math.min(0.88, baseWarmth + cosmicBoost) * (kind < 0.72 ? 0.58 : 0.18);
        const anchorLight = kind < 0.16 ? 0.78 : kind < 0.72 ? 0.58 + seed * 0.22 : 0.18 + seed * 0.12;
        const anchorSat = kind < 0.72 ? 0.82 : 0.38;
        color.lerp(anchorColor.setHSL(hue, anchorSat, anchorLight), anchorWarmth);
      }

      if (activeMode === 'centerless' && i === selected) {
        color.set('#22c55e');
        alphas[i] = 1;
        sizes[i] = 18;
      } else {
        alphas[i] = getParticleAlpha(progress, seed, kind);
        sizes[i] = getParticleSize(progress, seed, kind);
      }

      colors[base] = color.r;
      colors[base + 1] = color.g;
      colors[base + 2] = color.b;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;
    pointsRef.current.geometry.attributes.alpha.needsUpdate = true;
    pointsRef.current.geometry.attributes.size.needsUpdate = true;
  });

  if (!shouldRenderParticles) return null;

  return (
    <points
      ref={pointsRef}
      material={material}
      onPointerDown={(event) => {
        if (activeMode !== 'centerless') return;
        event.stopPropagation();
        if (typeof event.index === 'number') setObserverIndex(event.index);
      }}
    >
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={NUM_PARTICLES} array={field.positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={NUM_PARTICLES} array={field.colors} itemSize={3} />
        <bufferAttribute attach="attributes-alpha" count={NUM_PARTICLES} array={field.alphas} itemSize={1} />
        <bufferAttribute attach="attributes-size" count={NUM_PARTICLES} array={field.sizes} itemSize={1} />
        <bufferAttribute attach="attributes-seed" count={NUM_PARTICLES} array={field.seeds} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function SceneBackground() {
  const { progress } = useUniverseStore();
  const { scene } = useThree();
  const color = useMemo(() => new THREE.Color(), []);
  const coolingStart = useMemo(() => new THREE.Color('#120805'), []);
  const coolingEnd = useMemo(() => new THREE.Color('#01030a'), []);
  const dawnEnd = useMemo(() => new THREE.Color('#030713'), []);

  useFrame(() => {
    const profile = getVisualProfile(progress);
    if (progress >= 22 && progress < 52) {
      color.lerpColors(coolingStart, coolingEnd, smoothstep(22, 52, progress));
    } else if (progress >= 52 && progress < 70) {
      color.lerpColors(coolingEnd, dawnEnd, smoothstep(52, 70, progress));
    } else {
      const target =
        profile.light > 0.85 ? '#070712' :
        profile.gas > 0.85 ? '#120805' :
        getVisualPhase(progress) === 'dark-ages' ? '#01030a' :
        '#030713';
      color.set(target);
    }
    scene.background = color.clone();
  });

  return null;
}

function PlasmaFog() {
  const { progress, activeMode } = useUniverseStore();
  const material = useMemo(() => makeGlowMaterial(), []);
  const field = useMemo(() => createPlasmaMistField(), []);
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime * 0.35;

    if (!pointsRef.current) return;
    const ignition = smoothstep(4, 9, progress);
    const dense = smoothstep(7, 18, progress);
    const cooling = smoothstep(22, 58, progress);
    const fadeOut = 1 - smoothstep(44, 60, progress);
    const density = activeMode === 'timeline' ? Math.max(ignition * 0.78, dense) * fadeOut : 0;
    const alphas = pointsRef.current.geometry.attributes.alpha.array as Float32Array;

    for (let i = 0; i < field.count; i++) {
      const seed = field.seeds[i];
      const pulse = 0.78 + Math.sin(state.clock.elapsedTime * (0.08 + seed * 0.08) + seed * 20) * 0.22;
      alphas[i] = density * pulse * (0.085 + seed * 0.11) * (1 - cooling * 0.42);
    }

    pointsRef.current.rotation.y = -state.clock.elapsedTime * 0.006;
    pointsRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.035) * 0.025;
    pointsRef.current.geometry.attributes.alpha.needsUpdate = true;
  });

  if (activeMode !== 'timeline' || progress < 3.5 || progress > 60) return null;

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={field.count} array={field.positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={field.count} array={field.colors} itemSize={3} />
        <bufferAttribute attach="attributes-alpha" count={field.count} array={field.alphas} itemSize={1} />
        <bufferAttribute attach="attributes-size" count={field.count} array={field.sizes} itemSize={1} />
        <bufferAttribute attach="attributes-seed" count={field.count} array={field.seeds} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

// ── Background star-field: dense tiny stars fading in from first-stars phase ──
const BG_STAR_COUNT = 18000;
const bgStarData = (() => {
  const positions = new Float32Array(BG_STAR_COUNT * 3);
  const colors    = new Float32Array(BG_STAR_COUNT * 3);
  const sizes     = new Float32Array(BG_STAR_COUNT);
  const alphas    = new Float32Array(BG_STAR_COUNT);
  const seeds     = new Float32Array(BG_STAR_COUNT);
  const color     = new THREE.Color();
  const rng       = lcg(9371);
  for (let i = 0; i < BG_STAR_COUNT; i++) {
    const seed  = rng();
    seeds[i]    = seed;
    const theta = rng() * Math.PI * 2;
    const phi   = Math.acos(rng() * 2 - 1);
    const r     = BOUNDS * (0.52 + rng() * 0.48);
    positions[i * 3]     = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    const warm = seed > 0.74;
    color.setHSL(warm ? 0.08 : 0.6 + seed * 0.06, warm ? 0.5 : 0.38, 0.82 + seed * 0.18);
    colors[i * 3]     = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i]  = 0.7 + seed * 1.8;
    alphas[i] = 0;
  }
  return { positions, colors, sizes, alphas, seeds };
})();

function BackgroundStarField() {
  const { progress } = useUniverseStore();
  const pointsRef = useRef<THREE.Points>(null);
  const material  = useMemo(() => makeGlowMaterial(), []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    const arr = pointsRef.current.geometry.attributes.alpha.array as Float32Array;
    const base = smoothstep(62, 84, progress);
    for (let i = 0; i < BG_STAR_COUNT; i++) {
      const s = bgStarData.seeds[i];
      const twinkle = 0.82 + Math.sin(state.clock.elapsedTime * (1.1 + s * 2.6) + s * 47) * 0.18;
      arr[i] = base * (0.28 + s * 0.52) * twinkle;
    }
    pointsRef.current.geometry.attributes.alpha.needsUpdate = true;
  });

  if (smoothstep(62, 84, progress) <= 0.01) return null;
  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={BG_STAR_COUNT} array={bgStarData.positions} itemSize={3} />
        <bufferAttribute attach="attributes-color"    count={BG_STAR_COUNT} array={bgStarData.colors}    itemSize={3} />
        <bufferAttribute attach="attributes-alpha"    count={BG_STAR_COUNT} array={bgStarData.alphas}    itemSize={1} />
        <bufferAttribute attach="attributes-size"     count={BG_STAR_COUNT} array={bgStarData.sizes}     itemSize={1} />
        <bufferAttribute attach="attributes-seed"     count={BG_STAR_COUNT} array={bgStarData.seeds}     itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

// ── Nebula clouds: large colorful gaseous puffs floating between galaxies ──
const NEBULA_COUNT = 420;
const nebulaData = (() => {
  const positions = new Float32Array(NEBULA_COUNT * 3);
  const colors    = new Float32Array(NEBULA_COUNT * 3);
  const sizes     = new Float32Array(NEBULA_COUNT);
  const alphas    = new Float32Array(NEBULA_COUNT);
  const seeds     = new Float32Array(NEBULA_COUNT);
  const color     = new THREE.Color();
  const rng       = lcg(3141);
  const nebHues   = [0.78, 0.85, 0.52, 0.65, 0.0, 0.12, 0.72, 0.43, 0.92, 0.33, 0.58, 0.22, 0.96, 0.48];
  for (let i = 0; i < NEBULA_COUNT; i++) {
    const seed  = rng();
    seeds[i]    = seed;
    const theta = rng() * Math.PI * 2;
    const phi   = Math.acos(rng() * 2 - 1);
    const r     = BOUNDS * (0.14 + rng() * 0.66);
    positions[i * 3]     = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r * 0.58;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    const hue = nebHues[Math.floor(rng() * nebHues.length)];
    color.setHSL(hue, 0.88 + rng() * 0.12, 0.42 + rng() * 0.38);
    colors[i * 3]     = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i]  = 260 + rng() * 520;
    alphas[i] = 0;
  }
  return { positions, colors, sizes, alphas, seeds };
})();

function CosmicNebulaField() {
  const { progress } = useUniverseStore();
  const pointsRef = useRef<THREE.Points>(null);
  const material  = useMemo(() => makeGlowMaterial(), []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    material.uniforms.uTime.value = state.clock.elapsedTime * 0.10;
    const arr    = pointsRef.current.geometry.attributes.alpha.array as Float32Array;
    const target = smoothstep(70, 92, progress);
    for (let i = 0; i < NEBULA_COUNT; i++) {
      const s     = nebulaData.seeds[i];
      const pulse = 0.80 + Math.sin(state.clock.elapsedTime * (0.055 + s * 0.07) + s * 31) * 0.20;
      arr[i]      = target * (0.011 + s * 0.017) * pulse;
    }
    pointsRef.current.geometry.attributes.alpha.needsUpdate = true;
  });

  if (smoothstep(70, 92, progress) <= 0.01) return null;
  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={NEBULA_COUNT} array={nebulaData.positions} itemSize={3} />
        <bufferAttribute attach="attributes-color"    count={NEBULA_COUNT} array={nebulaData.colors}    itemSize={3} />
        <bufferAttribute attach="attributes-alpha"    count={NEBULA_COUNT} array={nebulaData.alphas}    itemSize={1} />
        <bufferAttribute attach="attributes-size"     count={NEBULA_COUNT} array={nebulaData.sizes}     itemSize={1} />
        <bufferAttribute attach="attributes-seed"     count={NEBULA_COUNT} array={nebulaData.seeds}     itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

const coreFragments = [
  { position: [0, 0, 0] as [number, number, number], color: '#fff7ad', radius: 3.2 },
  { position: [3.8, -1.2, 1.7] as [number, number, number], color: '#ff8a3d', radius: 2.3 },
  { position: [-3.1, 1.6, -1.9] as [number, number, number], color: '#fef3c7', radius: 2.6 },
  { position: [1.2, 2.9, -3.2] as [number, number, number], color: '#93c5fd', radius: 1.8 }
];

function BigBangCore() {
  const { progress } = useUniverseStore();
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const visibility = Math.max(0, 1 - smoothstep(2.6, 8.5, progress));

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const pressure = smoothstep(0, 4, progress);
    const instability = 1 + Math.sin(time * (11 + pressure * 18)) * (0.1 + pressure * 0.22) + Math.sin(time * 23.3) * (0.04 + pressure * 0.08);
    const inflationKick = 1 + smoothstep(4, 7.8, progress) * 3.2;

    if (groupRef.current) {
      groupRef.current.rotation.x = Math.sin(time * (2.4 + pressure * 4.5)) * (0.45 + pressure * 0.35);
      groupRef.current.rotation.y = time * (1.35 + pressure * 3.4);
      groupRef.current.rotation.z = Math.cos(time * (1.7 + pressure * 4.2)) * (0.32 + pressure * 0.42);
      groupRef.current.scale.setScalar(instability * inflationKick);
    }

    if (glowRef.current) {
      glowRef.current.scale.setScalar((1.2 + pressure * 1.4 + smoothstep(4, 8, progress) * 8.5) * instability);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = visibility * 0.16;
    }
  });

  if (visibility <= 0.01) return null;

  return (
    <group>
      <mesh ref={glowRef}>
        <sphereGeometry args={[5.5, 32, 32]} />
        <meshBasicMaterial color="#fef3c7" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <group ref={groupRef}>
        {coreFragments.map((fragment, index) => (
          <mesh key={fragment.color} position={fragment.position} rotation={[index * 0.7, index * 1.1, index * 0.45]}>
            <icosahedronGeometry args={[fragment.radius, 1]} />
            <meshBasicMaterial color={fragment.color} transparent opacity={visibility * 0.88} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
        <mesh rotation={[0.8, 0.2, 1.3]}>
          <torusKnotGeometry args={[4.6, 0.45, 72, 8, 2, 3]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={visibility * 0.38} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function TransitionEffects() {
  const { progress } = useUniverseStore();
  const inflationFlashRef = useRef<THREE.Mesh>(null);
  const inflationFlash = smoothstep(3, 4.7, progress) * (1 - smoothstep(6, 9.5, progress));

  useFrame((state) => {
    if (inflationFlashRef.current) {
      const blast = smoothstep(3, 9.5, progress);
      inflationFlashRef.current.scale.setScalar(0.35 + blast * 16);
      inflationFlashRef.current.rotation.y = state.clock.elapsedTime * 0.35;
      (inflationFlashRef.current.material as THREE.MeshBasicMaterial).opacity = inflationFlash * 0.16;
    }
  });

  return (
    <>
      {inflationFlash > 0.01 && (
        <mesh ref={inflationFlashRef}>
          <sphereGeometry args={[18, 42, 42]} />
          <meshBasicMaterial color="#facc15" transparent opacity={inflationFlash * 0.16} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}

    </>
  );
}

function CenterlessExpansionVectors({ field }: { field: ParticleField }) {
  const { activeMode, progress, observerIndex } = useUniverseStore();
  const lineRef = useRef<THREE.LineSegments>(null);
  const positions = useMemo(() => new Float32Array(VECTOR_COUNT * 6), []);
  const selected = observerIndex ?? Math.floor(NUM_PARTICLES * 0.38);

  useFrame(() => {
    if (!lineRef.current || activeMode !== 'centerless') return;
    const scale = getScale(progress);
    const obs = new THREE.Vector3(
      field.basePositions[selected * 3],
      field.basePositions[selected * 3 + 1],
      field.basePositions[selected * 3 + 2]
    ).multiplyScalar(scale);

    field.vectorIndices.forEach((idx, vectorIndex) => {
      const base = idx * 3;
      const target = new THREE.Vector3(field.basePositions[base], field.basePositions[base + 1], field.basePositions[base + 2]).multiplyScalar(scale).sub(obs);
      const dir = target.clone().normalize();
      const start = target.clone().multiplyScalar(0.86);
      const end = target.clone().add(dir.multiplyScalar(14));
      const p = vectorIndex * 6;
      positions[p] = start.x;
      positions[p + 1] = start.y;
      positions[p + 2] = start.z;
      positions[p + 3] = end.x;
      positions[p + 4] = end.y;
      positions[p + 5] = end.z;
    });

    lineRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (activeMode !== 'centerless') return null;

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={VECTOR_COUNT * 2} array={positions} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#60a5fa" transparent opacity={0.65} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

type ShowcaseGalaxyConfig = {
  count: number;
  arms: number;
  radius: number;
  depth: number;
  twist: number;
  core: number;
  elliptical?: boolean;
  hueShift: number;
};

function createShowcaseGalaxy(config: ShowcaseGalaxyConfig): ShowcaseField {
  const count = config.count;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const base = i * 3;
    const seed = Math.random();
    const radius = Math.pow(Math.random(), config.elliptical ? 1.9 : 0.62) * config.radius;
    const core = 1 - Math.min(1, radius / config.core);
    const dustLane = !config.elliptical && Math.random() < 0.16;
    const thickness = Math.max(2, config.depth - radius * 0.055);

    if (config.elliptical) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const squash = 0.48 + seed * 0.22;
      positions[base] = Math.sin(phi) * Math.cos(theta) * radius * 1.25;
      positions[base + 1] = Math.cos(phi) * radius * squash * 0.62;
      positions[base + 2] = Math.sin(phi) * Math.sin(theta) * radius * 0.82;
    } else {
      const arm = i % config.arms;
      const armAngle = arm * ((Math.PI * 2) / config.arms);
      const swirl = radius * config.twist;
      const noise = (Math.random() - 0.5) * (0.42 + radius * 0.007);
      const angle = armAngle + swirl + noise;
      positions[base] = Math.cos(angle) * radius + (Math.random() - 0.5) * thickness;
      positions[base + 1] = (Math.random() - 0.5) * (dustLane ? 5 : thickness);
      positions[base + 2] = Math.sin(angle) * radius * (0.32 + seed * 0.16) + (Math.random() - 0.5) * thickness;
    }

    if (dustLane) {
      color.setHSL(0.08, 0.42, 0.2 + seed * 0.12);
      alphas[i] = 0.2 + seed * 0.18;
      sizes[i] = 4 + seed * 7;
    } else if (core > 0.25) {
      color.setHSL(0.1 + config.hueShift * 0.04, 0.9, 0.62 + core * 0.2);
      alphas[i] = 0.55 + core * 0.38;
      sizes[i] = 5 + core * 12 + seed * 3;
    } else {
      const blueStar = seed > 0.62;
      color.setHSL(blueStar ? 0.58 + config.hueShift * 0.035 : 0.08 + config.hueShift * 0.04, blueStar ? 0.82 : 0.88, blueStar ? 0.74 : 0.62);
      alphas[i] = 0.28 + seed * 0.52;
      sizes[i] = 2.4 + seed * 6.5;
    }

    colors[base] = color.r;
    colors[base + 1] = color.g;
    colors[base + 2] = color.b;
    seeds[i] = seed;
  }

  return { count, positions, colors, alphas, sizes, seeds };
}

function ShowcaseGalaxy({
  visible,
  config,
  position,
  rotation,
  scale = 1,
  drift = 1
}: {
  visible: number;
  config: ShowcaseGalaxyConfig;
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
  drift?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const material = useMemo(() => makeGlowMaterial(), []);
  const field = useMemo(() => createShowcaseGalaxy(config), [config]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    if (!groupRef.current) return;
    groupRef.current.rotation.x = rotation[0] + Math.sin(state.clock.elapsedTime * 0.045 * drift) * 0.024;
    groupRef.current.rotation.y = rotation[1] + Math.sin(state.clock.elapsedTime * 0.06 * drift) * 0.028;
    groupRef.current.rotation.z = rotation[2] + state.clock.elapsedTime * 0.0035 * drift;
    groupRef.current.scale.setScalar(visible * scale);
  });

  if (visible <= 0.01) return null;

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={visible * scale}>
      <points material={material}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={field.count} array={field.positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={field.count} array={field.colors} itemSize={3} />
          <bufferAttribute attach="attributes-alpha" count={field.count} array={field.alphas} itemSize={1} />
          <bufferAttribute attach="attributes-size" count={field.count} array={field.sizes} itemSize={1} />
          <bufferAttribute attach="attributes-seed" count={field.count} array={field.seeds} itemSize={1} />
        </bufferGeometry>
      </points>
    </group>
  );
}

function LocalSolarReference({ visible, progress }: { visible: number; progress: number }) {
  if (visible <= 0.01) return null;

  return (
    <group position={[152, -34, 54]} rotation={[0.95, 0, -0.08]} scale={visible * 0.18}>
      <mesh>
        <sphereGeometry args={[7, 32, 32]} />
        <meshBasicMaterial color="#fde047" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {[18, 28, 41, 56].map((radius, index) => (
        <group key={radius}>
          <mesh>
            <torusGeometry args={[radius, 0.16, 8, 128]} />
            <meshBasicMaterial color="#94a3b8" transparent opacity={0.1} depthWrite={false} />
          </mesh>
          <mesh position={[Math.cos(index * 1.7 + progress * 0.035) * radius, Math.sin(index * 1.7 + progress * 0.035) * radius, 0]}>
            <sphereGeometry args={[index === 2 ? 2.2 : index === 3 ? 1.8 : 1.4, 16, 16]} />
            <meshBasicMaterial color={index === 2 ? '#3b82f6' : index === 3 ? '#ef4444' : index === 1 ? '#e2e8f0' : '#a7f3d0'} transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const showcaseGalaxies = [
  {
    position: [-70, 0, 10] as [number, number, number],
    rotation: [1.05, -0.34, -0.14] as [number, number, number],
    scale: 1.22,
    drift: 1,
    config: { count: 7600, arms: 4, radius: 108, depth: 12, twist: 0.055, core: 58, hueShift: 0 }
  },
  {
    position: [104, 26, -110] as [number, number, number],
    rotation: [0.55, 0.75, 0.38] as [number, number, number],
    scale: 0.48,
    drift: -0.7,
    config: { count: 3200, arms: 3, radius: 74, depth: 9, twist: 0.074, core: 40, hueShift: 0.5 }
  },
  {
    position: [158, -38, 18] as [number, number, number],
    rotation: [1.22, -0.18, -0.78] as [number, number, number],
    scale: 0.34,
    drift: 0.85,
    config: { count: 2400, arms: 2, radius: 68, depth: 10, twist: 0.046, core: 42, hueShift: -0.3 }
  },
  {
    position: [-176, 44, -72] as [number, number, number],
    rotation: [0.35, -0.95, 0.42] as [number, number, number],
    scale: 0.48,
    drift: 0.55,
    config: { count: 3000, arms: 5, radius: 70, depth: 8, twist: 0.082, core: 38, hueShift: 0.15 }
  },
  {
    position: [18, 72, -170] as [number, number, number],
    rotation: [0.2, 0.25, 0.05] as [number, number, number],
    scale: 0.56,
    drift: -0.35,
    config: { count: 3400, arms: 3, radius: 62, depth: 20, twist: 0.02, core: 50, elliptical: true, hueShift: -0.6 }
  },
  {
    position: [-36, -56, -142] as [number, number, number],
    rotation: [1.36, 0.4, 0.92] as [number, number, number],
    scale: 0.26,
    drift: 1.25,
    config: { count: 2200, arms: 2, radius: 54, depth: 7, twist: 0.095, core: 30, hueShift: 0.35 }
  },
  // extra galaxies for richer cosmic-web final phase
  {
    position: [42, -88, -160] as [number, number, number],
    rotation: [-0.42, 0.68, 1.15] as [number, number, number],
    scale: 0.38,
    drift: -0.9,
    config: { count: 2800, arms: 4, radius: 76, depth: 9, twist: 0.048, core: 40, hueShift: 1.2 }
  },
  {
    position: [-124, 58, 138] as [number, number, number],
    rotation: [0.78, -1.12, 0.55] as [number, number, number],
    scale: 0.44,
    drift: 0.65,
    config: { count: 4400, arms: 2, radius: 96, depth: 14, twist: 0.038, core: 54, hueShift: -0.8 }
  },
  {
    position: [190, 22, 62] as [number, number, number],
    rotation: [-0.85, 0.32, -1.4] as [number, number, number],
    scale: 0.28,
    drift: 1.1,
    config: { count: 1800, arms: 3, radius: 52, depth: 22, twist: 0.018, core: 44, elliptical: true, hueShift: 0.6 }
  },
  {
    position: [-52, -74, 168] as [number, number, number],
    rotation: [1.58, -0.24, 0.85] as [number, number, number],
    scale: 0.50,
    drift: -0.45,
    config: { count: 3800, arms: 5, radius: 84, depth: 10, twist: 0.068, core: 46, hueShift: -0.4 }
  },
  {
    position: [76, 110, -88] as [number, number, number],
    rotation: [0.48, 1.34, -0.62] as [number, number, number],
    scale: 0.32,
    drift: 0.78,
    config: { count: 2400, arms: 3, radius: 60, depth: 8, twist: 0.072, core: 32, hueShift: 0.9 }
  }
];

function ScaleJourney() {
  const { progress, activeMode } = useUniverseStore();
  const groupRef = useRef<THREE.Group>(null);
  // Showcase galaxies: aparecem a partir de spiral-clusters (68%) e ficam até o fim
  const visibleBase = activeMode === 'timeline'
    ? smoothstep(68, 84, progress)
    : 0;
  const visible = visibleBase;

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = -8 + Math.sin(state.clock.elapsedTime * 0.45) * 1.6;
    groupRef.current.position.z = 104;
    groupRef.current.scale.setScalar(visible * 1.3);
  });

  if (visible <= 0.01) return null;

  return (
    <group ref={groupRef} position={[0, -8, 104]}>
      {showcaseGalaxies.map((galaxy, index) => (
        <ShowcaseGalaxy
          key={index}
          visible={visible}
          config={galaxy.config}
          position={galaxy.position}
          rotation={galaxy.rotation}
          scale={galaxy.scale}
          drift={galaxy.drift}
        />
      ))}
      <LocalSolarReference visible={visible * smoothstep(96, 100, progress)} progress={progress} />
    </group>
  );
}

function CameraDirector() {
  const { progress, activeMode } = useUniverseStore();
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useFrame((state) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (activeMode === 'centerless') {
      controls.enabled = true;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.autoRotate = false;
      controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.08);
      controls.update();
      return;
    }

    const profile = getVisualProfile(progress);
    const orbit = state.clock.elapsedTime * 0.12;
    const lateOrbit = smoothstep(72, 90, progress);
    const x = Math.sin(orbit) * THREE.MathUtils.lerp(18, 42, lateOrbit);
    const y = 16 + Math.sin(orbit * 0.7) * 10;
    const z = profile.cameraDistance;

    controls.enabled = progress > 62;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.autoRotate = progress > 72;
    controls.autoRotateSpeed = 0.06;
    camera.position.lerp(new THREE.Vector3(x, y, z), 0.032);
    controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.05);
    controls.update();
  });

  return <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.07} minDistance={55} maxDistance={820} />;
}

function CinematicHud() {
  const { progress, activeMode } = useUniverseStore();
  const profile = getVisualProfile(progress);

  if (activeMode === 'centerless') {
    return (
      <div className="scene-caption absolute left-6 top-6 z-10 max-w-sm px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.24em] text-blue-300">Comparacao de observadores</div>
        <div className="mt-1 text-xs text-slate-200">Clique em outra galaxia para recentralizar.</div>
      </div>
    );
  }

  return (
    <>
      <div className="scene-caption absolute left-6 top-6 z-10 max-w-md px-3 py-2 text-slate-200">
        <div className="flex items-center gap-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-blue-300">{profile.scaleLabel}</div>
          <div className="font-mono text-[10px] text-slate-400">{Math.round(progress)}%</div>
        </div>
        <div className="mt-1 text-lg font-semibold text-white">{profile.title}</div>
        <p className="mt-1 text-xs leading-5 text-slate-300">{profile.caption}</p>
      </div>
      <div className="scene-caption absolute right-6 top-6 z-10 hidden w-56 px-3 py-2 text-xs text-slate-300 md:block">
        <div className="mb-2 border-b border-blue-200/10 pb-2 text-[10px] uppercase tracking-[0.22em] text-blue-300">Status cosmico</div>
        <div className="flex justify-between gap-4 py-1"><span>Luz</span><span className="font-mono text-slate-100">{Math.round(profile.light * 100)}%</span></div>
        <div className="flex justify-between gap-4 py-1"><span>Gas</span><span className="font-mono text-slate-100">{Math.round(profile.gas * 100)}%</span></div>
        <div className="flex justify-between gap-4 py-1"><span>Estrelas</span><span className="font-mono text-slate-100">{Math.round(profile.stars * 100)}%</span></div>
      </div>
    </>
  );
}

function CenterlessMarker() {
  const { activeMode } = useUniverseStore();
  if (activeMode !== 'centerless') return null;

  return (
    <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap font-mono text-[10px] tracking-widest text-green-400 mt-8">
      [ VOCE E O OBSERVADOR ]
    </div>
  );
}

export default function UniverseSimulator() {
  const field = useMemo(() => createParticleField(), []);

  return (
    <div className="absolute inset-0 z-0 h-full w-full bg-transparent">
      <Canvas
        camera={{ position: [0, 16, 150], fov: 58 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        raycaster={PARTICLE_RAYCASTER}
      >
        <SceneBackground />
        <ambientLight intensity={0.5} />
        <BigBangCore />
        <PlasmaFog />
        <BackgroundStarField />
        <CosmicNebulaField />
        <TransitionEffects />
        <CosmicParticles field={field} />
        <CenterlessExpansionVectors field={field} />
        <CameraDirector />
      </Canvas>
      <CenterlessMarker />
      <CinematicHud />
    </div>
  );
}
