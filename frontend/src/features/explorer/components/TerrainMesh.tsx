import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MapMetadataResponse } from '../../../api/types';
import type { SceneStatus } from '../types';
import { createSouthPoleDioramaGeometry } from '../scene/proceduralDem';
import { terrainAssetKey } from '../scene/metadata';
import { createLunarMaterial } from '../scene/materials';
import { polarGlobeMaterial } from '../scene/polarGlobe';

export interface TerrainMeshProps {
  metadata?: MapMetadataResponse | null;
  globeTexture?: THREE.Texture | null;
  onSurfaceReady?: (group: THREE.Group | null, key: string | null) => void;
  onLoadedBounds?: (bounds: THREE.Box3) => void;
  onStatus?: (status: SceneStatus) => void;
  onMeshClick?: (event: THREE.Intersection, loadedAssetKey: string | null) => void;
}

export const TerrainMesh: React.FC<TerrainMeshProps> = ({
  metadata,
  globeTexture,
  onLoadedBounds,
  onSurfaceReady,
  onStatus,
  onMeshClick,
}) => {
  const [loadedGltfScene, setLoadedGltfScene] = useState<THREE.Group | null>(null);
  const [, setIsLoadingGltf] = useState(false);
  const loadedKey = useRef<string | null>(null);
  const currentScene = useRef<THREE.Group | null>(null);
  const surfaceCallback = useRef(onSurfaceReady);
  surfaceCallback.current = onSurfaceReady;
  const assetKey = terrainAssetKey(metadata);
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

    loadedKey.current = null;
    surfaceCallback.current?.(null, null);
    setIsLoadingGltf(true);
    onStatus?.('loading');

    const loader = new GLTFLoader();
    let cancelled = false;

    loader.load(
      demoMeshUrl,
      (gltf) => {
        if (cancelled) { disposeTerrain(gltf.scene); return; }
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mesh.material = new THREE.MeshStandardMaterial({ color: globeTexture ? 0xffffff : 0x80848b,
              map: globeTexture, roughness: 0.95, metalness: 0, side: THREE.FrontSide });
            if (globeTexture) mesh.material.onBeforeCompile = polarGlobeMaterial;
            for (const material of originals) material.dispose();
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        gltf.scene.updateMatrixWorld(true);
        onLoadedBounds?.(new THREE.Box3().setFromObject(gltf.scene));
        const previous = currentScene.current;
        currentScene.current = gltf.scene;
        loadedKey.current = assetKey;
        surfaceCallback.current?.(gltf.scene, assetKey);
        setLoadedGltfScene(gltf.scene);
        if (previous) disposeTerrain(previous, globeTexture);
        setIsLoadingGltf(false);
        onStatus?.('ready');
      },
      undefined,
      (error) => {
        if (cancelled) return;
        console.warn('GLB asset loading failed, falling back to 3D lunar diorama mesh:', error);
        // Keep the previous display, but it remains unpickable.
        loadedKey.current = null;
        setIsLoadingGltf(false);
        onStatus?.('demo-only');
      }
    );

    return () => {
      cancelled = true;
      surfaceCallback.current?.(null, null);
    };
  }, [demoMeshUrl, assetKey, onStatus, globeTexture]);

  useEffect(() => () => { if (currentScene.current) disposeTerrain(currentScene.current, globeTexture); }, [globeTexture]);

  if (loadedGltfScene) {
    return (
      <primitive
        object={loadedGltfScene}
        onClick={(e: { intersections: THREE.Intersection[] }) => {
          if (e.intersections && e.intersections.length > 0 && onMeshClick) {
            onMeshClick(e.intersections[0], loadedKey.current === assetKey ? loadedKey.current : null);
          }
        }}
      />
    );
  }

  if (globeTexture) return null;
  return (
    <mesh
      ref={meshRef}
      geometry={proceduralGeometry}
      material={lunarMaterial}
      receiveShadow
      castShadow
      onClick={(e: { intersections: THREE.Intersection[] }) => {
        if (e.intersections && e.intersections.length > 0 && onMeshClick) {
          onMeshClick(e.intersections[0], null);
        }
      }}
    />
  );
};

/** GLTFLoader owns these resources, including textures on cancelled loads. */
export function disposeTerrain(root: THREE.Object3D, sharedTexture?: THREE.Texture | null) {
  const resources = new Set<{ dispose(): void }>();
  root.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    resources.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture && value !== sharedTexture) resources.add(value);
    }
  });
  resources.forEach(resource => resource.dispose());
}
