import React from 'react';
import type { InterpolatedCelestialPositions } from '../lighting/solarEphemeris';
import type { IsoUtc } from '../../../api/types';
import styles from '../styles/explorer.module.css';

export interface CelestialOverlayProps {
  celestial?: InterpolatedCelestialPositions | null;
  timeUtc?: IsoUtc | null;
  visible?: boolean;
}

export const CelestialOverlay: React.FC<CelestialOverlayProps> = ({
  celestial,
  timeUtc,
  visible = true,
}) => {
  if (!visible) return null;

  return (
    <div className={styles.celestialPanel} role="region" aria-label="Celestial Positions">
      <div className={styles.celestialHeader}>
        <span className={styles.celestialTitle}>Celestial Horizons Tracking</span>
        {timeUtc && (
          <span className={`${styles.celestialTime} mono`}>
            {new Date(timeUtc).toISOString().replace('.000', '')}
          </span>
        )}
      </div>

      <div className={styles.celestialGrid}>
        {/* Sun Data */}
        <div className={styles.celestialColumn}>
          <div className={styles.celestialIconSun}>☀ Sun (Solar Vector)</div>
          <div className="data-row">
            <span className="data-label">Elevation:</span>
            <span className="data-value mono">
              {celestial ? `${celestial.sunElevationDeg.toFixed(1)}°` : '2.5° (Preview)'}
            </span>
          </div>
          <div className="data-row">
            <span className="data-label">Azimuth:</span>
            <span className="data-value mono">
              {celestial ? `${celestial.sunAzimuthDeg.toFixed(1)}°` : '135.0° (Preview)'}
            </span>
          </div>
        </div>

        {/* Earth Data */}
        <div className={styles.celestialColumn}>
          <div className={styles.celestialIconEarth}>🌍 Earth (Comms Vector)</div>
          <div className="data-row">
            <span className="data-label">Elevation:</span>
            <span className="data-value mono">
              {celestial ? `${celestial.earthElevationDeg.toFixed(1)}°` : '4.5° (Nominal)'}
            </span>
          </div>
          <div className="data-row">
            <span className="data-label">Azimuth:</span>
            <span className="data-value mono">
              {celestial ? `${celestial.earthAzimuthDeg.toFixed(1)}°` : '215.0° (Nominal)'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.celestialDisclaimer}>
        ⚠ Visual shadows are illustrative. Scientific visibility is verified via backend LOLA DEM horizon calculations.
      </div>
    </div>
  );
};
