import React, { useState } from 'react';
import type { CameraPreset, SceneStatus } from '../types';
import styles from '../styles/explorer.module.css';

export interface ViewerOverlayProps {
  status: SceneStatus;
  currentPreset?: CameraPreset;
  isHorizonsLighting?: boolean;
  onReset: () => void;
  onTopDown: () => void;
  onFitRegion: () => void;
  onSelectPreset: (presetId: string) => void;
}

export const ViewerOverlay: React.FC<ViewerOverlayProps> = ({
  status,
  currentPreset,
  isHorizonsLighting = false,
  onReset,
  onTopDown,
  onFitRegion,
  onSelectPreset,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  const getStatusBadge = () => {
    switch (status) {
      case 'ready':
        return (
          <span className={`${styles.statusBadge} ${styles.statusReady}`} title="Verified DEM mesh loaded">
            <span className={styles.statusDot} />
            Terrain: Ready (GLB)
          </span>
        );
      case 'demo-only':
        return (
          <span className={`${styles.statusBadge} ${styles.statusDemo}`} title="Dev-only 3D polar relief diorama (DATA-03 pending)">
            <span className={styles.statusDot} />
            3D Diorama (LOLA Polar)
          </span>
        );
      case 'loading':
        return (
          <span className={`${styles.statusBadge} ${styles.statusLoading}`} title="Loading 3D mesh assets">
            <span className={styles.statusDot} />
            Loading Terrain...
          </span>
        );
      case 'error':
        return (
          <span className={`${styles.statusBadge} ${styles.statusError}`} title="Failed to load terrain mesh">
            <span className={styles.statusDot} />
            Mesh Error
          </span>
        );
    }
  };

  return (
    <div className={styles.overlayContainer} aria-label="3D Viewer Controls">
      <div className={styles.topBar}>
        <div className={styles.badgeGroup}>
          {getStatusBadge()}
          <span
            className={`${styles.lightingBadge} ${
              isHorizonsLighting ? styles.lightingHorizons : styles.lightingPreview
            }`}
            title={
              isHorizonsLighting
                ? 'Solar vector driven by verified JPL Horizons ephemeris'
                : 'Preview lighting (Polar low grazing angle ~2.5°); not an official eclipse calculation'
            }
          >
            {isHorizonsLighting ? '☀ Sun: Horizons Vector' : '☀ Sun: Preview Grazing (2.5°)'}
          </span>
        </div>

        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setShowHelp((prev) => !prev)}
          title="Keyboard shortcuts and navigation tips"
          aria-label="Toggle navigation help"
        >
          ⌨ ?
        </button>
      </div>

      {showHelp && (
        <div className={styles.helpPanel} role="region" aria-label="Navigation Shortcuts">
          <div className={styles.helpHeader}>
            <h4>3D Navigation Shortcuts</h4>
            <button
              type="button"
              className={styles.closeHelpButton}
              onClick={() => setShowHelp(false)}
              aria-label="Close help"
            >
              ×
            </button>
          </div>
          <ul className={styles.helpList}>
            <li><kbd>Left Click + Drag</kbd> / <kbd>1-finger</kbd>: Orbit around target</li>
            <li><kbd>Right Click + Drag</kbd> / <kbd>2-finger</kbd>: Pan camera</li>
            <li><kbd>Scroll</kbd> / <kbd>Pinch</kbd>: Zoom in / out</li>
            <li><kbd>Arrow Keys</kbd>: Smooth pan</li>
            <li><kbd>+</kbd> / <kbd>-</kbd>: Zoom step</li>
            <li><kbd>R</kbd>: Reset to South Pole oblique view</li>
            <li><kbd>T</kbd>: Top-down nadir view</li>
            <li><kbd>F</kbd>: Fit region to view</li>
            <li><kbd>1</kbd> / <kbd>2</kbd>: Camera presets (South Pole / Shackleton)</li>
          </ul>
        </div>
      )}

      <div className={styles.bottomBar}>
        <div className={styles.buttonGroup} role="toolbar" aria-label="Camera Controls">
          <button
            type="button"
            className={`${styles.controlButton} ${currentPreset?.id === 'oblique' ? styles.activeButton : ''}`}
            onClick={onReset}
            title="Reset to oblique South Pole perspective (Shortcut: R)"
          >
            Reset (R)
          </button>

          <button
            type="button"
            className={`${styles.controlButton} ${currentPreset?.id === 'topDown' ? styles.activeButton : ''}`}
            onClick={onTopDown}
            title="Switch to direct nadir top-down view (Shortcut: T)"
          >
            Top-Down (T)
          </button>

          <button
            type="button"
            className={`${styles.controlButton} ${currentPreset?.id === 'fitRegion' ? styles.activeButton : ''}`}
            onClick={onFitRegion}
            title="Fit entire 80°S-90°S region (Shortcut: F)"
          >
            Fit Region (F)
          </button>

          <div className={styles.divider} />

          <button
            type="button"
            className={`${styles.controlButton} ${currentPreset?.id === 'shackleton' ? styles.activeButton : ''}`}
            onClick={() => onSelectPreset('shackleton')}
            title="Close-up inspection of Shackleton crater rim (Shortcut: 2)"
          >
            Shackleton Rim (2)
          </button>
        </div>
      </div>
    </div>
  );
};
