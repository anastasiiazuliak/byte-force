/** Proposed v2 contract, frozen for first parallel wave. Example data must be labeled synthetic. */
export type IsoUtc = string; // ISO 8601 with Z
export type Visibility = boolean | null; // null = unavailable/indeterminate
export type ScenarioId = 'A' | 'B';
export interface Coordinates { latitude:number; longitude:number }
export interface Location extends Coordinates { elevationM:number|null }
export interface Period { startUtc:IsoUtc; endUtc:IsoUtc; stepMinutes:number }
export interface AnalysisOptions { terrainModel:'lola'; includeHorizon:boolean }
export interface AnalysisRequest { location:Coordinates; period:Period; options?:AnalysisOptions }
export interface BodyPosition { azimuthDeg:number; elevationDeg:number; horizonDeg:number|null; clearanceDeg:number|null; visible:Visibility }
export interface AnalysisSample { timeUtc:IsoUtc; sun:BodyPosition; earth:BodyPosition }
export interface Interval { startUtc:IsoUtc; endUtc:IsoUtc }
export interface Summary { sunVisibleHours:number|null; earthVisibleHours:number|null; bothVisibleHours:number|null; sunVisiblePercent:number|null; earthVisiblePercent:number|null }
export interface Quality { ephemerisSource:string; terrainSource:string|null; terrainApplied:boolean; terrainResolutionMeters:number|null; visibilityMethod:string; warnings:string[] }
export interface HorizonPoint { azimuthDeg:number; elevationDeg:number }
export interface HorizonProfile { points:HorizonPoint[] }
export interface AnalysisResponse { status:'complete'|'partial'; location:Location; period:Period; summary:Summary; samples:AnalysisSample[]; intervals:{sunVisible:Interval[];earthVisible:Interval[]}; horizon:HorizonProfile|null; quality:Quality }
export interface CompareScenarioRequest { id:ScenarioId; location:Coordinates; period:Period; options?:AnalysisOptions }
export interface CompareRequest { scenarios:[CompareScenarioRequest,CompareScenarioRequest] }
export interface ComparisonDifferences { sunVisibleHours:number|null;earthVisibleHours:number|null;bothVisibleHours:number|null }
export interface CompareResponse { scenarios:[{id:ScenarioId;analysis:AnalysisResponse},{id:ScenarioId;analysis:AnalysisResponse}]; differences:ComparisonDifferences }
export interface ConfigResponse { region:{id:string;name:string;latitudeMin:number;latitudeMax:number;longitudeMin:number;longitudeMax:number}; analysis:{minStepMinutes:number;maxStepMinutes:number;maxSamples:number;maxScenarios:2}; features:{terrainAnalysis:boolean;scenarioComparison:boolean;horizonProfile:boolean;moonFixedEphemeris:boolean} }
export interface LandingSite {id:string;name:string;description:string;latitude:number;longitude:number;sourceUrl:string|null}
export interface LandingSitesResponse {sites:LandingSite[]}
export interface ProjectedBounds {minX:number;minY:number;maxX:number;maxY:number}
export interface MapMetadataResponse { regionId:string; projection:{name:'south-polar-stereographic';projDefinition:string|null;sourceFrame:string|null;linearUnit:'m'}; render:{type:'projected-terrain';tileSize:number;minZoom:number;maxZoom:number;boundsMeters:ProjectedBounds|null;sceneTransform:{originEastingM:number;originNorthingM:number;verticalOriginM:number;validated:boolean}|null};assets:{terrainTemplate:string|null;surfaceTemplate:string|null;hillshadeTemplate:string|null;demoMeshUrl:string|null};terrainDataset:{id:string;sourceResolutionMeters:number;verticalReference:string|null;metadataVerified:boolean} }
export interface EphemerisRequest {startUtc:IsoUtc;endUtc:IsoUtc;stepMinutes:number}
export interface EphemerisSample {timeUtc:IsoUtc;sunDirection:[number,number,number];earthDirection:[number,number,number]}
export interface EphemerisResponse {referenceFrame:string;vectorConvention:string;samples:EphemerisSample[];quality:{source:string;warnings:string[]}}
export interface ApiError {error:{code:'VALIDATION_ERROR'|'LOCATION_OUT_OF_BOUNDS'|'TERRAIN_DATA_UNAVAILABLE'|'EPHEMERIS_UNAVAILABLE'|'ANALYSIS_TIMEOUT'|'INTERNAL_ERROR';message:string;details?:Record<string,unknown>}}
export interface HealthResponse {status:'ok';version:string}
export interface LunarApiClient {
  health():Promise<HealthResponse>; config():Promise<ConfigResponse>;
  landingSites():Promise<LandingSitesResponse>; mapMetadata():Promise<MapMetadataResponse>;
  analyze(request:AnalysisRequest):Promise<AnalysisResponse>;
  compare(request:CompareRequest):Promise<CompareResponse>;
  ephemeris(request:EphemerisRequest):Promise<EphemerisResponse>;
}
