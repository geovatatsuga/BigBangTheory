import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useUniverseStore } from '../../store/useUniverseStore';
import { smoothstep } from '../../utils/visualPhase';

const NEBULA_COUNT = 120; // Aumentado para 120 para preencher o plano de fundo tridimensional
const MICRO_GALAXY_COUNT = 12000; // Galáxias pontuais microscópicas de fundo (mais denso)
const COLLISION_COUNT = 550; // 550 pontos de colisões estelares / supernovas cintilantes com luz real
const BOUNDS = 820;

// Helper LCG determinístico
let sVal = 12345;
const lcg = () => {
  sVal = (sVal * 1664525 + 1013904223) & 0xffffffff;
  return (sVal >>> 0) / 0xffffffff;
};

// 1. Geração das Nuvens de Poeira Cósmica (Nébulas vibrantes e coloridas de grande escala)
const nebulaData = (() => {
  const positions = new Float32Array(NEBULA_COUNT * 3);
  const colors = new Float32Array(NEBULA_COUNT * 3);
  const alphas = new Float32Array(NEBULA_COUNT);
  const sizes = new Float32Array(NEBULA_COUNT);

  const colorsPalette = [
    new THREE.Color('#db2777'), // Rosa Pink cósmico
    new THREE.Color('#7c3aed'), // Roxo Violeta intenso
    new THREE.Color('#0284c7'), // Azul brilhante
    new THREE.Color('#ea580c'), // Laranja de poeira estelar
    new THREE.Color('#dc2626'), // Vermelho vivo
  ];

  for (let i = 0; i < NEBULA_COUNT; i++) {
    const theta = lcg() * Math.PI * 2;
    const phi = Math.acos(lcg() * 2 - 1);
    
    // 35% das nébulas/galáxias são geradas próximas à trajetória da câmera (r entre 400 e 1350)
    // 65% no plano de fundo distante (r de 1350 a 2700)
    const isForeground = i < Math.floor(NEBULA_COUNT * 0.35);
    const r = isForeground 
      ? 400 + lcg() * 950 
      : 1350 + lcg() * 1350;

    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r * (isForeground ? 0.95 : 0.72); // Menos achatado perto
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;

    const color = colorsPalette[Math.floor(lcg() * colorsPalette.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    if (isForeground) {
      // Nébulas de primeiro plano são maiores e mais translúcidas para dar efeito de volume ao atravessar
      alphas[i] = 0.08 + lcg() * 0.12;
      sizes[i] = 1000 + lcg() * 1400;
    } else {
      alphas[i] = 0.13 + lcg() * 0.17;
      sizes[i] = 650 + lcg() * 950;
    }
  }

  return { positions, colors, alphas, sizes };
})();

// 2. Geração das Micro-Galáxias de Fundo (Agrupadas em 50 galáxias 3D estruturadas)
const microGalaxyData = (() => {
  const positions = new Float32Array(MICRO_GALAXY_COUNT * 3);
  const colors = new Float32Array(MICRO_GALAXY_COUNT * 3);
  const alphas = new Float32Array(MICRO_GALAXY_COUNT);
  const sizes = new Float32Array(MICRO_GALAXY_COUNT);
  const seeds = new Float32Array(MICRO_GALAXY_COUNT);
  const color = new THREE.Color();

  const GALAXY_COUNT = 80;
  const POINTS_PER_GALAXY = MICRO_GALAXY_COUNT / GALAXY_COUNT; // 150 pontos por galáxia

  for (let g = 0; g < GALAXY_COUNT; g++) {
    // Escolhe um nó de nébula para centrar a galáxia
    const nebIndex = Math.floor(lcg() * NEBULA_COUNT);
    const nx = nebulaData.positions[nebIndex * 3];
    const ny = nebulaData.positions[nebIndex * 3 + 1];
    const nz = nebulaData.positions[nebIndex * 3 + 2];

    // Deslocamento leve em torno da nébula
    const rOffset = 10 + Math.pow(lcg(), 1.5) * 80;
    const thetaG = lcg() * Math.PI * 2;
    const phiG = Math.acos(lcg() * 2 - 1);
    
    const cx = nx + Math.sin(phiG) * Math.cos(thetaG) * rOffset;
    const cy = ny + Math.cos(phiG) * rOffset * 0.8;
    const cz = nz + Math.sin(phiG) * Math.sin(thetaG) * rOffset;

    // Tipo de galáxia e escala física
    const typeRoll = lcg();
    const galaxyType = typeRoll < 0.45 ? 'spiral' : (typeRoll < 0.80 ? 'elliptical' : 'quasar');
    const isForeground = nebIndex < Math.floor(NEBULA_COUNT * 0.35); // Se a nébula está perto
    const galaxyRadius = (isForeground ? 16 : 8) + lcg() * (isForeground ? 12 : 6);
    const tiltX = lcg() * Math.PI * 2;
    const tiltZ = lcg() * Math.PI * 2;

    for (let p = 0; p < POINTS_PER_GALAXY; p++) {
      const idx = g * POINTS_PER_GALAXY + p;
      const seed = lcg();
      seeds[idx] = seed;

      let lx = 0, ly = 0, lz = 0;
      let starColor = new THREE.Color();
      let starSize = 1.0;

      if (galaxyType === 'spiral') {
        const arms = lcg() < 0.5 ? 2 : 4;
        const twist = 0.08 + lcg() * 0.12;
        const localRadius = Math.pow(seed, 1.4) * galaxyRadius;
        const isCore = seed < 0.22;

        if (isCore) {
          const t = lcg() * Math.PI * 2;
          const ph = Math.acos(lcg() * 2 - 1);
          const br = Math.pow(lcg(), 2.0) * galaxyRadius * 0.15; // Concentra mais no núcleo
          lx = Math.sin(ph) * Math.cos(t) * br;
          ly = Math.cos(ph) * br * 0.7;
          lz = Math.sin(ph) * Math.sin(t) * br;
          starColor.setHSL(0.08 + lcg() * 0.04, 0.85, 0.65 + lcg() * 0.15); // Amarelo
          starSize = 3.5 + lcg() * 2.5; // Maior núcleo
        } else {
          const arm = p % arms;
          const armAngle = arm * ((Math.PI * 2) / arms);
          const angle = armAngle + localRadius * twist + (lcg() - 0.5) * 0.22;
          lx = Math.cos(angle) * localRadius;
          ly = (lcg() - 0.5) * (galaxyRadius * 0.08); 
          lz = Math.sin(angle) * localRadius;
          
          if (lcg() < 0.65) {
            starColor.setHSL(0.58 + lcg() * 0.05, 0.72, 0.72 + lcg() * 0.18); // Azul
          } else {
            starColor.setHSL(0.96 + lcg() * 0.04, 0.85, 0.68 + lcg() * 0.18); // HII rosa
          }
          starSize = 1.8 + lcg() * 1.6;
        }
      } 
      else if (galaxyType === 'elliptical') {
        const localRadius = Math.pow(seed, 1.2) * galaxyRadius;
        const t = lcg() * Math.PI * 2;
        const ph = Math.acos(lcg() * 2 - 1);
        lx = Math.sin(ph) * Math.cos(t) * localRadius;
        ly = Math.cos(ph) * localRadius * 0.48;
        lz = Math.sin(ph) * Math.sin(t) * localRadius * 0.82;

        starColor.setHSL(0.08 + lcg() * 0.06, 0.75, 0.52 + lcg() * 0.25); // Gigantes amarelas
        starSize = 2.2 + lcg() * 2.0;
      } 
      else {
        // Quasar
        const isCore = seed < 0.45;
        const isJet = !isCore && seed > 0.82;

        if (isCore) {
          lx = (lcg() - 0.5) * galaxyRadius * 0.12;
          ly = (lcg() - 0.5) * galaxyRadius * 0.12;
          lz = (lcg() - 0.5) * galaxyRadius * 0.12;
          starColor.setRGB(1.8, 1.7, 2.2); // Núcleo brilhante
          starSize = 4.5 + lcg() * 3.5;
        } else if (isJet) {
          lx = (lcg() - 0.5) * 0.2;
          ly = (lcg() - 0.5) * galaxyRadius * 2.0;
          lz = (lcg() - 0.5) * 0.2;
          starColor.setHSL(0.58, 0.95, 0.75); // Azul jato
          starSize = 3.0 + lcg() * 2.0;
        } else {
          const t = lcg() * Math.PI * 2;
          const diskR = (0.12 + lcg() * 0.68) * galaxyRadius;
          lx = Math.cos(t) * diskR;
          ly = (lcg() - 0.5) * 0.3;
          lz = Math.sin(t) * diskR;
          starColor.setHSL(0.08 + lcg() * 0.03, 0.95, 0.65); // Amarelo/Laranja acreção
          starSize = 1.8 + lcg() * 1.8;
        }
      }

      // Rotação de inclinação 3D local
      const cosTX = Math.cos(tiltX), sinTX = Math.sin(tiltX);
      const cosTZ = Math.cos(tiltZ), sinTZ = Math.sin(tiltZ);
      const ly2 = ly * cosTX - lz * sinTX;
      const lz2 = ly * sinTX + lz * cosTX;
      const lx3 = lx * cosTZ - ly2 * sinTZ;
      const ly3 = lx * sinTZ + ly2 * cosTZ;
      const lz3 = lz2;

      positions[idx * 3]     = cx + lx3;
      positions[idx * 3 + 1] = cy + ly3;
      positions[idx * 3 + 2] = cz + lz3;

      colors[idx * 3]     = starColor.r;
      colors[idx * 3 + 1] = starColor.g;
      colors[idx * 3 + 2] = starColor.b;

      alphas[idx] = 0.28 + lcg() * 0.52;
      sizes[idx] = starSize;
    }
  }

  return { positions, colors, alphas, sizes, seeds };
})();

// 3. Geração das Colisões Estelares (Supernovas Ativas e Brilhantes)
const collisionData = (() => {
  const positions = new Float32Array(COLLISION_COUNT * 3);
  const colors = new Float32Array(COLLISION_COUNT * 3);
  const alphas = new Float32Array(COLLISION_COUNT);
  const sizes = new Float32Array(COLLISION_COUNT);
  const color = new THREE.Color();

  for (let i = 0; i < COLLISION_COUNT; i++) {
    // Espalha dentro dos mesmos nós de nébulas de fundo
    const nebIndex = Math.floor(lcg() * NEBULA_COUNT);
    const nx = nebulaData.positions[nebIndex * 3];
    const ny = nebulaData.positions[nebIndex * 3 + 1];
    const nz = nebulaData.positions[nebIndex * 3 + 2];

    const rOffset = 10 + Math.pow(lcg(), 1.2) * 120;
    const theta = lcg() * Math.PI * 2;
    const phi = Math.acos(lcg() * 2 - 1);

    positions[i * 3] = nx + Math.sin(phi) * Math.cos(theta) * rOffset;
    positions[i * 3 + 1] = ny + Math.cos(phi) * rOffset * 0.8;
    positions[i * 3 + 2] = nz + Math.sin(phi) * Math.sin(theta) * rOffset;

    // Cores de alta energia (azul elétrico, violeta hypernova, amarelo superaquecido)
    const seed = lcg();
    if (seed < 0.35) {
      color.setHSL(0.56 + lcg() * 0.04, 0.95, 0.72); // Azul elétrico
    } else if (seed < 0.7) {
      color.setHSL(0.07 + lcg() * 0.03, 1.0, 0.68);  // Amarelo solar incandescente
    } else {
      color.setHSL(0.88 + lcg() * 0.05, 0.95, 0.70); // Violeta/Rosa energético
    }

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    alphas[i] = 0.5 + lcg() * 0.5; // Alta opacidade para o centro estelar
    sizes[i] = 3.5 + lcg() * 4.5;
  }

  return { positions, colors, alphas, sizes };
})();

// Shader para nuvens volumétricas muito suaves
function makeSupernovaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      attribute float aAlpha;
      attribute float aSize;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vDist;

      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vDist = length(position);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (450.0 / max(1.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vDist;
      uniform float uTime;
      uniform float uOpacity;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += noise(p) * a;
          p *= 2.1;
          a *= 0.48;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        if (dist > 0.5) discard;

        float edgeFade = smoothstep(0.5, 0.15, dist);

        float angle = uTime * 0.004;
        float c = cos(angle), s = sin(angle);
        vec2 rotUv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);

        float detail = fbm(rotUv * 8.0 + vec2(uTime * 0.008, -uTime * 0.006));

        vec3 baseColor = vColor;
        vec3 secondaryColor = vec3(baseColor.b * 1.5, baseColor.r * 0.5, baseColor.g * 1.7);
        vec3 finalColor = mix(baseColor, secondaryColor, detail) * 1.6;

        // Desvio para o vermelho (redshift) conforme a nébula está mais no fundo (distância 1100 a 2600)
        float redshift = smoothstep(1100.0, 2600.0, vDist);
        vec3 redshiftColor = vec3(finalColor.r * 1.5, finalColor.g * 0.3, finalColor.b * 0.22);
        vec3 deepColor = mix(finalColor, redshiftColor, redshift);

        float alpha = edgeFade * (0.35 + detail * 0.65);
        gl_FragColor = vec4(deepColor, alpha * vAlpha * uOpacity * 1.45);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// Shader para as micro-galáxias pontuais de fundo
function makeMicroGalaxyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute float aAlpha;
      attribute float aSize;
      attribute float aSeed;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSeed;
      varying float vDist;

      uniform float uPixelRatio;

      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vSeed = aSeed;
        vDist = length(position);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uPixelRatio * (150.0 / max(1.0, -mvPosition.z)), 0.8 * uPixelRatio, 8.0 * uPixelRatio);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSeed;
      varying float vDist;
      uniform float uOpacity;
      uniform float uTime;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        if (dist > 0.5) discard;

        // Glow com decaimento circular suave
        float glow = smoothstep(0.5, 0.0, dist);

        // Desvio para o vermelho (redshift) conforme o objeto está mais no fundo (distância 1100 a 2600)
        float redshift = smoothstep(1100.0, 2600.0, vDist);
        vec3 baseColor = vColor;
        vec3 redshiftColor = vec3(baseColor.r * 1.5, baseColor.g * 0.22, baseColor.b * 0.42);
        vec3 finalColor = mix(baseColor, redshiftColor, redshift);

        // Brilho cintilante individual para cada estrela da galáxia
        float twinkle = 0.80 + 0.20 * sin(uTime * 3.0 + vSeed * 42.0);

        gl_FragColor = vec4(finalColor * 2.2, glow * vAlpha * uOpacity * twinkle);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// Shader para as colisões estelares (Supernovas Piscantes / Luz Real)
function makeStellarCollisionMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute float aAlpha;
      attribute float aSize;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;

      uniform float uPixelRatio;

      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // Garante que os focos de colisão/luz estelar permaneçam nítidos
        gl_PointSize = clamp(aSize * uPixelRatio * (180.0 / max(1.0, -mvPosition.z)), 2.0 * uPixelRatio, 8.5 * uPixelRatio);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      uniform float uOpacity;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        if (dist > 0.5) discard;

        // Core incandescente de luz e halo suave
        float core = smoothstep(0.08, 0.0, dist) * 2.8;
        float halo = smoothstep(0.5, 0.0, dist) * 0.45;

        // Pulsação de alta frequência simulando a explosão e emissão caótica de energia
        float pulse = 0.68 + 0.32 * sin(uTime * 14.0 + vAlpha * 74.0);

        vec3 finalColor = vColor * (core + halo) * pulse;
        // Núcleo branco puro incandescente superaquecido de verdade no centro
        finalColor += vec3(1.0, 1.0, 1.0) * core * pulse * 1.6;

        gl_FragColor = vec4(finalColor, (core + halo) * vAlpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export default function SupernovaSpaceBackground() {
  const { progress } = useUniverseStore();
  
  const nebulaMaterial = useMemo(() => makeSupernovaMaterial(), []);
  const microGalaxyMaterial = useMemo(() => makeMicroGalaxyMaterial(), []);
  const collisionMaterial = useMemo(() => makeStellarCollisionMaterial(), []);

  // Só acende no zoom-out final (entre 88% e 100% de progresso), quando o Universo está totalmente expandido
  const opacity = smoothstep(88, 100, progress);

  useFrame((state) => {
    nebulaMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    nebulaMaterial.uniforms.uOpacity.value = opacity;

    microGalaxyMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    microGalaxyMaterial.uniforms.uOpacity.value = opacity;

    collisionMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    collisionMaterial.uniforms.uOpacity.value = opacity;
  });

  if (opacity <= 0.01) return null;

  return (
    <group>
      {/* 1. Nuvens volumétricas de poeira e gás cósmico suave */}
      <points material={nebulaMaterial}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={NEBULA_COUNT} array={nebulaData.positions} itemSize={3} />
          <bufferAttribute attach="attributes-aColor"    count={NEBULA_COUNT} array={nebulaData.colors}    itemSize={3} />
          <bufferAttribute attach="attributes-aAlpha"    count={NEBULA_COUNT} array={nebulaData.alphas}    itemSize={1} />
          <bufferAttribute attach="attributes-aSize"     count={NEBULA_COUNT} array={nebulaData.sizes}     itemSize={1} />
        </bufferGeometry>
      </points>

      {/* 2. Micro-galáxias pontuais de fundo */}
      <points material={microGalaxyMaterial}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={MICRO_GALAXY_COUNT} array={microGalaxyData.positions} itemSize={3} />
          <bufferAttribute attach="attributes-aColor"    count={MICRO_GALAXY_COUNT} array={microGalaxyData.colors}    itemSize={3} />
          <bufferAttribute attach="attributes-aAlpha"    count={MICRO_GALAXY_COUNT} array={microGalaxyData.alphas}    itemSize={1} />
          <bufferAttribute attach="attributes-aSize"     count={MICRO_GALAXY_COUNT} array={microGalaxyData.sizes}     itemSize={1} />
          <bufferAttribute attach="attributes-aSeed"     count={MICRO_GALAXY_COUNT} array={microGalaxyData.seeds}     itemSize={1} />
        </bufferGeometry>
      </points>

      {/* 3. Colisões estelares / Supernovas incandescentes piscando no meio */}
      <points material={collisionMaterial}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={COLLISION_COUNT} array={collisionData.positions} itemSize={3} />
          <bufferAttribute attach="attributes-aColor"    count={COLLISION_COUNT} array={collisionData.colors}    itemSize={3} />
          <bufferAttribute attach="attributes-aAlpha"    count={COLLISION_COUNT} array={collisionData.alphas}    itemSize={1} />
          <bufferAttribute attach="attributes-aSize"     count={COLLISION_COUNT} array={collisionData.sizes}     itemSize={1} />
        </bufferGeometry>
      </points>
    </group>
  );
}
