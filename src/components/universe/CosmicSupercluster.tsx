import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useUniverseStore } from '../../store/useUniverseStore';
import { smoothstep } from '../../utils/visualPhase';

const COUNT = 24000;
const BOUNDS = 820;

const superclusterData = (() => {
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const seeds = new Float32Array(COUNT);
  
  let sVal = 9999;
  const lcg = () => {
    sVal = (sVal * 1664525 + 1013904223) & 0xffffffff;
    return (sVal >>> 0) / 0xffffffff;
  };

  const GALAXY_COUNT = 120;
  const POINTS_PER_GALAXY = COUNT / GALAXY_COUNT; // 200

  for (let g = 0; g < GALAXY_COUNT; g++) {
    const thetaG = lcg() * Math.PI * 2;
    const phiG = Math.acos(lcg() * 2 - 1);
    // 35% das galáxias no primeiro plano perto da câmera, 65% no fundo distante
    const isForeground = g < Math.floor(GALAXY_COUNT * 0.35);
    const rG = isForeground 
      ? 400 + lcg() * 900 
      : 1300 + lcg() * 1500;

    const cx = Math.sin(phiG) * Math.cos(thetaG) * rG;
    const cy = Math.cos(phiG) * rG * (isForeground ? 0.95 : 0.82);
    const cz = Math.sin(phiG) * Math.sin(thetaG) * rG;

    // 2. Parâmetros da galáxia
    const typeRoll = lcg();
    const galaxyType = typeRoll < 0.45 ? 'spiral' : (typeRoll < 0.80 ? 'elliptical' : 'quasar');
    const galaxyRadius = (isForeground ? 18 : 10) + lcg() * (isForeground ? 16 : 8);
    const tiltX = lcg() * Math.PI * 2;
    const tiltZ = lcg() * Math.PI * 2;

    // 3. Gerar estrelas para esta galáxia
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
        const isCore = seed < 0.22;
        const localRadius = Math.pow(seed, 1.4) * galaxyRadius;

        if (isCore) {
          // Bojo central
          const t = lcg() * Math.PI * 2;
          const ph = Math.acos(lcg() * 2 - 1);
          const br = Math.pow(lcg(), 2.0) * galaxyRadius * 0.15; // Concentra mais no núcleo
          lx = Math.sin(ph) * Math.cos(t) * br;
          ly = Math.cos(ph) * br * 0.7;
          lz = Math.sin(ph) * Math.sin(t) * br;
          starColor.setHSL(0.08 + lcg() * 0.04, 0.85, 0.65 + lcg() * 0.15); // Amarelo quente
          starSize = 3.5 + lcg() * 2.5; // Maior tamanho de núcleo
        } else {
          // Braços espirais
          const arm = p % arms;
          const armAngle = arm * ((Math.PI * 2) / arms);
          const angle = armAngle + localRadius * twist + (lcg() - 0.5) * 0.22;
          lx = Math.cos(angle) * localRadius;
          ly = (lcg() - 0.5) * (galaxyRadius * 0.08); 
          lz = Math.sin(angle) * localRadius;
          
          if (lcg() < 0.65) {
            starColor.setHSL(0.58 + lcg() * 0.05, 0.72, 0.72 + lcg() * 0.18); // Estrelas azuis
          } else {
            starColor.setHSL(0.96 + lcg() * 0.04, 0.85, 0.68 + lcg() * 0.18); // HII rosa nos braços
          }
          starSize = 1.8 + lcg() * 1.6;
        }
      } 
      else if (galaxyType === 'elliptical') {
        // Galáxia elíptica
        const localRadius = Math.pow(seed, 1.2) * galaxyRadius;
        const t = lcg() * Math.PI * 2;
        const ph = Math.acos(lcg() * 2 - 1);
        lx = Math.sin(ph) * Math.cos(t) * localRadius;
        ly = Math.cos(ph) * localRadius * 0.48;
        lz = Math.sin(ph) * Math.sin(t) * localRadius * 0.82;

        starColor.setHSL(0.08 + lcg() * 0.06, 0.75, 0.52 + lcg() * 0.25); // Amarelo/laranja/vermelho gigante
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
          starColor.setRGB(1.8, 1.7, 2.2); // Núcleo brilhante azul-branco
          starSize = 4.5 + lcg() * 3.5;
        } else if (isJet) {
          // Jato relativístico bipolar vertical local
          lx = (lcg() - 0.5) * 0.2;
          ly = (lcg() - 0.5) * galaxyRadius * 2.0;
          lz = (lcg() - 0.5) * 0.2;
          starColor.setHSL(0.58, 0.95, 0.75); // Azul elétrico jato
          starSize = 3.0 + lcg() * 2.0;
        } else {
          // Disco de acreção
          const t = lcg() * Math.PI * 2;
          const diskR = (0.12 + lcg() * 0.68) * galaxyRadius;
          lx = Math.cos(t) * diskR;
          ly = (lcg() - 0.5) * 0.3;
          lz = Math.sin(t) * diskR;
          starColor.setHSL(0.08 + lcg() * 0.03, 0.95, 0.65); // Amarelo
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

      sizes[idx] = starSize;
    }
  }

  return { positions, colors, sizes, seeds };
})();

function makeSuperclusterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aSeed;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vSeed;
      varying float vDist;

      uniform float uPixelRatio;

      void main() {
        vColor = aColor;
        vSeed = aSeed;
        vDist = length(position);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // Ajuste no tamanho de cada ponto estrela da galáxia de fundo
        gl_PointSize = clamp(aSize * uPixelRatio * (150.0 / max(1.0, -mvPosition.z)), 0.8 * uPixelRatio, 8.0 * uPixelRatio);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vSeed;
      varying float vDist;
      uniform float uOpacity;
      uniform float uTime;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        if (dist > 0.5) discard;

        // Decaimento circular suave para cada estrela
        float glow = smoothstep(0.5, 0.0, dist);

        // Desvio para o vermelho (redshift) conforme o aglomerado está mais no fundo (distância 1100 a 2600)
        float redshift = smoothstep(1100.0, 2600.0, vDist);
        vec3 redshiftColor = vec3(vColor.r * 1.5, vColor.g * 0.22, vColor.b * 0.42);
        vec3 finalColor = mix(vColor, redshiftColor, redshift);

        // Brilho cintilante individual para cada estrela da galáxia
        float twinkle = 0.80 + 0.20 * sin(uTime * 3.0 + vSeed * 42.0);

        gl_FragColor = vec4(finalColor * 2.2, glow * uOpacity * twinkle);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export default function CosmicSupercluster() {
  const { progress } = useUniverseStore();
  const material = useMemo(() => makeSuperclusterMaterial(), []);

  // Acende entre 88% e 100% à medida que a câmera recua
  const opacity = smoothstep(88, 100, progress) * 0.92;

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uOpacity.value = opacity;
  });

  if (opacity <= 0.01) return null;

  return (
    <points material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={superclusterData.positions} itemSize={3} />
        <bufferAttribute attach="attributes-aColor"    count={COUNT} array={superclusterData.colors}    itemSize={3} />
        <bufferAttribute attach="attributes-aSize"     count={COUNT} array={superclusterData.sizes}     itemSize={1} />
        <bufferAttribute attach="attributes-aSeed"     count={COUNT} array={superclusterData.seeds}     itemSize={1} />
      </bufferGeometry>
    </points>
  );
}
