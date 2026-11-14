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

export function AppShell({ slots, dataMode, scene = emptyScene, state = 'ready', onRetry }: {
  slots: ShellSlots;
  dataMode: DataMode;
  scene?: TerrainSceneProps;
  state?: ContentState;
  onRetry?: () => void;
}) {
  const [view, setView] = useState<View>('analyze');
  const [showLearn, setShowLearn] = useState(false);
  const { TerrainViewer, ScenarioForm, AnalysisPanel, MissionTimeline, ComparePanel } = slots;

  return (
    <div className="app-shell" lang="en">
      <header className="app-header">
        <h1>Lunar Site Navigator</h1>
        <nav aria-label="Workspace">
          <button aria-pressed={view === 'analyze'} onClick={() => setView('analyze')}>Analyze</button>
          <button aria-pressed={view === 'compare'} onClick={() => setView('compare')}>Compare</button>
        </nav>
        <div className="header-tools">
          <span className="data-mode">{dataMode === 'demo' ? 'Demo · Synthetic' : 'Real data'}</span>
          <button aria-expanded={showLearn} aria-controls="learn" onClick={() => setShowLearn(!showLearn)}>Learn</button>
        </div>
      </header>
      <aside id="learn" hidden={!showLearn}>
        The workspace displays sunlight and Earth visibility for lunar landing sites.
        {dataMode === 'demo' && ' Demo intervals are illustrative.'}
      </aside>
      <main className="workspace">
        <section className="scene" id="terrain-scene-slot" aria-label="Lunar terrain">
          <TerrainViewer {...scene} />
        </section>
        <Panel id="site-time" title="Site & Time" collapsible><ScenarioForm view={view} /></Panel>
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
