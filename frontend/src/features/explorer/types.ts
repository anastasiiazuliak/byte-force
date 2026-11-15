import type { Coordinates, IsoUtc, MapMetadataResponse } from '../../api/types';
import type {
  SiteSlot,
  SceneStatus,
  SceneSelectedSite,
  TerrainSceneProps,
  TerrainSceneCommands,
} from '../../../../contracts/scene/scene-types';

export type {
  Coordinates,
  IsoUtc,
  MapMetadataResponse,
  SiteSlot,
  SceneStatus,
  SceneSelectedSite,
  TerrainSceneProps,
  TerrainSceneCommands,
};

export interface CameraPreset {
  id: string;
  name: string;
  description: string;
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

export interface LunarTerrainViewerProps {
  globe?: boolean;
  metadata?: MapMetadataResponse | null;
  selectedA?: Coordinates | null;
  selectedB?: Coordinates | null;
  timeUtc?: IsoUtc | null;
  sunDirectionScene?: [number, number, number] | null;
  sunlightLabel?: string;
  sunDirectionMoonFixed?: [number, number, number] | null;
  onSelectSite?: (site: SceneSelectedSite) => void;
  onStatus?: (status: SceneStatus) => void;
  className?: string;
  style?: React.CSSProperties;
  enableKeyboardControls?: boolean;
  showOverlayControls?: boolean;
  showLightingBadge?: boolean;
  initialPresetId?: string;
  onCameraPresetChange?: (preset: CameraPreset) => void;
  testId?: string;
}

