import type { Coordinates } from '../../../api/types';
import {
  geographicToProjected,
  projectedToGeographic,
  isWithinSupportedRegion,
  LATITUDE_MIN_DEG,
  LATITUDE_MAX_DEG,
} from '../scene/projection';

export interface CoordinateValidationResult {
  valid: boolean;
  error?: string;
  normalized?: Coordinates;
}

export function normalizeLongitude(lon: number): number {
  let normalized = lon % 360;
  if (normalized > 180) {
    normalized -= 360;
  } else if (normalized < -180) {
    normalized += 360;
  }
  return normalized;
}

export function validateLunarCoordinates(latitude: number, longitude: number): CoordinateValidationResult {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
    return {
      valid: false,
      error: 'Invalid coordinate numbers provided.',
    };
  }

  const normLon = normalizeLongitude(longitude);

  if (!isWithinSupportedRegion(latitude)) {
    return {
      valid: false,
      error: `Out of supported area: Latitude ${latitude.toFixed(2)}° is outside the ${LATITUDE_MIN_DEG}° to ${LATITUDE_MAX_DEG}° South Pole region.`,
      normalized: { latitude, longitude: normLon },
    };
  }

  return {
    valid: true,
    normalized: { latitude, longitude: normLon },
  };
}

export function formatLunarCoordinates(coords: Coordinates): string {
  const lat = coords.latitude;
  const lon = normalizeLongitude(coords.longitude);

  const latStr = `${Math.abs(lat).toFixed(4)}°${lat < 0 ? 'S' : 'N'}`;
  const lonStr = `${Math.abs(lon).toFixed(4)}°${lon < 0 ? 'W' : 'E'}`;

  return `${latStr}, ${lonStr}`;
}

export function verifyCoordinateRoundtrip(
  latitude: number,
  longitude: number,
  toleranceDeg: number = 0.00001
): boolean {
  const normLon = normalizeLongitude(longitude);
  const projected = geographicToProjected(latitude, normLon);
  const inverted = projectedToGeographic(projected.x, projected.y);

  const latDiff = Math.abs(inverted.latitude - latitude);
  let lonDiff = Math.abs(inverted.longitude - normLon);
  if (lonDiff > 180) lonDiff = Math.abs(lonDiff - 360);

  if (latitude < -89.999) {
    return latDiff <= toleranceDeg;
  }

  return latDiff <= toleranceDeg && lonDiff <= toleranceDeg;
}
