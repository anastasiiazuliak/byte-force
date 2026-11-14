import type { Coordinates, IsoUtc, MapMetadataResponse } from '../api-types';
/** Frontend 3D lane (1) owns implementation; UI lane (2) consumes this API via composition. */
export type SiteSlot = 'A'|'B';
export type SceneStatus = 'loading'|'ready'|'demo-only'|'error';
export interface SceneSelectedSite { slot:SiteSlot; location:Coordinates; scenePosition:{x:number;y:number;z:number}; elevationM:number|null }
export interface TerrainSceneProps {
  metadata:MapMetadataResponse|null;
  selectedA:Coordinates|null;
  selectedB:Coordinates|null;
  timeUtc:IsoUtc|null;
  /** The backend-provided vectors must be validated Moon-fixed, never arbitrary values. */
  sunDirectionMoonFixed?:[number,number,number]|null;
  onSelectSite:(site:SceneSelectedSite)=>void;
  onStatus?:(status:SceneStatus)=>void;
}
export interface TerrainSceneCommands {
  flyTo:(location:Coordinates)=>void;
  reset:()=>void;
  setTopDown:()=>void;
  fitRegion:()=>void;
}
