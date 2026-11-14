import * as THREE from 'three';

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export interface TileBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type TileStatus = 'idle' | 'loading' | 'loaded' | 'failed';

export interface TileNode {
  key: string;
  coord: TileCoord;
  bounds: TileBounds;
  status: TileStatus;
  mesh?: THREE.Object3D | null;
  parentKey?: string | null;
  childrenKeys?: string[];
  lastUsedTimestamp: number;
  abortController?: AbortController;
}

export interface TileManifest {
  formatVersion: string;
  datasetId: string;
  attribution: string;
  crs: {
    name: string;
    projection: string;
    datum: string;
    radiusMeters: number;
    standardParallel: number;
    centralMeridian: number;
    falseEasting?: number;
    falseNorthing?: number;
  };
  boundsProjectedMeters: TileBounds;
  boundsGeographic: {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
  };
  rootTileExtentsMeters: number;
  minZoom: number;
  maxZoom: number;
  tileGridScheme: 'XYZ' | 'TMS';
  sceneTransform: {
    axisMapping: {
      sceneX: string;
      sceneY: string;
      sceneZ: string;
    };
    verticalScale: number;
    referenceElevationMeters: number;
    meshLocalOrigin: 'center' | 'southWestCorner';
  };
  layers: {
    terrainMesh?: {
      urlTemplate: string;
      format: string;
      hasSkirts?: boolean;
    };
    imagery?: {
      urlTemplate: string;
      format: string;
    };
    hillshade?: {
      urlTemplate: string;
      format: string;
    };
  };
}

export interface TileTelemetry {
  activeZoom: number;
  visibleTilesCount: number;
  loadedTilesCount: number;
  pendingRequestsCount: number;
  cachedTilesCount: number;
  memoryEstimateMB: number;
}
