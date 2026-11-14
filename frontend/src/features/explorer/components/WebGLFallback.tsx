import React from 'react';
import styles from '../styles/explorer.module.css';

export interface WebGLFallbackProps {
  error?: string;
  onRetry?: () => void;
}

export const WebGLFallback: React.FC<WebGLFallbackProps> = ({
  error,
  onRetry,
}) => {
  return (
    <div className={styles.fallbackContainer} role="alert" aria-live="assertive">
      <div className={styles.fallbackCard}>
        <div className={styles.fallbackIcon}>🌔</div>
        <h3 className={styles.fallbackTitle}>3D Lunar Terrain Unavailable</h3>
        <p className={styles.fallbackText}>
          Hardware-accelerated WebGL is not available or was disabled in your browser environment.
        </p>
        {error && (
          <div className={styles.fallbackErrorBox}>
            <code>{error}</code>
          </div>
        )}

        <div className={styles.fallbackSchematic} aria-label="2D South Polar Schematic">
          <svg viewBox="-120 -120 240 240" className={styles.schematicSvg}>
            <circle cx="0" cy="0" r="100" fill="#121820" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="0" y="-104" textAnchor="middle" fill="#64748b" fontSize="7">80°S Boundary</text>
            <circle cx="0" cy="0" r="50" fill="none" stroke="#253244" strokeWidth="1" strokeDasharray="2 2" />
            <text x="0" y="-53" textAnchor="middle" fill="#64748b" fontSize="6">85°S</text>
            <line x1="0" y1="-100" x2="0" y2="100" stroke="#1e293b" strokeWidth="1" />
            <line x1="-100" y1="0" x2="100" y2="0" stroke="#1e293b" strokeWidth="1" />
            <circle cx="0" cy="0" r="7" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
            <text x="10" y="3" fill="#f59e0b" fontSize="6" fontWeight="bold">Shackleton Rim (90°S)</text>
            <rect x="-12" y="5" width="6" height="14" fill="#38bdf8" rx="2" transform="rotate(25 -10 12)" />
            <text x="-25" y="24" fill="#38bdf8" fontSize="5">Connecting Ridge</text>
            <circle cx="-5" cy="-42" r="5" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
            <text x="5" y="-40" fill="#94a3b8" fontSize="5">Malapert Massif</text>
          </svg>
        </div>

        <div className={styles.fallbackActions}>
          {onRetry && (
            <button
              type="button"
              className={styles.retryButton}
              onClick={onRetry}
            >
              Retry 3D Initialization
            </button>
          )}
          <a
            href="https://get.webgl.org/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkButton}
          >
            Check WebGL Support
          </a>
        </div>
      </div>
    </div>
  );
};
