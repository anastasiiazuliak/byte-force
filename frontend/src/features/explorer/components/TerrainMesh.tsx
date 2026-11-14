import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MapMetadataResponse } from '../../../api/types';
import type { SceneStatus } from '../types';
import { createSouthPoleDioramaGeometry } from '../scene/proceduralDem';
import { createLunarMaterial } from '../scene/materials';

export interface TerrainMeshProps {
  metadata?: MapMetadataResponse | null;
  onStatus?: (status: SceneStatus) => void;
  onMeshClick?: (event: THREE.Intersection) => void;
}

export const TerrainMesh: React.FC<TerrainMeshProps> = ({
  metadata,
  onStatus,
  onMeshClick,
}) => {
  const [loadedGltfScene, setLoadedGltfScene] = useState<THREE.Group | null>(null);
  const [isLoadingGltf, setIsLoadingGltf] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  // Display-only contributed asset; geographic picking still requires verified metadata.
  const demoMeshUrl = metadata?.assets?.demoMeshUrl ?? '/terrain/0/0/0.glb';

  const proceduralGeometry = useMemo(() => {
    return createSouthPoleDioramaGeometry({
      widthMeters: 80000,
      heightMeters: 80000,
      segmentsX: 160,
      segmentsY: 160,
    });
  }, []);

  const lunarMaterial = useMemo(() => {
    return createLunarMaterial();
  }, []);

  useEffect(() => {
    return () => {
      proceduralGeometry.dispose();
      lunarMaterial.dispose();
    };
  }, [proceduralGeometry, lunarMaterial]);

  useEffect(() => {
    if (!demoMeshUrl) {
      setLoadedGltfScene(null);
      setIsLoadingGltf(false);
      onStatus?.('demo-only');
      return;
    }

    setLoadedGltfScene(null);
    setIsLoadingGltf(true);
    onStatus?.('loading');

    const loader = new GLTFLoader();
    let cancelled = false;

    loader.load(
      demoMeshUrl,
      (gltf) => {
        if (cancelled) return;
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        setLoadedGltfScene(gltf.scene);
        setIsLoadingGltf(false);
        onStatus?.('ready');
      },
      undefined,
      (error) => {
        if (cancelled) return;
        console.warn('GLB asset loading failed, falling back to 3D lunar diorama mesh:', error);
        setLoadedGltfScene(null);
        setIsLoadingGltf(false);
        onStatus?.('demo-only');
      }
    );

    return () => {
      cancelled = true;
    };
  }, [demoMeshUrl, onStatus]);

  if (loadedGltfScene && !isLoadingGltf) {
    return (
      <primitive
        object={loadedGltfScene}
        onClick={(e: { intersections: THREE.Intersection[] }) => {
          if (e.intersections && e.intersections.length > 0 && onMeshClick) {
            onMeshClick(e.intersections[0]);
          }
        }}
      />
    );
  }

  return (
    <mesh
      ref={meshRef}
      geometry={proceduralGeometry}
      material={lunarMaterial}
      receiveShadow
      castShadow
      onClick={(e: { intersections: THREE.Intersection[] }) => {
        if (e.intersections && e.intersections.length > 0 && onMeshClick) {
          onMeshClick(e.intersections[0]);
        }
      }}
    />
  );
};
