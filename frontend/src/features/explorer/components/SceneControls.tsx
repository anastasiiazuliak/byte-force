import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls as DreiOrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  DEFAULT_CAMERA_PRESET,
  easeInOutCubic,
} from '../scene/camera';
import type { CameraAnimationState } from '../scene/camera';
import type { CameraPreset } from '../types';
import { GLOBE_CENTER, GLOBE_MAX_POLAR_ANGLE, GLOBE_MIN_DISTANCE } from '../scene/polarGlobe';

export interface SceneControlsProps {
  enableKeyboard?: boolean;
  globe?: boolean;
  onFitCamera?: (topDown?: boolean) => void;
  onPresetChange?: (preset: CameraPreset) => void;
  animationStateRef: React.MutableRefObject<CameraAnimationState | null>;
  controlsRef: React.MutableRefObject<any>;
}

export const SceneControls: React.FC<SceneControlsProps> = ({
  enableKeyboard = true,
  globe = false,
  onFitCamera,
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
        case 'r': case 'f': case '1': case '2': onFitCamera?.(); break;
        case 't': onFitCamera?.(true); break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enableKeyboard, camera, onPresetChange, animationStateRef, controlsRef, onFitCamera]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const bounds = controls.terrainBounds as THREE.Box3 | undefined;
    if (bounds && !animationStateRef.current?.isAnimating) {
      const before = controls.target.clone();
      controls.target.clamp(bounds.min, bounds.max);
      camera.position.add(controls.target.clone().sub(before));
    }
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

      if (!globe && keysPressed.current.has('arrowleft')) {
        controls.pan(-panSpeed, 0);
      }
      if (!globe && keysPressed.current.has('arrowright')) {
        controls.pan(panSpeed, 0);
      }
      if (!globe && keysPressed.current.has('arrowup')) {
        controls.pan(0, panSpeed);
      }
      if (!globe && keysPressed.current.has('arrowdown')) {
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
      minDistance={globe ? GLOBE_MIN_DISTANCE : 400}
      maxDistance={globe ? Infinity : 80000}
      maxPolarAngle={globe ? GLOBE_MAX_POLAR_ANGLE : Math.PI / 2 - 0.02}
      screenSpacePanning={false}
      enablePan={!globe}
      panSpeed={1.2}
      rotateSpeed={0.8}
      zoomSpeed={1.0}
      target={globe ? GLOBE_CENTER : DEFAULT_CAMERA_PRESET.target}
    />
  );
};
