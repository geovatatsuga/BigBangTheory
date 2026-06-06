import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useUniverseStore } from '../../store/useUniverseStore';
import { smoothstep } from '../../utils/visualPhase';
import { getScale } from './particleAppearance';

function makeAccretionDiskMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocalPos;
      void main() {
        vUv = uv;
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vLocalPos;
      uniform float uTime;
      uniform float uOpacity;

      // ── Simple 2D Pseudo-Random Noise ──
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
          p *= 2.05;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        // Obter coordenadas polares
        vec2 uv = vUv - vec2(0.5);
        float r = length(uv);

        float theta = atan(uv.y, uv.x);

        // Espiralamento do plasma do disco de acreção
        float speed = 8.0;
        float swirl = fbm(vec2(r * 24.0, theta - uTime * speed));

        // Gradiente de temperatura (Branco-azul muito quente no centro, laranja/vermelho na borda)
        vec3 innerColor = vec3(1.0, 0.95, 0.85); // branco incandescente
        vec3 middleColor = vec3(1.0, 0.45, 0.02); // laranja brilhante
        vec3 outerColor = vec3(0.55, 0.03, 0.08); // vermelho escuro

        // Warping de temperatura com turbulência de FBM orgânica
        float t = smoothstep(0.02, 0.5, r + swirl * 0.06);
        vec3 col = mix(innerColor, middleColor, t);
        col = mix(col, outerColor, smoothstep(0.2, 0.5, r + swirl * 0.04));

        // Adicionar brilho do turbilhonamento
        col += vec3(1.0, 0.8, 0.4) * swirl * 0.45 * (1.0 - t);

        // Alpha baseado em falloff das bordas (sem cortes abruptos)
        float alpha = smoothstep(0.5, 0.28, r) * smoothstep(0.012, 0.06, r);
        alpha *= (0.65 + swirl * 0.35) * uOpacity;

        gl_FragColor = vec4(col * 1.5, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

function makeRelativisticJetMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      uniform float uTime;
      uniform float uOpacity;

      // ── Simple Noise ──
      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n = i.x + i.y * 57.0;
        return mix(mix(hash(n), hash(n + 1.0), f.x),
                   mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);
      }

      void main() {
        // uv.y é a altura do jato [0..1]
        // uv.x é a largura ao redor do cilindro [0..1]

        // Jato de plasma se movendo a velocidade relativística
        float flow = noise(vec2(uv.x * 12.0, uv.y * 45.0 - uTime * 28.0));

        // Cor do jato: Azul elétrico ultra brilhante no centro, com bordas brancas e violetas
        vec3 jetCoreColor = vec3(0.9, 0.95, 1.0);  // branco incandescente
        vec3 jetOuterColor = vec3(0.1, 0.48, 1.0); // azul neon
        vec3 jetEdgeColor = vec3(0.48, 0.08, 0.92); // roxo energético

        // Brilho concentrado no centro do cilindro
        float distToCenter = abs(uv.x - 0.5) * 2.0;
        float centerGlow = pow(1.0 - distToCenter, 1.2);

        vec3 col = mix(jetCoreColor, jetOuterColor, distToCenter);
        col = mix(col, jetEdgeColor, smoothstep(0.7, 1.0, distToCenter));

        // Pulsações de energia ao longo da altura
        col *= 1.0 + 0.35 * flow;

        // Fades nas extremidades do jato
        float verticalFade = smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.6, uv.y);
        float horizontalFade = smoothstep(1.0, 0.0, distToCenter);

        float alpha = centerGlow * horizontalFade * verticalFade * uOpacity;
        alpha *= (0.45 + flow * 0.55);

        gl_FragColor = vec4(col * 2.2, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

function makePointMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
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
        // Garante que as partículas do quasar central permaneçam visíveis como núcleo brilhante
        gl_PointSize = max(1.5 * uPixelRatio, aSize * uPixelRatio * (200.0 / max(1.0, -mvPosition.z)));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uOpacity;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        if (dist > 0.5) discard;
        float glow = smoothstep(0.5, 0.0, dist);
        gl_FragColor = vec4(vColor * 1.5, glow * vAlpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

type AGNProps = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
};

export default function ActiveGalacticNucleus({ position, rotation, scale = 1.0 }: AGNProps) {
  const { progress, activeMode } = useUniverseStore();
  const diskMaterial = useMemo(() => makeAccretionDiskMaterial(), []);
  const jetMaterial = useMemo(() => makeRelativisticJetMaterial(), []);
  const pointMaterial = useMemo(() => makePointMaterial(), []);

  const diskRef = useRef<THREE.Mesh>(null);
  const jetRef = useRef<THREE.Mesh>(null);
  
  const accretionPointsRef = useRef<THREE.Points>(null);
  const jetPointsRef = useRef<THREE.Points>(null);
  const gravityPointsRef = useRef<THREE.Points>(null);

  // Aparece a partir de 70% (galáxias jovens) e brilha no máximo a partir de 85% (galáxias maduras)
  const baseOpacity = activeMode === 'timeline' ? smoothstep(72, 88, progress) : 0;
  const opacity = baseOpacity;

  // 1. Accretion flows (matter spiraling in)
  const accretionData = useMemo(() => {
    const count = 300;
    const seeds = new Float32Array(count);
    const theta = new Float32Array(count);
    const radius = new Float32Array(count);
    const speed = new Float32Array(count);
    const radialSpeed = new Float32Array(count);
    const height = new Float32Array(count);
    const size = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      seeds[i] = Math.random();
      theta[i] = Math.random() * Math.PI * 2;
      radius[i] = 12 + Math.random() * 45;
      speed[i] = 1.0 + Math.random() * 0.8;
      radialSpeed[i] = 4.0 + Math.random() * 6.0;
      height[i] = (Math.random() - 0.5) * 3.2;
      size[i] = 2.0 + Math.random() * 3.0;
    }
    return { count, seeds, theta, radius, speed, radialSpeed, height, size };
  }, []);

  const accretionAttribs = useMemo(() => {
    const pos = new Float32Array(accretionData.count * 3);
    const col = new Float32Array(accretionData.count * 3);
    const alpha = new Float32Array(accretionData.count);
    const size = accretionData.size;
    return { pos, col, alpha, size };
  }, [accretionData]);

  // 2. Jet particles (plasma shooting out)
  const jetParticleData = useMemo(() => {
    const count = 250;
    const seeds = new Float32Array(count);
    const age = new Float32Array(count);
    const lifeTime = new Float32Array(count);
    const vy = new Float32Array(count);
    const vx = new Float32Array(count);
    const vz = new Float32Array(count);
    const size = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      seeds[i] = Math.random();
      age[i] = Math.random() * 1.2; // Staggered start
      lifeTime[i] = 0.7 + Math.random() * 0.6; // Lifetime in seconds
      const direction = Math.random() > 0.5 ? 1 : -1;
      vy[i] = direction * (70 + Math.random() * 80);
      
      const angle = Math.random() * Math.PI * 2;
      const spread = 1.5 + Math.random() * 3.5;
      vx[i] = Math.cos(angle) * spread;
      vz[i] = Math.sin(angle) * spread;
      size[i] = 2.5 + Math.random() * 3.5;
    }
    return { count, seeds, age, lifeTime, vy, vx, vz, size };
  }, []);

  const jetAttribs = useMemo(() => {
    const pos = new Float32Array(jetParticleData.count * 3);
    const col = new Float32Array(jetParticleData.count * 3);
    const alpha = new Float32Array(jetParticleData.count);
    const size = jetParticleData.size;
    return { pos, col, alpha, size };
  }, [jetParticleData]);

  // 3. Gravity halo particles (dust bound by gravity swirling around)
  const gravityData = useMemo(() => {
    const count = 200;
    const seeds = new Float32Array(count);
    const theta = new Float32Array(count);
    const radius = new Float32Array(count);
    const speed = new Float32Array(count);
    const orbitTiltX = new Float32Array(count);
    const orbitTiltZ = new Float32Array(count);
    const size = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      seeds[i] = Math.random();
      theta[i] = Math.random() * Math.PI * 2;
      radius[i] = 25 + Math.random() * 55;
      speed[i] = (0.28 + Math.random() * 0.45) * (Math.random() > 0.5 ? 1 : -1);
      orbitTiltX[i] = (Math.random() - 0.5) * 0.6;
      orbitTiltZ[i] = (Math.random() - 0.5) * 0.6;
      size[i] = 1.5 + Math.random() * 2.5;
    }
    return { count, seeds, theta, radius, speed, orbitTiltX, orbitTiltZ, size };
  }, []);

  const gravityAttribs = useMemo(() => {
    const pos = new Float32Array(gravityData.count * 3);
    const col = new Float32Array(gravityData.count * 3);
    const colorObj = new THREE.Color('#ffb366'); // Golden/Amber glow for gravity field
    for (let i = 0; i < gravityData.count; i++) {
      col[i * 3] = colorObj.r;
      col[i * 3 + 1] = colorObj.g;
      col[i * 3 + 2] = colorObj.b;
    }
    const alpha = new Float32Array(gravityData.count);
    const size = gravityData.size;
    return { pos, col, alpha, size };
  }, [gravityData]);

  const lastTimeRef = useRef(0);

  useFrame((state) => {
    const s = getScale(progress) * scale;
    const time = state.clock.elapsedTime;

    let dt = time - lastTimeRef.current;
    if (dt <= 0 || dt > 0.1) dt = 0.016;
    lastTimeRef.current = time;

    diskMaterial.uniforms.uTime.value = time;
    diskMaterial.uniforms.uOpacity.value = opacity * 0.92;

    jetMaterial.uniforms.uTime.value = time;
    jetMaterial.uniforms.uOpacity.value = opacity * 0.88;

    pointMaterial.uniforms.uOpacity.value = opacity;

    if (diskRef.current) {
      diskRef.current.scale.setScalar(55 * s);
    }
    if (jetRef.current) {
      jetRef.current.scale.set(4 * s, 180 * s, 4 * s);
    }

    // 1. Accretion particles simulation
    if (accretionPointsRef.current) {
      const pts = accretionPointsRef.current.geometry.attributes.position.array as Float32Array;
      const alphas = accretionPointsRef.current.geometry.attributes.aAlpha.array as Float32Array;
      const colors = accretionPointsRef.current.geometry.attributes.aColor.array as Float32Array;
      
      for (let i = 0; i < accretionData.count; i++) {
        const r = accretionData.radius[i];
        const KeplerSpeed = accretionData.speed[i] * Math.pow(30.0 / Math.max(r, 4.0), 0.5);
        accretionData.theta[i] += KeplerSpeed * dt * 3.8;
        accretionData.radius[i] -= accretionData.radialSpeed[i] * dt;
        
        if (accretionData.radius[i] < 2.5) {
          accretionData.radius[i] = 45.0 + Math.random() * 10.0;
          accretionData.theta[i] = Math.random() * Math.PI * 2;
        }

        const angle = accretionData.theta[i];
        const rad = accretionData.radius[i];
        const base = i * 3;
        
        pts[base] = Math.cos(angle) * rad;
        pts[base + 1] = accretionData.height[i];
        pts[base + 2] = Math.sin(angle) * rad;

        // Hot inner core (white/yellow), cooler outer disk (orange/red)
        const t = smoothstep(2.5, 45, rad);
        colors[base] = THREE.MathUtils.lerp(1.0, 0.95, t);
        colors[base + 1] = THREE.MathUtils.lerp(0.95, 0.35, t);
        colors[base + 2] = THREE.MathUtils.lerp(0.8, 0.05, t);

        alphas[i] = 0.42 * smoothstep(2.5, 8.0, rad) * smoothstep(55.0, 35.0, rad);
      }
      accretionPointsRef.current.geometry.attributes.position.needsUpdate = true;
      accretionPointsRef.current.geometry.attributes.aAlpha.needsUpdate = true;
      accretionPointsRef.current.geometry.attributes.aColor.needsUpdate = true;
      accretionPointsRef.current.scale.setScalar(s);
    }

    // 2. Jet particles simulation
    if (jetPointsRef.current) {
      const pts = jetPointsRef.current.geometry.attributes.position.array as Float32Array;
      const alphas = jetPointsRef.current.geometry.attributes.aAlpha.array as Float32Array;
      const colors = jetPointsRef.current.geometry.attributes.aColor.array as Float32Array;
      
      for (let i = 0; i < jetParticleData.count; i++) {
        jetParticleData.age[i] += dt;
        const life = jetParticleData.age[i] / jetParticleData.lifeTime[i];
        const base = i * 3;
        
        if (life >= 1.0) {
          jetParticleData.age[i] = 0;
          pts[base] = 0;
          pts[base + 1] = 0;
          pts[base + 2] = 0;
        } else {
          pts[base] += jetParticleData.vx[i] * dt;
          pts[base + 1] += jetParticleData.vy[i] * dt;
          pts[base + 2] += jetParticleData.vz[i] * dt;
        }

        // Color transition: blue core -> purple edges -> fade
        colors[base] = THREE.MathUtils.lerp(0.9, 0.45, life);
        colors[base + 1] = THREE.MathUtils.lerp(0.95, 0.08, life);
        colors[base + 2] = THREE.MathUtils.lerp(1.0, 0.92, life);

        alphas[i] = Math.sin(life * Math.PI) * 0.92;
      }
      jetPointsRef.current.geometry.attributes.position.needsUpdate = true;
      jetPointsRef.current.geometry.attributes.aAlpha.needsUpdate = true;
      jetPointsRef.current.geometry.attributes.aColor.needsUpdate = true;
      jetPointsRef.current.scale.setScalar(s);
    }

    // 3. Gravity halo particles simulation
    if (gravityPointsRef.current) {
      const pts = gravityPointsRef.current.geometry.attributes.position.array as Float32Array;
      const alphas = gravityPointsRef.current.geometry.attributes.aAlpha.array as Float32Array;
      
      for (let i = 0; i < gravityData.count; i++) {
        gravityData.theta[i] += gravityData.speed[i] * dt * 0.6;
        const angle = gravityData.theta[i];
        const rad = gravityData.radius[i];
        const base = i * 3;

        let lx = Math.cos(angle) * rad;
        let ly = 0;
        let lz = Math.sin(angle) * rad;

        const tiltX = gravityData.orbitTiltX[i];
        const tiltZ = gravityData.orbitTiltZ[i];
        const cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);
        const cosZ = Math.cos(tiltZ), sinZ = Math.sin(tiltZ);

        const ly2 = ly * cosX - lz * sinX;
        const lz2 = ly * sinX + lz * cosX;
        const lx3 = lx * cosZ - ly2 * sinZ;
        const ly3 = lx * sinZ + ly2 * cosZ;

        pts[base] = lx3;
        pts[base + 1] = ly3;
        pts[base + 2] = lz2;

        alphas[i] = (0.22 + 0.28 * Math.sin(angle * 2.0 + i)) * (1.0 - rad / 85.0);
      }
      gravityPointsRef.current.geometry.attributes.position.needsUpdate = true;
      gravityPointsRef.current.geometry.attributes.aAlpha.needsUpdate = true;
      gravityPointsRef.current.scale.setScalar(s);
    }
  });

  if (opacity <= 0.01) return null;

  return (
    <group position={position} rotation={rotation}>
      {/* Disco de Acreção */}
      <mesh ref={diskRef} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <primitive object={diskMaterial} attach="material" />
      </mesh>

      {/* Jato Relativístico (Cilindro de luz perpendicular) */}
      <mesh ref={jetRef} position={[0, 0, 0]}>
        <cylinderGeometry args={[1, 1, 1, 16, 1, true]} />
        <primitive object={jetMaterial} attach="material" />
      </mesh>

      {/* Partículas de Acreção */}
      <points ref={accretionPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={accretionData.count} array={accretionAttribs.pos} itemSize={3} />
          <bufferAttribute attach="attributes-aColor"    count={accretionData.count} array={accretionAttribs.col} itemSize={3} />
          <bufferAttribute attach="attributes-aAlpha"    count={accretionData.count} array={accretionAttribs.alpha} itemSize={1} />
          <bufferAttribute attach="attributes-aSize"     count={accretionData.count} array={accretionAttribs.size} itemSize={1} />
        </bufferGeometry>
        <primitive object={pointMaterial} attach="material" />
      </points>

      {/* Partículas do Jato Pólar */}
      <points ref={jetPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={jetParticleData.count} array={jetAttribs.pos} itemSize={3} />
          <bufferAttribute attach="attributes-aColor"    count={jetParticleData.count} array={jetAttribs.col} itemSize={3} />
          <bufferAttribute attach="attributes-aAlpha"    count={jetParticleData.count} array={jetAttribs.alpha} itemSize={1} />
          <bufferAttribute attach="attributes-aSize"     count={jetParticleData.count} array={jetAttribs.size} itemSize={1} />
        </bufferGeometry>
        <primitive object={pointMaterial} attach="material" />
      </points>

      {/* Partículas de Aura de Gravidade */}
      <points ref={gravityPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={gravityData.count} array={gravityAttribs.pos} itemSize={3} />
          <bufferAttribute attach="attributes-aColor"    count={gravityData.count} array={gravityAttribs.col} itemSize={3} />
          <bufferAttribute attach="attributes-aAlpha"    count={gravityData.count} array={gravityAttribs.alpha} itemSize={1} />
          <bufferAttribute attach="attributes-aSize"     count={gravityData.count} array={gravityAttribs.size} itemSize={1} />
        </bufferGeometry>
        <primitive object={pointMaterial} attach="material" />
      </points>
    </group>
  );
}
