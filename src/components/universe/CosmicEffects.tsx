import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useUniverseStore } from '../../store/useUniverseStore';
import { smoothstep } from '../../utils/visualPhase';
import { getScale } from './particleAppearance';

// ═══════════════════════════════════════════════════════════════════
// 1) GRAVITATIONAL LENSING — Post-processing screen-space distortion
//    Physics: θ = 4GM/(rc²) — Einstein deflection angle
//    Approximation: UV distortion proportional to mass/distance
// ═══════════════════════════════════════════════════════════════════

function makeBloomMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null },
      uBloom: { value: 0 },
      uTexelSize: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;

      uniform sampler2D tScene;
      uniform float uBloom;
      uniform vec2 uTexelSize;

      varying vec2 vUv;

      void main() {
        vec4 sceneColor = texture2D(tScene, vUv);

        // ── Physical Bloom + Diffraction Spikes (Fourier optics / PSF) ──
        // 6 spikes = JWST hexagonal mirror support pattern
        vec3 bloom = vec3(0.0);
        if (uBloom > 0.01) {
          float PI = 3.14159265;
          for (int s = 0; s < 6; s++) {
            float angle = float(s) * PI / 3.0;
            vec2 dir = vec2(cos(angle), sin(angle));
            for (int j = 1; j < 20; j++) {
              float fj = float(j);
              vec2 offset = dir * fj * uTexelSize * 5.0;
              vec4 samp = texture2D(tScene, vUv + offset);
              float lum = dot(samp.rgb, vec3(0.2126, 0.7152, 0.0722));
              float bright = max(0.0, lum - 0.18);
              float weight = bright / (1.0 + fj * fj * 0.3);
              bloom += samp.rgb * weight;
              samp = texture2D(tScene, vUv - offset);
              lum = dot(samp.rgb, vec3(0.2126, 0.7152, 0.0722));
              bright = max(0.0, lum - 0.18);
              bloom += samp.rgb * bright / (1.0 + fj * fj * 0.3);
            }
          }
          bloom *= 0.12;
        }

        gl_FragColor = vec4(sceneColor.rgb + bloom * uBloom, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}

export function BloomPostProcessing() {
  const { gl, scene, camera, size } = useThree();
  const { progress, activeMode } = useUniverseStore();

  const rt = useMemo(() => {
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    return new THREE.WebGLRenderTarget(
      Math.floor(size.width * dpr),
      Math.floor(size.height * dpr),
      { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }
    );
  }, [size.width, size.height]);

  useEffect(() => () => rt.dispose(), [rt]);

  const postScene = useMemo(() => new THREE.Scene(), []);
  const postCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const material = useMemo(() => makeBloomMaterial(), []);

  useEffect(() => {
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    postScene.add(quad);
    return () => { postScene.remove(quad); quad.geometry.dispose(); };
  }, [postScene, material]);

  // Priority 1 = takes over R3F's render loop
  useFrame(() => {
    const bloomStrength = activeMode === 'timeline' ? smoothstep(62, 82, progress) : 0;

    if (bloomStrength < 0.01) {
      gl.render(scene, camera);
      return;
    }

    // 1. Render scene to texture
    gl.setRenderTarget(rt);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    // 2. Apply bloom
    material.uniforms.uBloom.value = bloomStrength;
    material.uniforms.uTexelSize.value.set(1 / rt.width, 1 / rt.height);
    material.uniforms.tScene.value = rt.texture;

    // 3. Render post-processed quad to screen
    gl.clear();
    gl.render(postScene, postCam);
  }, 1);

  return null;
}


// ═══════════════════════════════════════════════════════════════════
// 2) VOLUMETRIC NEBULAE — Raymarched 3D gas clouds
//    Physics: Radiative transfer equation with FBM noise density
//    Colors: Hα (pink/red 656nm), OIII (blue-green 496/501nm)
// ═══════════════════════════════════════════════════════════════════

const NEBULA_SHADER_VERT = `
  varying vec3 vWorldPos;

  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NEBULA_SHADER_FRAG = `
  precision highp float;

  uniform float uTime;
  uniform vec3 uCamPos;
  uniform float uOpacity;
  uniform float uHue;
  uniform vec3 uCenter;
  uniform float uRadius;

  varying vec3 vWorldPos;

  // ── Noise (compact 3D Perlin) ──
  float hash3(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
          mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
          mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 4; i++) {
      v += noise3(p) * a;
      p = p * 2.04 + shift;
      a *= 0.48;
    }
    return v;
  }

  // ── HSL to RGB ──
  vec3 hsl2rgb(float h, float s, float l) {
    vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
  }

  // ── Ray-sphere intersection ──
  vec2 raySphere(vec3 ro, vec3 rd, vec3 center, float r) {
    vec3 oc = ro - center;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - r * r;
    float h = b * b - c;
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
  }

  void main() {
    vec3 ro = uCamPos;
    vec3 rd = normalize(vWorldPos - uCamPos);

    // Intersect bounding sphere
    vec2 hit = raySphere(ro, rd, uCenter, uRadius);
    if (hit.x < 0.0 && hit.y < 0.0) discard;

    float tNear = max(hit.x, 0.0);
    float tFar  = hit.y;
    if (tFar < 0.0) discard;

    // ── Raymarch through volume ──
    const int STEPS = 20;
    float dt = (tFar - tNear) / float(STEPS);

    vec3 totalColor = vec3(0.0);
    float totalAlpha = 0.0;

    for (int i = 0; i < STEPS; i++) {
      float t = tNear + (float(i) + 0.5) * dt;
      vec3 p = ro + rd * t;

      // Local space: normalized to [-1, 1]
      vec3 localP = (p - uCenter) / uRadius;

      // Sample density with FBM noise
      float density = fbm(localP * 2.8 + uTime * 0.012);
      density = smoothstep(0.32, 0.68, density);

      // Edge falloff (spherical)
      float edge = 1.0 - smoothstep(0.4, 0.95, length(localP));
      density *= edge;

      if (density > 0.005) {
        // Emission color — physically motivated:
        // Hot/dense regions: Hα (pink) at 656nm
        // Cooler regions: OIII (blue-green) at 496nm
        // Mix based on density
        float hotness = smoothstep(0.3, 0.7, density);
        vec3 coolColor = hsl2rgb(uHue - 0.08, 0.82, 0.35);       // cooler gas
        vec3 warmColor = hsl2rgb(uHue, 0.92, 0.48 + hotness * 0.2); // emission peak
        vec3 hotColor  = hsl2rgb(uHue + 0.06, 0.75, 0.72);       // brightest cores
        vec3 col = mix(coolColor, warmColor, hotness);
        col = mix(col, hotColor, smoothstep(0.6, 0.9, density));

        // Front-to-back compositing
        float a = density * dt * 2.8;
        totalColor += (1.0 - totalAlpha) * col * a;
        totalAlpha += (1.0 - totalAlpha) * a;
      }

      if (totalAlpha > 0.92) break;
    }

    gl_FragColor = vec4(totalColor, totalAlpha * uOpacity);
  }
`;

type VolumetricNebulaMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uTime: { value: number };
    uCamPos: { value: THREE.Vector3 };
    uOpacity: { value: number };
    uHue: { value: number };
    uCenter: { value: THREE.Vector3 };
    uRadius: { value: number };
  };
};

function makeVolumetricNebulaMaterial(hue: number, radius: number): VolumetricNebulaMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCamPos: { value: new THREE.Vector3() },
      uOpacity: { value: 0 },
      uHue: { value: hue },
      uCenter: { value: new THREE.Vector3() },
      uRadius: { value: radius },
    },
    vertexShader: NEBULA_SHADER_VERT,
    fragmentShader: NEBULA_SHADER_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  }) as VolumetricNebulaMaterial;
}

// Nebula configurations — placed near star-forming anchors
const VOLUMETRIC_NEBULA_CONFIGS = [
  { anchorIdx: 3,  radius: 38, hue: 0.95 },  // Hα pink (like Orion)
  { anchorIdx: 11, radius: 32, hue: 0.58 },  // OIII blue-green
  { anchorIdx: 22, radius: 44, hue: 0.84 },  // Magenta emission
  { anchorIdx: 37, radius: 28, hue: 0.53 },  // Cyan-blue
  { anchorIdx: 50, radius: 34, hue: 0.92 },  // Deep pink-red
  { anchorIdx: 8,  radius: 30, hue: 0.62 },  // Blue (reflection nebula)
  { anchorIdx: 45, radius: 36, hue: 0.88 },  // Violet emission
];

function VolumetricNebula({ anchor, radius, hue, opacity }: {
  anchor: THREE.Vector3;
  radius: number;
  hue: number;
  opacity: number;
}) {
  const material = useMemo(() => makeVolumetricNebulaMaterial(hue, radius), [hue, radius]);
  const scale = getScale(useUniverseStore.getState().progress);

  useFrame((state) => {
    const { progress } = useUniverseStore.getState();
    const s = getScale(progress);
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uCamPos.value.copy(state.camera.position);
    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uCenter.value.set(anchor.x * s, anchor.y * s, anchor.z * s);
    material.uniforms.uRadius.value = radius * s * 0.14;
  });

  if (opacity <= 0.01) return null;

  return (
    <mesh
      position={[anchor.x * scale, anchor.y * scale, anchor.z * scale]}
      material={material}
    >
      <sphereGeometry args={[radius * scale * 0.14, 24, 12]} />
    </mesh>
  );
}

export function CosmicVolumetricNebulae({ anchors }: { anchors: THREE.Vector3[] }) {
  const { progress, activeMode } = useUniverseStore();
  const opacity = activeMode === 'timeline' ? smoothstep(72, 88, progress) * 0.28 : 0;

  if (opacity <= 0.01) return null;

  return (
    <>
      {VOLUMETRIC_NEBULA_CONFIGS.map((cfg, i) => {
        const anchor = anchors[Math.min(cfg.anchorIdx, anchors.length - 1)];
        return (
          <VolumetricNebula
            key={i}
            anchor={anchor}
            radius={cfg.radius}
            hue={cfg.hue}
            opacity={opacity}
          />
        );
      })}
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════
// 4) COSMIC WEB FILAMENTS — Dark matter filament connections
//    Physics: N-body derived large-scale structure
//    Each anchor connects to its 3 nearest neighbors with glowing threads
// ═══════════════════════════════════════════════════════════════════

const FILAMENT_PARTICLES_PER_LINK = 55;
const MAX_NEIGHBORS = 3;

function buildFilamentField(anchors: THREE.Vector3[], anchorScales: Float32Array) {
  // Build neighbor graph: each anchor connects to nearest 3
  const links: Array<[number, number]> = [];
  const seen = new Set<string>();

  for (let a = 0; a < anchors.length; a++) {
    // Find nearest neighbors
    const dists: Array<{ idx: number; dist: number }> = [];
    for (let b = 0; b < anchors.length; b++) {
      if (a === b) continue;
      dists.push({ idx: b, dist: anchors[a].distanceTo(anchors[b]) });
    }
    dists.sort((x, y) => x.dist - y.dist);

    for (let n = 0; n < MAX_NEIGHBORS && n < dists.length; n++) {
      const b = dists[n].idx;
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      if (seen.has(key)) continue;
      // Skip very long connections (voids)
      if (dists[n].dist > 520) continue;
      seen.add(key);
      links.push([a, b]);
    }
  }

  const count = links.length * FILAMENT_PARTICLES_PER_LINK;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const color = new THREE.Color();
  const rng = lcgSimple(7777);

  let idx = 0;
  for (const [a, b] of links) {
    const pa = anchors[a];
    const pb = anchors[b];
    const combinedMass = (anchorScales[a] + anchorScales[b]) * 0.5;

    for (let p = 0; p < FILAMENT_PARTICLES_PER_LINK; p++) {
      const t = (p + 0.5) / FILAMENT_PARTICLES_PER_LINK;
      const seed = rng();
      seeds[idx] = seed;

      // Catenary-like sag + noise perpendicular to the link
      const sag = Math.sin(t * Math.PI) * (15 + seed * 20);
      const noiseX = (rng() - 0.5) * (12 + seed * 18);
      const noiseY = (rng() - 0.5) * (8 + seed * 14) - sag * 0.3;
      const noiseZ = (rng() - 0.5) * (12 + seed * 18);

      const base = idx * 3;
      positions[base]     = pa.x + (pb.x - pa.x) * t + noiseX;
      positions[base + 1] = pa.y + (pb.y - pa.y) * t + noiseY + sag * 0.15;
      positions[base + 2] = pa.z + (pb.z - pa.z) * t + noiseZ;

      // Dark matter filament color: blue-purple, visible
      const h = 0.60 + seed * 0.12;
      color.setHSL(h, 0.48 + seed * 0.35, 0.38 + seed * 0.28);
      colors[base] = color.r;
      colors[base + 1] = color.g;
      colors[base + 2] = color.b;

      // Brighter near anchor endpoints, dimmer in middle
      const endFade = 1.0 - Math.sin(t * Math.PI) * 0.4;
      alphas[idx] = (0.14 + seed * 0.16) * combinedMass * endFade;
      sizes[idx] = 1.8 + seed * 3.2;
      idx++;
    }
  }

  return { count: idx, positions, colors, alphas, sizes, seeds };
}

// Simple LCG for deterministic filament generation
function lcgSimple(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function makeFilamentMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      attribute float alpha;
      attribute float size;
      attribute float seed;
      varying vec3 vColor;
      varying float vAlpha;

      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uOpacity;

      void main() {
        vColor = color;
        // Subtle pulsing along filaments
        float pulse = 0.85 + 0.15 * sin(uTime * 0.4 + seed * 40.0);
        vAlpha = alpha * uOpacity * pulse;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPixelRatio * (180.0 / max(40.0, -mvPosition.z));
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
        // Soft glow for filaments
        float core = smoothstep(0.32, 0.0, dist);
        float halo = smoothstep(0.5, 0.12, dist) * 0.22;
        float alpha = vAlpha * (core + halo);
        gl_FragColor = vec4(vColor * (0.9 + core * 0.4), alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function CosmicWebFilaments({ anchors, anchorScales }: {
  anchors: THREE.Vector3[];
  anchorScales: Float32Array;
}) {
  const { progress, activeMode } = useUniverseStore();
  const pointsRef = useRef<THREE.Points>(null);
  const material = useMemo(() => makeFilamentMaterial(), []);
  const field = useMemo(
    () => buildFilamentField(anchors, anchorScales),
    [anchors, anchorScales]
  );

  useFrame((state) => {
    const opacity = activeMode === 'timeline' ? smoothstep(74, 94, progress) : 0;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uOpacity.value = opacity;

    if (!pointsRef.current) return;
    // Scale filament positions with universe expansion
    const scale = getScale(progress);
    pointsRef.current.scale.setScalar(scale);
  });

  const visible = activeMode === 'timeline' && progress > 72;
  if (!visible) return null;

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

// ═══════════════════════════════════════════════════════════════════
//    Bolhas de Strömgren (Reionização)
//    As primeiras estrelas (Pop III) criam bolhas de gás ionizado.
// ═══════════════════════════════════════════════════════════════════

function makeStromgrenMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: 0 },
      uOpacity: { value: 0 },
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
      uniform float uRadius;
      uniform float uOpacity;
      varying vec3 vPosition;

      void main() {
        // Centro (0,0,0) na geometria local
        float dist = length(vPosition);
        float normDist = dist / uRadius;
        
        if (normDist > 1.0) discard;

        // Borda rosa (Emissão H-alpha) e núcleo azul (Estrela Pop III quente)
        vec3 coreColor = vec3(0.72, 0.82, 1.0);
        vec3 edgeColor = vec3(0.95, 0.42, 0.34);
        
        vec3 color = mix(coreColor, edgeColor, pow(normDist, 2.0));
        
        // Bordas mais densas, núcleo brilhante, desvanece suave
        float alpha = (1.0 - pow(normDist, 3.0)) * uOpacity * 0.45;
        // Borda brilhante
        alpha += smoothstep(0.84, 0.98, normDist) * smoothstep(1.0, 0.96, normDist) * uOpacity * 0.35;

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  });
}

function StromgrenBubble({ anchor, maxRadius }: { anchor: THREE.Vector3, maxRadius: number }) {
  const material = useMemo(() => makeStromgrenMaterial(), []);
  
  useFrame((state) => {
    const { progress } = useUniverseStore.getState();
    const scale = getScale(progress);
    
    // Bolhas aparecem entre 48 e 60, crescem e se dissipam (reionização completa)
    const born = smoothstep(62, 70, progress);
    const dissipate = 1.0 - smoothstep(76, 88, progress);
    const opacity = born * dissipate * 0.22;
    
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uRadius.value = maxRadius * scale * born;
  });

  const { progress } = useUniverseStore();
  const scale = getScale(progress);

  // Só renderiza entre 48 e 62%
  if (progress < 61 || progress > 89) return null;

  return (
    <mesh position={[anchor.x * scale, anchor.y * scale, anchor.z * scale]}>
      <sphereGeometry args={[maxRadius * scale, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

export function StromgrenBubbles({ anchors }: { anchors: THREE.Vector3[] }) {
  const { activeMode } = useUniverseStore();
  
  if (activeMode !== 'timeline') return null;

  // Pegamos alguns anchors primordiais para serem os focos das bolhas
  const bubbleAnchors = anchors.slice(0, 8);

  return (
    <>
      {bubbleAnchors.map((anchor, i) => (
        <StromgrenBubble key={i} anchor={anchor} maxRadius={8 + (i % 4) * 2.5} />
      ))}
    </>
  );
}
