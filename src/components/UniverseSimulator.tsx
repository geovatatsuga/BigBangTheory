import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useUniverseStore } from '../store/useUniverseStore';
import { getVisualPhase, getVisualProfile, smoothstep } from '../utils/visualPhase';
import CameraDirector from './universe/CameraDirector';
import { CenterlessMarker, CinematicHud } from './universe/SceneHud';
import { applyPhaseColor, getParticleAlpha, getParticleSize, getScale } from './universe/particleAppearance';
import { BloomPostProcessing, CosmicVolumetricNebulae, CosmicWebFilaments, StromgrenBubbles } from './universe/CosmicEffects';

const NUM_PARTICLES = 18000;
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
    uRedshift: { value: number };
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
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uRedshift: { value: 0 },
      uProgress: { value: 0 },
      uIsNebula: { value: 0 }
    },
    vertexShader: `
      attribute float alpha;
      attribute float size;
      attribute float seed;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vDist;
      varying float vSeed;

      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vAlpha = alpha;
        vSeed = seed;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vDist = -mvPosition.z;
        float twinkle = 0.88 + 0.12 * sin(uTime * 2.0 + seed * 23.0);
        gl_PointSize = size * twinkle * uPixelRatio * (230.0 / max(36.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vDist;
      varying float vSeed;

      uniform float uRedshift;
      uniform float uProgress;
      uniform float uTime;
      uniform float uIsNebula;

      vec3 applyRedshift(vec3 col, float z) {
        float stretch = 1.0 + z;
        vec3 shifted;
        shifted.r = col.r + col.g * z * 0.4 + col.b * z * 0.6;
        shifted.g = col.g * (1.0 - z * 0.3) + col.b * z * 0.15;
        shifted.b = col.b * (1.0 - z * 0.7);
        float dimming = 1.0 / (1.0 + z * z * 0.15);
        return max(shifted * dimming, vec3(0.0));
      }

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        
        // Morfologia das Partículas
        float shape = 0.0;
        
        // Forma difusa (gás / plasma inicial)
        float gasShape = smoothstep(0.5, 0.0, dist);
        
        // Forma estelar (pontos com raios)
        float core = smoothstep(0.15, 0.0, dist);
        float spikes = max(0.0, 1.0 - abs(uv.x) * 15.0) * max(0.0, 1.0 - abs(uv.y) * 2.0)
                     + max(0.0, 1.0 - abs(uv.y) * 15.0) * max(0.0, 1.0 - abs(uv.x) * 2.0);
        float starShape = core + spikes * 0.2 * smoothstep(0.5, 0.2, dist);

        if (uIsNebula > 0.5) {
          // Nebulosas são sempre nuvens difusas de gás
          shape = gasShape;
        } else {
          // Partículas regulares (átomos que viram estrelas)
          if (uProgress < 22.0) {
            shape = gasShape * 0.8; // Energia fluida
          } else {
            // Transição suave de Gás difuso para Estrelas afiadas durante o Alvorecer Cósmico (48-65%)
            float starMix = smoothstep(48.0, 65.0, uProgress);
            shape = mix(gasShape, starShape, starMix);
          }
        }

        if (dist > 0.5) discard;
        float alpha = vAlpha * shape;
        vec3 col = vColor * (1.0 + (uProgress < 22.0 ? 0.8 : 0.2));

        float z = clamp(vDist / 900.0, 0.0, 1.8) * uRedshift;
        col = applyRedshift(col, z);
        gl_FragColor = vec4(col, alpha);
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

function CosmicParticles({ field }: { field: ParticleField }) {
  const { progress, activeMode, observerIndex, setObserverIndex } = useUniverseStore();
  const pointsRef = useRef<THREE.Points>(null);
  const material = useMemo(() => makeGlowMaterial(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const anchorColor = useMemo(() => new THREE.Color(), []);
  const lastAppearanceRef = useRef({ progress: -999, activeMode: '', selected: -1 });
  const shouldRenderParticles = true;

  useFrame((state) => {
    if (!pointsRef.current || !shouldRenderParticles) return;

    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uProgress.value = progress;
    // Cosmological redshift: ativa mais cedo e mais forte
    material.uniforms.uRedshift.value = smoothstep(60, 82, progress) * 1.4;

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const colors = pointsRef.current.geometry.attributes.color.array as Float32Array;
    const alphas = pointsRef.current.geometry.attributes.alpha.array as Float32Array;
    const sizes = pointsRef.current.geometry.attributes.size.array as Float32Array;
    const scale = getScale(progress);
    const phase = getVisualPhase(progress);
    const time = state.clock.elapsedTime;
    const selected = observerIndex ?? Math.floor(NUM_PARTICLES * 0.38);
    const lastAppearance = lastAppearanceRef.current;
    const shouldUpdateAppearance =
      Math.abs(progress - lastAppearance.progress) > 0.35 ||
      lastAppearance.activeMode !== activeMode ||
      lastAppearance.selected !== selected;
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

      if (phase === 'big-bang' || phase === 'plasma') {
        // Movimento fluido e viscoso de redemoinho (Sopa de Quarks)
        const flowStrength = 1.0 - smoothstep(18, 24, progress);
        const flowTime = time * 0.8;
        const swirlX = Math.sin(flowTime + seed * 10.0 + bz * 0.05) * 8.0 * flowStrength;
        const swirlY = Math.cos(flowTime + seed * 12.0 + bx * 0.05) * 8.0 * flowStrength;
        const swirlZ = Math.sin(flowTime + seed * 14.0 + by * 0.05) * 8.0 * flowStrength;
        
        bx += swirlX;
        by += swirlY;
        bz += swirlZ;
        
        if (phase === 'big-bang') {
          bx += Math.sin(theta + wobble * 0.62) * knot;
          by += Math.sin(theta * 1.7 + wobble * 0.48) * knot;
          bz += Math.sin(theta + seed * 20) * knot;
        }
      }

      if (progress >= 4 && progress < 68) {
        const turbulence = smoothstep(5, 22, progress) * (1 - smoothstep(24, 66, progress) * 0.92);
        const jitter = THREE.MathUtils.lerp(0, 42, turbulence); // Aumentado o jitter
        bx += Math.sin(time * 2.1 + seed * 80) * jitter;
        by += Math.cos(time * 1.9 + seed * 90) * jitter * 0.7;
        bz += Math.sin(time * 2.3 + seed * 70) * jitter;
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

          const spiralBoost  = THREE.MathUtils.lerp(1, 1.72, spiralT) * gScale;
          const sourceRadius = Math.sqrt(rawDx * rawDx + rawDz * rawDz);
          const radius = THREE.MathUtils.clamp(sourceRadius * THREE.MathUtils.lerp(0.72, 0.98, mature), 4, 150) * spiralBoost;
          const bulgeRadius = 14 * gScale;
          const inBulge = radius < bulgeRadius;

          let gx = 0, gy = 0, gz = 0;

          if (gType === 4) {
            // Elliptical
            const squash = 0.48 + seed * 0.32;
            const theta3  = seed * Math.PI * 2 * 17;
            const phi3    = Math.acos(Math.max(-1, Math.min(1, seed * 2 - 1)));
            const er = Math.pow(seed, 0.62) * radius * 0.92;
            gx = er * Math.sin(phi3) * Math.cos(theta3);
            gy = er * Math.cos(phi3) * squash * 0.45;
            gz = er * Math.sin(phi3) * Math.sin(theta3) * 0.74;
          } else if (gType === 6) {
            // Lenticular/ring
            const theta4 = seed * Math.PI * 2 * 23;
            const twistFactor = THREE.MathUtils.lerp(twist, twist * 1.3, spiralT);
            const ring = radius * THREE.MathUtils.lerp(0.38, 1.02, smoothstep(0.2, 0.95, seed));
            const ringWidth = Math.sin(seed * 140 + progress * 0.05) * THREE.MathUtils.lerp(5, 1.4, spiralT);
            gx = Math.cos(theta4 + radius * twistFactor) * ring + ringWidth;
            gy = inBulge ? rawDy * 0.28 : rawDy * THREE.MathUtils.lerp(0.18, 0.022, spiralT);
            gz = Math.sin(theta4 + radius * twistFactor) * ring * THREE.MathUtils.lerp(0.48, 0.22, spiralT) + ringWidth * 0.3;
          } else if (inBulge) {
            // Bulge central esférico — núcleo brilhante para todos os espirais
            const theta5 = seed * Math.PI * 2 * 13;
            const phi5   = Math.acos(Math.max(-1, Math.min(1, seed * 2 - 1)));
            const br = Math.pow(seed, 0.45) * radius;
            gx = br * Math.sin(phi5) * Math.cos(theta5);
            gy = br * Math.cos(phi5) * 0.68;
            gz = br * Math.sin(phi5) * Math.sin(theta5) * 0.72;
          } else {
            // Spirais — braços mais compactos e definidos
            const arm       = Math.floor(seed * numArms);
            const armOffset = arm * ((Math.PI * 2) / numArms);
            const twistFactor = THREE.MathUtils.lerp(twist, twist * 1.68, spiralT);
            const looseness = Math.pow(Math.min(1, radius / (80 * gScale)), 1.2);
            const feather   = (seed - 0.5) * THREE.MathUtils.lerp(0.28, 0.07, spiralT) * looseness * radius;
            const armNoise  = Math.sin(seed * 80 + progress * 0.08) * (1 - mature) * THREE.MathUtils.lerp(9, 1.2, spiralT);

            if (gType === 3) {
              // Barred spiral
              const barFraction = 0.36;
              if (radius < sourceRadius * gScale * barFraction) {
                gx = radius * 1.7 * (seed - 0.5) * 2;
                gy = rawDy * THREE.MathUtils.lerp(0.2, 0.032, spiralT);
                gz = radius * 0.16 * (seed - 0.5) * 2;
              } else {
                const spin = armOffset + radius * twistFactor + formation * (0.42 + seed * 0.55);
                const diskR = radius * THREE.MathUtils.lerp(0.74, 1.04, mature);
                gx = Math.cos(spin) * diskR + feather + armNoise;
                gy = rawDy * THREE.MathUtils.lerp(0.24, 0.032, spiralT);
                gz = Math.sin(spin) * diskR * THREE.MathUtils.lerp(0.52, 0.28, spiralT) + feather * 0.4;
              }
            } else {
              // Standard spiral
              const spin  = armOffset + radius * twistFactor + formation * (0.48 + seed * 0.6);
              const diskR = radius * THREE.MathUtils.lerp(0.76, 1.06, mature);
              gx = Math.cos(spin) * diskR + feather + armNoise;
              gy = rawDy * THREE.MathUtils.lerp(0.26, 0.026, spiralT);
              gz = Math.sin(spin) * diskR * THREE.MathUtils.lerp(0.54, 0.24, spiralT) + feather * 0.45;
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
      if (shouldUpdateAppearance) {
      applyPhaseColor(color, progress, seed, kind);
      const colorAnchor = field.anchorIndex[i];
      if (colorAnchor >= 0 && progress >= 58) {
        const hue = field.anchorHue[colorAnchor] / 360;
        const baseWarmth = smoothstep(58, 92, progress);
        const cosmicBoost = smoothstep(82, 100, progress) * 0.65;
        const anchorWarmth = Math.min(0.95, baseWarmth + cosmicBoost) * (kind < 0.72 ? 0.78 : 0.22);
        // Core quente/amarelo, braços com cor do anchor, HII em azul/rosa
        const isCore = kind < 0.12;
        const isArm  = kind < 0.48;
        const anchorLight = isCore ? 0.82 + seed * 0.14
          : isArm  ? 0.55 + seed * 0.28
          : kind < 0.72 ? 0.42 + seed * 0.32
          : 0.16 + seed * 0.10;
        const anchorSat = isCore ? 0.75 : kind < 0.72 ? 0.92 : 0.42;
        // Regiões HII: pontos brilhantes azul/rosa nos braços espirais
        const hiiChance = seed > 0.86 && kind < 0.55;
        const finalHue = hiiChance ? (seed > 0.93 ? 0.60 : 0.95) : hue;
        color.lerp(anchorColor.setHSL(finalHue, hiiChance ? 0.98 : anchorSat, hiiChance ? 0.70 + seed * 0.18 : anchorLight), anchorWarmth);
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
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    if (shouldUpdateAppearance) {
      pointsRef.current.geometry.attributes.color.needsUpdate = true;
      pointsRef.current.geometry.attributes.alpha.needsUpdate = true;
      pointsRef.current.geometry.attributes.size.needsUpdate = true;
      lastAppearanceRef.current = { progress, activeMode, selected };
    }
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

// ═══════════════════════════════════════════════════════════════════
//    CMB (Radiação Cósmica de Fundo)
//    O "eco" do Big Bang visível no momento da transparência.
// ═══════════════════════════════════════════════════════════════════

function CosmicBackgroundRadiation() {
  const { progress } = useUniverseStore();
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;

        // Procedural CMB-like noise
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
                     mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0; float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * noise(p); p *= 2.0; a *= 0.5;
          }
          return v;
        }

        void main() {
          if (uOpacity <= 0.01) discard;
          
          vec2 uv = vUv * 4.0;
          float n = fbm(uv + uTime * 0.01);
          
          // Cores clássicas do mapa Planck (Azul, Amarelo, Vermelho sutil)
          vec3 blue = vec3(0.05, 0.15, 0.4);
          vec3 yellow = vec3(0.6, 0.45, 0.1);
          vec3 red = vec3(0.4, 0.1, 0.05);
          
          vec3 color = mix(blue, yellow, n);
          color = mix(color, red, smoothstep(0.7, 1.0, n));
          
          gl_FragColor = vec4(color * 0.6, uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
  }, []);

  useFrame((state) => {
    // Aparece entre 22% e 32%, com pico na transparência em 38%
    // Sofre redshift e desaparece na Idade das Trevas (38% - 48%)
    const fadeIn = smoothstep(22, 32, progress);
    const fadeOut = 1.0 - smoothstep(38, 48, progress);
    material.uniforms.uOpacity.value = fadeIn * fadeOut * 0.75; // Aumentado para o CMB dominar a transparência
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

function SceneBackground() {
  const { progress, activeMode } = useUniverseStore();
  const { scene } = useThree();
  
  // Cores baseadas na temperatura do universo (Planck/Wien)
  const plasmaHot = useMemo(() => new THREE.Color('#ffffff'), []); // 10^32 K
  const plasmaWarm = useMemo(() => new THREE.Color('#ffcc66'), []); // ~10^6 K
  const plasmaCool = useMemo(() => new THREE.Color('#cc3300'), []); // ~3000 K (antes da recombinação)
  const darkAges = useMemo(() => new THREE.Color('#010102'), []); // CMB cooling to IR
  const voidBlack = useMemo(() => new THREE.Color('#000000'), []); // Universo atual
  
  const bgColor = useMemo(() => new THREE.Color(), []);

  // Setup fog
  if (!scene.fog) {
    scene.fog = new THREE.FogExp2('#ffffff', 0);
  }

  useFrame(() => {
    // Calcular a cor de fundo (temperatura do universo)
    if (progress < 4) {
      bgColor.copy(plasmaHot);
    } else if (progress < 12) {
      bgColor.lerpColors(plasmaHot, plasmaWarm, smoothstep(4, 12, progress));
    } else if (progress < 22) {
      bgColor.lerpColors(plasmaWarm, plasmaCool, smoothstep(12, 22, progress));
    } else if (progress < 42) {
      bgColor.lerpColors(plasmaCool, darkAges, smoothstep(22, 42, progress));
    } else if (progress < 70) {
      bgColor.lerpColors(darkAges, voidBlack, smoothstep(42, 70, progress));
    } else {
      bgColor.copy(voidBlack); // Fundo sempre preto no final (gostei do preto)
    }
    
    scene.background = bgColor.clone();

    // Calcular a densidade do fog (opacidade do universo)
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(bgColor);
      if (activeMode !== 'timeline') {
         scene.fog.density = 0;
      } else {
         if (progress < 22) {
           scene.fog.density = 0.04; // Levemente reduzido para ver a "sopa"
         } else if (progress < 38) {
           // Fog dissipa muito mais rápido (Fiat Lux completo em 38%)
           // Reduzimos a densidade para o CMB brilhar atrás
           const dissipate = 1.0 - smoothstep(22, 38, progress);
           scene.fog.density = 0.025 * dissipate; 
         } else {
           scene.fog.density = 0.0; // Transparente
         }
      }
    }
  });

  return null;
}

// ═══════════════════════════════════════════════════════════════════
//    Sopa de Quarks (Distorção Fluida)
//    Simula a viscosidade do plasma primordial.
// ═══════════════════════════════════════════════════════════════════

// PlasmaFluidDistortion removido pois prejudicava a estética volumétrica.

// ═══════════════════════════════════════════════════════════════════
//    Lentes Gravitacionais Primordiais
//    Distorção do espaço em torno de halos de matéria escura.
// ═══════════════════════════════════════════════════════════════════

function PrimordialLensing({ anchors }: { anchors: THREE.Vector3[] }) {
  const { progress } = useUniverseStore();
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uAnchors: { value: anchors.slice(0, 8).map(a => new THREE.Vector3().copy(a)) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uProgress;
        uniform vec3 uAnchors[8];
        varying vec2 vUv;

        void main() {
          // Aparece apenas durante as eras escuras e formação de galáxias
          float intensity = smoothstep(42, 55, uProgress) * (1.0 - smoothstep(75, 95, uProgress));
          if (intensity <= 0.01) discard;

          vec2 uv = vUv;
          vec2 distortion = vec2(0.0);
          
          for (int i = 0; i < 8; i++) {
            // Projetar posição do anchor (simplificado para distorção em tela)
            vec2 anchorPos = (uAnchors[i].xy * 0.002) + 0.5;
            vec2 dir = uv - anchorPos;
            float dist = length(dir);
            
            // Perfil de lente gravitacional (distorção Einstein)
            float force = intensity * 0.015 / (dist + 0.05);
            distortion += normalize(dir) * force * smoothstep(0.4, 0.0, dist);
          }

          // Visualizamos a distorção como um "shimmer" no vácuo
          float shimmer = sin(uTime * 2.0 + (uv.x + uv.y) * 20.0) * 0.05 * intensity;
          gl_FragColor = vec4(vec3(0.1, 0.2, 0.5) * intensity, length(distortion) * 0.8 + shimmer);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [anchors]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uProgress.value = progress;
  });

  return (
    <mesh material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

function PlasmaFog() {
  const { progress, activeMode } = useUniverseStore();
  const material = useMemo(() => makeGlowMaterial(), []);
  const field = useMemo(() => createPlasmaMistField(), []);
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime * 0.35;

    if (!pointsRef.current) return;
    const ignition = smoothstep(2, 6, progress);
    const dense = smoothstep(4, 12, progress);
    const cooling = smoothstep(22, 32, progress);
    const fadeOut = 1 - smoothstep(28, 38, progress); // Some COMPLETAMENTE aos 38% (Transparência total)
    const density = activeMode === 'timeline' ? Math.max(ignition * 0.95, dense) * fadeOut : 0;
    const alphas = pointsRef.current.geometry.attributes.alpha.array as Float32Array;

    for (let i = 0; i < field.count; i++) {
      const seed = field.seeds[i];
      // Movimento mais fluido e "viscoso"
      const flow = Math.sin(state.clock.elapsedTime * 0.2 + seed * 10.0) * 0.5 + 0.5;
      const pulse = 0.78 + Math.sin(state.clock.elapsedTime * (0.08 + seed * 0.08) + seed * 20.0 + flow * 2.0) * 0.22;
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
const BG_STAR_COUNT = 9000;
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
  const lastProgressRef = useRef(-999);

  useFrame((state) => {
    if (!pointsRef.current) return;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    if (Math.abs(progress - lastProgressRef.current) < 0.3) return;

    const arr = pointsRef.current.geometry.attributes.alpha.array as Float32Array;
    const base = smoothstep(62, 84, progress);
    for (let i = 0; i < BG_STAR_COUNT; i++) {
      const s = bgStarData.seeds[i];
      arr[i] = base * (0.3 + s * 0.58);
    }
    pointsRef.current.geometry.attributes.alpha.needsUpdate = true;
    lastProgressRef.current = progress;
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
const NEBULA_COUNT = 240;
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
  // Usa o glowMaterial com suporte a Progresso para mudar as cores (Redshift -> Visível)
  const material  = useMemo(() => makeGlowMaterial(), []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    material.uniforms.uTime.value = state.clock.elapsedTime * 0.10;
    material.uniforms.uProgress.value = progress;
    material.uniforms.uIsNebula.value = 1.0; // Diz ao shader para não transformar essas partículas em estrelas

    // Na idade das trevas (36-48%) o gás é escuro/infravermelho. No alvorecer (48-65%) ele se ilumina pelas estrelas.
    const redshiftIn = smoothstep(36, 44, progress);
    const redshiftOut = 1.0 - smoothstep(48, 65, progress);
    material.uniforms.uRedshift.value = redshiftIn * redshiftOut * 2.5;

    const arr    = pointsRef.current.geometry.attributes.alpha.array as Float32Array;
    // O gás surge na idade das trevas e se mantém até o fim, sendo "consumido" parcialmente
    const born = smoothstep(36, 46, progress);
    const consume = 1.0 - smoothstep(75, 100, progress) * 0.4; // Elas não somem, apenas reduzem de densidade nas galáxias

    for (let i = 0; i < NEBULA_COUNT; i++) {
      const s     = nebulaData.seeds[i];
      const pulse = 0.80 + Math.sin(state.clock.elapsedTime * (0.055 + s * 0.07) + s * 31) * 0.20;
      
      // Na idade das trevas o gás é mais difuso. No alvorecer ele brilha muito mais (iluminado pelas estrelas).
      const phaseBoost = THREE.MathUtils.lerp(0.005, 0.022, smoothstep(48, 65, progress));
      arr[i]      = born * consume * (phaseBoost + s * 0.020) * pulse;
    }
    pointsRef.current.geometry.attributes.alpha.needsUpdate = true;
  });

  if (smoothstep(36, 46, progress) <= 0.01) return null;
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

function makeImmersivePlasmaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1.0 },
      uProgress: { value: 0.0 }
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uProgress;
      varying vec3 vPosition;

      // Funções de ruído Simplex 3D otimizadas
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
      float snoise(vec3 v) {
        const vec2  C = vec2(1.0/6.0, 1.0/3.0);
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute( permute( permute(
                   i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                 + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                 + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
      }

      // Paleta épica de plasma termal
      vec3 getPlasmaColor(float t, float progress) {
          // Fase 1: Singularity/Inflation (Extremamente quente, branco/azulado para púrpura)
          vec3 ultraHot = mix(vec3(0.5, 0.1, 0.9), vec3(1.0, 1.0, 1.0), t * t);
          // Fase 2: Plasma esfriando (Laranja, amarelo incandescente)
          vec3 warmPlasma = mix(vec3(0.8, 0.1, 0.0), vec3(1.0, 0.9, 0.4), t);
          
          float mixPhase = clamp(progress / 12.0, 0.0, 1.0);
          return mix(ultraHot, warmPlasma, mixPhase);
      }

      void main() {
        vec3 dir = normalize(vPosition);
        
        // Movimento orgânico e viscoso
        float time = uTime * 0.15;
        vec3 warp = vec3(
          snoise(dir * 1.5 + time),
          snoise(dir * 1.5 - time + 10.0),
          snoise(dir * 1.5 + time * 0.8 + 20.0)
        );
        
        // Noise principal para as correntes de plasma
        float n1 = snoise(dir * 2.0 + warp * 1.5 + time * 2.0);
        float n2 = snoise(dir * 4.0 - warp + time * 3.0) * 0.5;
        float n3 = snoise(dir * 8.0 + warp * 0.5 - time * 1.5) * 0.25;
        
        float noise = (n1 + n2 + n3);
        // Remapeia ruído para destacar os fios/filamentos de plasma
        float plasmaEnergy = clamp(noise * 0.5 + 0.5, 0.0, 1.0);
        plasmaEnergy = smoothstep(0.1, 0.9, plasmaEnergy);

        vec3 color = getPlasmaColor(plasmaEnergy, uProgress);

        // Alpha intenso nas correntes, mais fraco no fundo para dar volumetria
        float alpha = clamp(plasmaEnergy * 1.2, 0.0, 1.0) * uOpacity;

        // Efeito de vinheta para concentrar a luz
        float vignette = 1.0 - smoothstep(0.4, 1.5, length(dir.xy));
        color *= vignette;

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

function BigBangCore() {
  const { progress } = useUniverseStore();
  const material = useMemo(() => makeImmersivePlasmaMaterial(), []);
  
  // O plasma fluido/viscoso dura até a transparência (38%) e some gradativamente
  const visibility = 1.0 - smoothstep(18, 38, progress);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uOpacity.value = visibility * 0.8;
    material.uniforms.uProgress.value = progress;
  });

  if (visibility <= 0.01) return null;

  return (
    <mesh>
      <sphereGeometry args={[400, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
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
      <LocalSolarReference visible={visible * smoothstep(90, 96, progress)} progress={progress} />
    </group>
  );
}


export default function UniverseSimulator() {
  const field = useMemo(() => createParticleField(), []);

  return (
    <div className="absolute inset-0 z-0 h-full w-full bg-transparent">
      <Canvas
        camera={{ position: [0, 16, 150], fov: 58 }}
        dpr={[1, 1.35]}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        raycaster={PARTICLE_RAYCASTER}
      >
        <SceneBackground />
        <CosmicBackgroundRadiation />
        <ambientLight intensity={0.5} />
        <BigBangCore />
        <PlasmaFog />
        <BackgroundStarField />
        <CosmicNebulaField />
        <TransitionEffects />
        <CosmicParticles field={field} />
        <PrimordialLensing anchors={field.anchors} />
        <CosmicVolumetricNebulae anchors={field.anchors} />
        <StromgrenBubbles anchors={field.anchors} />
        <CosmicWebFilaments anchors={field.anchors} anchorScales={field.anchorScale} />
        <CenterlessExpansionVectors field={field} />
        <CameraDirector />
        <BloomPostProcessing />
      </Canvas>
      <CenterlessMarker />
      <CinematicHud />
    </div>
  );
}
