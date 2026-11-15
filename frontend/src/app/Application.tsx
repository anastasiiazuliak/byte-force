import { useMemo } from 'react';
import { AppShell } from './AppShell';
import { useWorkspace } from './useWorkspace';
import { WorkspaceContext, slots } from './WorkspaceSlots';
import { draftCoordinates } from './scenario';
import { ExportActions } from '../features/export/ExportActions';

export { errorMessage } from './errorMessage';

export function Application() {
  const w = useWorkspace();
  const selectedA = useMemo(
    () => draftCoordinates(w.a),
    [w.a.latitude, w.a.longitude],
  );
  const selectedB = useMemo(
    () => draftCoordinates(w.b),
    [w.b.latitude, w.b.longitude],
  );
  return (
    <WorkspaceContext.Provider value={w}>
      <AppShell
        slots={slots}
        dataMode={
          import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true'
            ? 'demo'
            : 'real'
        }
        view={w.view}
        onViewChange={w.setView}
        state={w.state}
        onRetry={() => void w.submit()}
        notice={
          <>
            {w.state === 'ready' && w.analyses.length > 0 && (
              <ExportActions
                run={{
                  mode:
                    import.meta.env.DEV &&
                    import.meta.env.VITE_USE_MOCKS === 'true'
                      ? 'demo'
                      : 'real',
                  scenarios: w.comparison
                    ? w.comparison.scenarios
                    : [{ id: 'A', analysis: w.analyses[0] }],
                  differences: w.comparison?.differences,
                }}
              />
            )}
            {w.startup.map((message, i) => (
              <p key={i} role="status">
                {message}
              </p>
            ))}
            {w.startup.length > 0 && (
              <button onClick={w.retryConnection}>Retry connection</button>
            )}
            <div className="status-chips">
              <span>Graphic shadows ≠ visibility</span>
              <span title="Mesh coordinates are interpolated from an 80 m LOLA grid, not surveyed subpixel landing positions.">
                {w.metadata?.terrainDataset.metadataVerified
                  ? 'Reviewed regional map'
                  : 'Illustrative map · geographic picks unavailable'}
              </span>
            </div>
            <details>
              <summary>Connection & lighting details</summary>
              <p data-testid="ephemeris-status">{w.ephemerisStatus}</p>
            </details>
          </>
        }
        scene={{
          metadata: w.metadata,
          selectedA,
          selectedB,
          timeUtc: w.timeUtc,
          onSelectSite: (site) => {
            w.change(site.slot, {
              ...(site.slot === 'A' ? w.a : w.b),
              latitude: String(site.location.latitude),
              longitude: String(site.location.longitude),
            });
          },
        }}
      />
    </WorkspaceContext.Provider>
  );
}
