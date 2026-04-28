import { useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useUniverseStore } from '../../store/useUniverseStore';
import { getVisualProfile, smoothstep } from '../../utils/visualPhase';

export default function CameraDirector() {
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
