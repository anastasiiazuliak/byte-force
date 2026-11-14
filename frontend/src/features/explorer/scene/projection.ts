/**
 * Lunar South Polar Stereographic Projection (ARC-03 / Snyder Moon 2015 Sphere)
 *
 * Ground truth reference: contracts/fixtures/coordinate-control-points.json
 * Backend parity: backend/LunarNavigator.Core/Terrain/LunarProjection.cs
 */

export const MOON_RADIUS_METERS = 1737400.0;
export const SOUTH_POLE_LATITUDE = -90.0;
export const CENTRAL_MERIDIAN_LONGITUDE = 0.0;
export const LATITUDE_MIN_DEG = -90.0;
export const LATITUDE_MAX_DEG = -80.0;

export interface ProjectedPoint {
  x: number; // Easting in meters
  y: number; // Northing in meters
}

export interface GeographicCoordinates {
  latitude: number;  // [-90.0, -80.0]
  longitude: number; // [-180.0, 180.0]
}

export interface ScenePoint {
  x: number; // scene X (easting - origin)
  y: number; // scene Y (elevation - verticalOrigin)
  z: number; // scene Z (-(northing - origin))
}

export interface SceneTransformOrigin {
  originEastingM: number;
  originNorthingM: number;
  verticalOriginM: number;
}

export const DEFAULT_SCENE_ORIGIN: SceneTransformOrigin = {
  originEastingM: 0.0,
  originNorthingM: 0.0,
  verticalOriginM: 0.0,
};

/**
 * Converts lunar geographic coordinates (lat, lon in degrees)
 * to South Polar Stereographic projected coordinates (x, y in meters).
 */
export function geographicToProjected(latDeg: number, lonDeg: number): ProjectedPoint {
  const colatDeg = 90.0 + latDeg;
  if (colatDeg <= 0.0) {
    return { x: 0.0, y: 0.0 };
  }

  const colatRad = colatDeg * (Math.PI / 180.0);
  const rho = 2.0 * MOON_RADIUS_METERS * Math.tan(colatRad / 2.0);

  const lonRad = lonDeg * (Math.PI / 180.0);
  const x = rho * Math.sin(lonRad);
  const y = rho * Math.cos(lonRad);

  return { x, y };
}

/**
 * Converts South Polar Stereographic projected coordinates (x, y in meters)
 * back to geographic coordinates (lat, lon in degrees).
 */
export function projectedToGeographic(x: number, y: number): GeographicCoordinates {
  const rho = Math.hypot(x, y);
  if (rho < 1e-9) {
    return { latitude: SOUTH_POLE_LATITUDE, longitude: CENTRAL_MERIDIAN_LONGITUDE };
  }

  const c = 2.0 * Math.atan(rho / (2.0 * MOON_RADIUS_METERS));
  const latitude = (c * (180.0 / Math.PI)) - 90.0;
  const longitude = Math.atan2(x, y) * (180.0 / Math.PI);

  return { latitude, longitude };
}

/**
 * Converts projected coordinates (meters) and height (meters) to 3D scene space.
 * Right-Handed Y-Up convention:
 * X_scene = easting - originEasting
 * Y_scene = height - verticalOrigin
 * Z_scene = -(northing - originNorthing)
 */
export function projectedToScene(
  projected: ProjectedPoint,
  elevationM: number = 0,
  origin: SceneTransformOrigin = DEFAULT_SCENE_ORIGIN
): ScenePoint {
  return {
    x: projected.x - origin.originEastingM,
    y: elevationM - origin.verticalOriginM,
    z: -(projected.y - origin.originNorthingM),
  };
}

/**
 * Converts 3D scene coordinates back to projected coordinates and elevation.
 */
export function sceneToProjected(
  scene: ScenePoint,
  origin: SceneTransformOrigin = DEFAULT_SCENE_ORIGIN
): { projected: ProjectedPoint; elevationM: number } {
  return {
    projected: {
      x: scene.x + origin.originEastingM,
      y: -scene.z + origin.originNorthingM,
    },
    elevationM: scene.y + origin.verticalOriginM,
  };
}

/**
 * Converts geographic coordinates and elevation directly to 3D scene coordinates.
 */
export function geographicToScene(
  coords: GeographicCoordinates,
  elevationM: number = 0,
  origin: SceneTransformOrigin = DEFAULT_SCENE_ORIGIN
): ScenePoint {
  const projected = geographicToProjected(coords.latitude, coords.longitude);
  return projectedToScene(projected, elevationM, origin);
}

/**
 * Converts 3D scene coordinates directly to geographic coordinates.
 */
export function sceneToGeographic(
  scene: ScenePoint,
  origin: SceneTransformOrigin = DEFAULT_SCENE_ORIGIN
): GeographicCoordinates & { elevationM: number } {
  const { projected, elevationM } = sceneToProjected(scene, origin);
  const geo = projectedToGeographic(projected.x, projected.y);
  return { ...geo, elevationM };
}

/**
 * Validates whether the given latitude is within the supported South Pole region (80°S - 90°S).
 */
export function isWithinSupportedRegion(latitudeDeg: number): boolean {
  return latitudeDeg >= LATITUDE_MIN_DEG && latitudeDeg <= LATITUDE_MAX_DEG;
}

