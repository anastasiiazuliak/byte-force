import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  CAMERA_PRESETS,
  DEFAULT_CAMERA_PRESET,
  easeInOutCubic,
} from '../scene/camera';
import type { CameraAnimationState } from '../scene/camera';
import type { CameraPreset } from '../types';

export interface SceneControlsProps {
  enableKeyboard?: boolean;
  onPresetChange?: (preset: CameraPreset) => void;
  animationStateRef: React.MutableRefObject<CameraAnimationState | null>;
  controlsRef: React.MutableRefObject<any>;
}

export const SceneControls: React.FC<SceneControlsProps> = ({
  enableKeyboard = true,
  onPresetChange,
  animationStateRef,
  controlsRef,
}) => {
  const { camera } = useThree();
  const reducedMotion = useRef(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion.current = query.matches; };
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const keysPressed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }

      keysPressed.current.add(e.key.toLowerCase());

      const controls = controlsRef.current;
      if (!controls) return;

      switch (e.key.toLowerCase()) {
        case 'r':
          triggerPreset(CAMERA_PRESETS.oblique);
          break;
        case 't':
          triggerPreset(CAMERA_PRESETS.topDown);
          break;
        case 'f':
          triggerPreset(CAMERA_PRESETS.fitRegion);
          break;
        case '1':
          triggerPreset(CAMERA_PRESETS.oblique);
          break;
        case '2':
          triggerPreset(CAMERA_PRESETS.shackleton);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    const triggerPreset = (preset: CameraPreset) => {
      const controls = controlsRef.current;
      if (!controls) return;

      const curPos = camera.position.clone();
      const curTarget = controls.target.clone();

      animationStateRef.current = {
        isAnimating: true,
        startPosition: curPos,
        targetPosition: new THREE.Vector3(...preset.position),
        startLookAt: curTarget,
        targetLookAt: new THREE.Vector3(...preset.target),
        progress: 0,
        durationMs: 1000,
        startTime: performance.now(),
      };

      if (onPresetChange) {
        onPresetChange(preset);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enableKeyboard, camera, onPresetChange, animationStateRef, controlsRef]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const anim = animationStateRef.current;
    if (anim && anim.isAnimating) {
      const elapsed = performance.now() - anim.startTime;
      const linearProgress = reducedMotion.current ? 1 : Math.min(1.0, elapsed / anim.durationMs);
      const easedT = easeInOutCubic(linearProgress);

      camera.position.lerpVectors(anim.startPosition, anim.targetPosition, easedT);
      controls.target.lerpVectors(anim.startLookAt, anim.targetLookAt, easedT);
      controls.update();

      if (linearProgress >= 1.0) {
        anim.isAnimating = false;
        animationStateRef.current = null;
      }
      return;
    }

    if (enableKeyboard && keysPressed.current.size > 0) {
      const panSpeed = camera.position.distanceTo(controls.target) * 0.02;

      if (keysPressed.current.has('arrowleft')) {
        controls.pan(-panSpeed, 0);
      }
      if (keysPressed.current.has('arrowright')) {
        controls.pan(panSpeed, 0);
      }
      if (keysPressed.current.has('arrowup')) {
        controls.pan(0, panSpeed);
      }
      if (keysPressed.current.has('arrowdown')) {
        controls.pan(0, -panSpeed);
      }

      if (keysPressed.current.has('+') || keysPressed.current.has('=')) {
        controls.dollyIn(1.03);
      }
      if (keysPressed.current.has('-') || keysPressed.current.has('_')) {
        controls.dollyOut(1.03);
      }

      controls.update();
    }
  });

  return (
    <DreiOrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={400}
      maxDistance={80000}
      maxPolarAngle={Math.PI / 2 - 0.02}
      screenSpacePanning={false}
      enablePan
      panSpeed={1.2}
      rotateSpeed={0.8}
      zoomSpeed={1.0}
      target={DEFAULT_CAMERA_PRESET.target}
    />
  );
};
