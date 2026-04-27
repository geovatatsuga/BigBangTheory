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
    const solarDive = smoothstep(82, 88.5, progress);
    const galaxyArmDive = smoothstep(88.5, 94, progress);
    const solarReveal = smoothstep(94, 97.5, progress);
    const solarExit = smoothstep(98, 100, progress);
    const cinematicSolar = progress >= 82 && progress < 99;
    const overviewPosition = new THREE.Vector3(
      Math.sin(orbit) * THREE.MathUtils.lerp(18, 42, lateOrbit),
      16 + Math.sin(orbit * 0.7) * 10,
      profile.cameraDistance
    );
    const divePosition = new THREE.Vector3(
      THREE.MathUtils.lerp(overviewPosition.x, 72, solarDive),
      THREE.MathUtils.lerp(overviewPosition.y, 42, solarDive),
      THREE.MathUtils.lerp(overviewPosition.z, 330, solarDive)
    );
    const galacticArmPosition = new THREE.Vector3(132, -18, 246);
    const solarPosition = new THREE.Vector3(152, -42, 118);
    const exitPosition = new THREE.Vector3(34, 18, profile.cameraDistance);
    const cinematicPosition = divePosition
      .lerp(galacticArmPosition, galaxyArmDive)
      .lerp(solarPosition, solarReveal)
      .lerp(exitPosition, solarExit);
    const targetPosition = cinematicSolar ? cinematicPosition : overviewPosition;
    const targetFocus = cinematicSolar
      ? new THREE.Vector3(
          THREE.MathUtils.lerp(0, 116, solarDive),
          THREE.MathUtils.lerp(0, -18, solarDive),
          THREE.MathUtils.lerp(0, 160, solarDive)
        ).lerp(new THREE.Vector3(152, -42, 170), Math.max(galaxyArmDive, solarReveal))
        .lerp(new THREE.Vector3(0, 0, 0), solarExit)
      : new THREE.Vector3(0, 0, 0);

    controls.enabled = progress > 62 && !cinematicSolar;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.autoRotate = progress > 72 && !cinematicSolar;
    controls.autoRotateSpeed = 0.06;
    camera.position.lerp(targetPosition, cinematicSolar ? 0.045 : 0.032);
    controls.target.lerp(targetFocus, cinematicSolar ? 0.055 : 0.05);
    controls.update();
  });

  return <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.07} minDistance={55} maxDistance={820} />;
}
