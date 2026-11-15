import React from 'react';
import type { Coordinates } from '../../../api/types';
import type { SiteSlot } from '../types';
import { formatLunarCoordinates } from '../selection/selectionManager';
import styles from '../styles/explorer.module.css';

export interface SiteSlotSelectorProps {
  activeSlot: SiteSlot;
  onSlotChange: (slot: SiteSlot) => void;
  selectedA?: Coordinates | null;
  selectedB?: Coordinates | null;
  onFlyToSite?: (slot: SiteSlot) => void;
  outOfBoundsError?: string | null;
  onDismissError?: () => void;
}

export const SiteSlotSelector: React.FC<SiteSlotSelectorProps> = ({
  activeSlot,
  onSlotChange,
  selectedA,
  selectedB,
  onFlyToSite,
  outOfBoundsError,
  onDismissError,
}) => {
  return (
    <div className={styles.slotSelectorPanel} role="region" aria-label="Site Placement Toolbar">
      {outOfBoundsError && (
        <div className={styles.outOfBoundsBanner} role="alert">
          <span>⚠ {outOfBoundsError}</span>
          {onDismissError && (
            <button
              type="button"
              className={styles.dismissErrorButton}
              onClick={onDismissError}
              aria-label="Dismiss warning"
            >
              ×
            </button>
          )}
        </div>
      )}

      <div className={styles.slotTabs}>
        <button
          type="button"
          className={`${styles.slotTab} ${styles.slotTabA} ${
            activeSlot === 'A' ? styles.activeSlotTabA : ''
          }`}
          onClick={() => onSlotChange('A')}
          title="Click to place or inspect Landing Site A"
          aria-pressed={activeSlot === 'A'}
        >
          <span className={styles.slotIndicatorA + " " + styles.siteColorA} />
          Site A
          {selectedA && (
            <span className={styles.slotCoordSmall}>
              {formatLunarCoordinates(selectedA)}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`${styles.slotTab} ${styles.slotTabB} ${
            activeSlot === 'B' ? styles.activeSlotTabB : ''
          }`}
          onClick={() => onSlotChange('B')}
          title="Click to place or inspect Landing Site B"
          aria-pressed={activeSlot === 'B'}
        >
          <span className={styles.slotIndicatorB + " " + styles.siteColorB} />
          Site B
          {selectedB && (
            <span className={styles.slotCoordSmall}>
              {formatLunarCoordinates(selectedB)}
            </span>
          )}
        </button>
      </div>

      <div className={styles.slotActions}>
        {selectedA && (
          <button
            type="button"
            className={styles.focusSiteButton}
            onClick={() => onFlyToSite?.('A')}
            title="Focus camera on Site A"
          >
            Focus Site A
          </button>
        )}
        {selectedB && (
          <button
            type="button"
            className={styles.focusSiteButton}
            onClick={() => onFlyToSite?.('B')}
            title="Focus camera on Site B"
          >
            Focus Site B
          </button>
        )}
      </div>
    </div>
  );
};

