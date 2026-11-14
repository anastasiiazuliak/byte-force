import React from 'react';
import type { TileTelemetry } from './tileTypes';
import styles from '../styles/explorer.module.css';

export interface TileTelemetryOverlayProps {
  telemetry: TileTelemetry;
  visible?: boolean;
}

export const TileTelemetryOverlay: React.FC<TileTelemetryOverlayProps> = ({
  telemetry,
  visible = true,
}) => {
  if (!visible) return null;

  return (
    <div className={styles.telemetryCard} role="status" aria-label="LOD Telemetry">
      <div className={styles.telemetryTitle}>3D Tile LOD Telemetry</div>
      <div className={styles.telemetryGrid}>
        <div>Active Zoom (LOD):</div>
        <div className="mono">{telemetry.activeZoom}</div>
        <div>Visible Tiles:</div>
        <div className="mono">{telemetry.visibleTilesCount}</div>
        <div>Pending Requests:</div>
        <div className="mono">{telemetry.pendingRequestsCount}</div>
        <div>GPU Memory Cache:</div>
        <div className="mono">{telemetry.memoryEstimateMB} MB</div>
      </div>
    </div>
  );
};
