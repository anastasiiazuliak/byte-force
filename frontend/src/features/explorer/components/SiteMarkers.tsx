import { Html } from '@react-three/drei';
import type { Coordinates } from '../../../api/types';
import type { SiteSlot } from '../types';
import type { ScenePoint } from '../scene/projection';
import { formatLunarCoordinates } from '../selection/selectionManager';
import styles from '../styles/explorer.module.css';

export interface SiteMarkersProps {
  positionA?: ScenePoint | null;
  positionB?: ScenePoint | null;
  selectedA?: Coordinates | null;
  selectedB?: Coordinates | null;
  activeSlot?: SiteSlot;
  onMarkerClick?: (slot: SiteSlot, coords: Coordinates) => void;
}

export function SiteMarkers({ positionA, positionB, selectedA, selectedB, activeSlot = 'A', onMarkerClick }: SiteMarkersProps) {
  const sites = [
    { slot: 'A', position: positionA, coordinates: selectedA, color: styles.siteColorA },
    { slot: 'B', position: positionB, coordinates: selectedB, color: styles.siteColorB },
  ] as const;

  return <group name="site-markers">
    {sites.map(({ slot, position, coordinates, color }) => {
      if (!position || !coordinates) return null;
      const label = `Site ${slot}: ${formatLunarCoordinates(coordinates)}`;
      return (
        <Html key={slot} position={[position.x, position.y + 10, position.z]} center occlude>
          <button
            type="button"
            className={`${styles.siteMapMarker} ${color} ${slot === activeSlot ? styles.activeSiteMapMarker : ''}`}
            onClick={() => onMarkerClick?.(slot, coordinates)}
            aria-label={label}
            title={label}
          >
            {slot}
          </button>
        </Html>
      );
    })}
  </group>;
}
