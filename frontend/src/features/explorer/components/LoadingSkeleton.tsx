import React from 'react';
import styles from '../styles/explorer.module.css';

export interface LoadingSkeletonProps {
  message?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  message = 'Initializing Lunar South Pole 3D Diorama...',
}) => {
  return (
    <div className={styles.loadingContainer} aria-busy="true" aria-live="polite">
      <div className={styles.loadingCard}>
        <div className={styles.pulseRing}>
          <div className={styles.lunarCore} />
        </div>
        <p className={styles.loadingText}>{message}</p>
        <div className={styles.loadingBar}>
          <div className={styles.loadingBarFill} />
        </div>
        <span className={styles.loadingSubtext}>
          LOLA Polar Elevation (80°S-90°S) • R3F / Three.js
        </span>
      </div>
    </div>
  );
};

