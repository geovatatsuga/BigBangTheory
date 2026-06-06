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
    const targetDistance = profile.cameraDistance;

    // Configuração dos controles de órbita padrão
    controls.enabled = progress > 62;
    controls.enablePan = false;
    controls.enableZoom = true;
    
    // Mantém rotação automática circular contínua e suave para a sensação tridimensional
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.28; // Velocidade majestosa cósmica

    // Suaviza o alvo dos controles de câmera no centro
    controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.05);

    // Ajusta apenas a distância da câmera do alvo baseado no progress (sem travar a rotação!)
    const currentDistance = camera.position.distanceTo(controls.target);
    const newDistance = THREE.MathUtils.lerp(currentDistance, targetDistance, 0.04);

    const direction = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (direction.lengthSq() > 0.0001) {
      direction.normalize();
      camera.position.copy(direction.multiplyScalar(newDistance).add(controls.target));
    }

    controls.update();
  });

  return <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.07} minDistance={55} maxDistance={2200} />;
}
