import { useState, type ComponentType, type ReactNode } from 'react';
import type { TerrainSceneProps } from '../../../contracts/scene/scene-types';
import { Panel } from '../components/layout/Panel';

export type View = 'analyze' | 'compare';
export type DataMode = 'demo' | 'real';
export type ContentState = 'empty' | 'loading' | 'error' | 'ready';

export interface ShellSlots {
  TerrainViewer: ComponentType<TerrainSceneProps>;
  ScenarioForm: ComponentType<{ view: View }>;
  AnalysisPanel: ComponentType;
  MissionTimeline: ComponentType<{ view: View }>;
  ComparePanel: ComponentType<{ site: 1 | 2 }>;
}

const emptyScene: TerrainSceneProps = {
  metadata: null,
  selectedA: null,
  selectedB: null,
  timeUtc: null,
  onSelectSite: () => {},
};

export function PanelState({ state, onRetry, children }: {
  state: ContentState;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (state === 'ready') return children;
  if (state === 'loading') return <p role="status" className="loading">Loading…</p>;
  if (state === 'empty') return <p role="status">Waiting for analysis.</p>;
  return <div role="alert"><p>Could not load analysis.</p>{onRetry && <button onClick={onRetry}>Retry</button>}</div>;
}

export function AppShell({ slots, dataMode, scene = emptyScene, state = 'ready', onRetry, view: controlledView, onViewChange, notice }: {
  view?: View;
  onViewChange?: (view: View) => void;
  notice?: ReactNode;
  slots: ShellSlots;
  dataMode: DataMode;
  scene?: TerrainSceneProps;
  state?: ContentState;
  onRetry?: () => void;
}) {
  const [localView, setLocalView] = useState<View>('analyze');
  const view = controlledView ?? localView;
  const setView = onViewChange ?? setLocalView;
  const [showLearn, setShowLearn] = useState(false);
  const { TerrainViewer, ScenarioForm, AnalysisPanel, MissionTimeline, ComparePanel } = slots;

  return (
    <div className="app-shell" lang="en"><a className="skip-link" href="#site-time">Skip to site and time</a>
      <header className="app-header">
        <h1>Lunar Site Navigator</h1>
        <nav aria-label="Workspace">
          <button aria-pressed={view === 'analyze'} onClick={() => setView('analyze')}>Analyze</button>
          <button aria-pressed={view === 'compare'} onClick={() => setView('compare')}>Compare</button>
        </nav>
        <div className="header-tools">
          <span className="data-mode">{dataMode === 'demo' ? 'Demo · Synthetic' : 'Live API · quality varies'}</span>
          <button aria-expanded={showLearn} aria-controls="learn" onClick={() => setShowLearn(!showLearn)}>Learn</button>
        </div>
      </header>
      <aside id="learn" hidden={!showLearn}>
        Explore lunar coordinates, not approved landing sites. Regional DEM horizons and clearances are estimates; distant terrain is not certified. Unknown visibility is not zero visible time.
        {dataMode === 'demo' && ' Demo intervals are illustrative.'}<p>Method: LOLA regional terrain, MOON_ME / DE421, radial height above the 1737.4 km sphere; reviewed UTC 1962–2649. Airless apparent disc centers, not power, thermal safety or communication performance. Sampled profiles do not certify a complete skyline.</p>
      </aside>
      {notice && <div className="workspace-notice">{notice}</div>}
      <main className={`workspace${view === 'compare' ? ' workspace--compare' : ''}`}>
        <section className="scene" id="terrain-scene-slot" aria-label="Lunar terrain">
          <TerrainViewer {...scene} />
        </section>
        <Panel id="site-time" title="Site & Time" collapsible>
          <ScenarioForm view={view} />
          {state === 'loading' && <div className="analysis-progress">
            <p id="analysis-progress-label" role="status">{view === 'compare' ? 'Comparing scenarios…' : 'Calculating analysis…'}</p>
            <div className="analysis-progress-track" role="progressbar" aria-labelledby="analysis-progress-label" />
          </div>}
        </Panel>
        <Panel id="analysis" title={view === 'compare' ? 'Site 1 · Analysis' : 'Analysis'} collapsible>
          <PanelState state={state} onRetry={onRetry}>{view === 'compare' ? <ComparePanel site={1} /> : <AnalysisPanel />}</PanelState>
        </Panel>
        {view === 'compare' && (
          <Panel id="comparison" title="Site 2 · Analysis" collapsible>
            <PanelState state={state} onRetry={onRetry}><ComparePanel site={2} /></PanelState>
          </Panel>
        )}
        <Panel id="timeline" title="Conditions Timeline">
          <PanelState state={state}><MissionTimeline view={view} /></PanelState>
        </Panel>
      </main>
    </div>
  );
}
