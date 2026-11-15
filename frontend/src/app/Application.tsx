import { createContext, useContext, useEffect, useRef, useState, useMemo, lazy, Suspense, type FormEvent } from 'react';
import { AppShell, type ShellSlots, type View } from './AppShell';
import { createConfiguredClient } from '../integration/client';
import { ApiClientError, type HttpLunarApiClient } from '../api/client';
import type { AnalysisResponse, CompareResponse, ConfigResponse, LandingSite, MapMetadataResponse } from '../api/types';
import { solarSceneDirection } from '../features/explorer/lighting/solarSceneDirection';
import type { TerrainSceneProps } from '../../../contracts/scene/scene-types';
const LunarTerrainViewer = lazy(() => import('../features/explorer').then(module => ({ default: module.LunarTerrainViewer })));
import { ScenarioFields } from '../features/scenario-form/ScenarioForm';
import { AnalysisPanel, metric } from '../features/analysis/AnalysisPanel';
import { ExportActions } from '../features/export/ExportActions';
import { MissionTimeline } from '../features/timeline/MissionTimeline';
import { exploratoryPatches, loadSiteCatalog, type Overview } from './siteCatalog';
import { initialDraft, LatestRequest, parseScenario, draftCoordinates, type ScenarioDraft } from './scenario';
export function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return `${error.apiError?.error.code ?? error.kind}${error.status ? ` (HTTP ${error.status})` : ''}: ${error.apiError?.error.message ?? error.message}`;
  return error instanceof Error ? error.message : 'Request failed';
}
const WorkspaceContext = createContext<ReturnType<typeof useWorkspace> | null>(null);
function useWorkspace() {
  const [client, setClient] = useState<HttpLunarApiClient | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [sites, setSites] = useState<LandingSite[]>([]);
  const [metadata, setMetadata] = useState<MapMetadataResponse | null>(null);
  const [patches, setPatches] = useState(exploratoryPatches);
  const [globe, setGlobe] = useState<Overview | null>(null);
  const [representation, setRepresentation] = useState<'globe' | 'terrain'>('globe');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [currentSite, setCurrentSite] = useState('');
  const mapIntent = useRef<string | null>(null);
  const [startup, setStartup] = useState<string[]>(['Connecting to API…']);
  const [reload, setReload] = useState(0);
  const [view, setViewState] = useState<View>('analyze');
  const [a, setA] = useState<ScenarioDraft>({ ...initialDraft });
  const [b, setB] = useState<ScenarioDraft>({ ...initialDraft });
  const [analyses, setAnalyses] = useState<AnalysisResponse[]>([]);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [timeUtc, setTime] = useState(initialDraft.start + ':00Z');
  const [state, setState] = useState<'empty' | 'loading' | 'error' | 'ready'>('empty');
  const [error, setError] = useState('');
  const [ephemerisStatus, setEphemerisStatus] = useState('Moon-fixed ephemeris not requested; artistic preview lighting only.');
  const request = useRef(new LatestRequest());
  useEffect(() => {
    const controller = new AbortController();
    setStartup(['Connecting to API…']); setMetadata(null); setConfig(null); setSites([]);
    void createConfiguredClient().then(async api => {
      if (controller.signal.aborted) return;
      setClient(api);
      const messages: string[] = [];
      await Promise.all([
        api.health(controller.signal).then(() => {}, e => { messages.push(`Health: ${errorMessage(e)}`); }),
        api.config(controller.signal).then(value => { if (!controller.signal.aborted) setConfig(value); }, e => { messages.push(`Configuration unavailable; conservative local limits apply. ${errorMessage(e)}`); }),
        api.landingSites(controller.signal).then(value => { if (!controller.signal.aborted) setSites(value.sites); }, e => { messages.push(`Catalog unavailable; enter coordinates manually. ${errorMessage(e)}`); }),
        api.mapMetadata(controller.signal).then(value => { if (!controller.signal.aborted) { setMetadata(value); void loadSiteCatalog(controller.signal, value, o => { if (!controller.signal.aborted) { setOverview(o); if (mapIntent.current === null || mapIntent.current === o.id) { setMetadata(o.metadata); setCurrentSite(o.id); } } }, g => { if (!controller.signal.aborted) setGlobe(g); }).then(p => { if (!controller.signal.aborted) { setPatches(p); const selected = p.find(patch => patch.id === mapIntent.current); if (selected?.metadata) setMetadata(selected.metadata); } }); } }, e => { messages.push(`Map metadata unavailable; illustrative fallback only. ${errorMessage(e)}`); }),
      ]);
      if (!controller.signal.aborted) setStartup(messages);
    }).catch(e => { if (!controller.signal.aborted) setStartup([errorMessage(e)]); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => () => request.current.cancel(), []);
  function invalidate() { request.current.cancel(); setAnalyses([]); setComparison(null); setState('empty'); setError(''); }
  function selectPatch(id: string) {
    setRepresentation('terrain');
    mapIntent.current = id;
    if (id === overview?.id) { setCurrentSite(id); setMetadata(overview.metadata); return; }
    const patch = patches.find(p => p.id === id); if (!patch) return;
    invalidate(); setCurrentSite(id); if (patch.metadata) setMetadata(patch.metadata);
    setA(d => ({ ...d, latitude: String(patch.latitude), longitude: String(patch.longitude) }));
  }
  function prepareCompare() {
    invalidate(); setViewState('compare');
    const first = patches[0], second = patches[1];
    mapIntent.current = first.id;
    setA(d => ({ ...d, latitude: String(first.latitude), longitude: String(first.longitude) }));
    setB(d => ({ ...d, latitude: String(second.latitude), longitude: String(second.longitude) }));
    setCurrentSite(first.id); if (first.metadata) setMetadata(first.metadata);
  }
  function quickCompare() {
    const first = patches[0], second = patches[1];
    mapIntent.current = first.id;
    const start = new Date(a.start + ':00Z');
    const candidateEnd = new Date(start.getTime() + 3600000);
    const end = Number.isFinite(candidateEnd.getTime()) ? candidateEnd.toISOString().slice(0,16) : a.end;
    const draftA = { ...a, latitude: String(first.latitude), longitude: String(first.longitude), end, step: '60' };
    const draftB = { ...draftA, latitude: String(second.latitude), longitude: String(second.longitude) };
    setA(draftA); setB(draftB); setViewState('compare'); setCurrentSite(first.id);
    if (first.metadata) setMetadata(first.metadata);
    void submit(undefined, { a: draftA, b: draftB, view: 'compare' });
  }
  function change(id: 'A' | 'B', draft: ScenarioDraft) { invalidate(); if (id === 'A' && (draft.latitude !== a.latitude || draft.longitude !== a.longitude)) setCurrentSite(''); (id === 'A' ? setA : setB)(draft); }
  function setView(value: View) { invalidate(); setViewState(value); }
  async function submit(event?: FormEvent, override?: { a: ScenarioDraft; b: ScenarioDraft; view: View }) {
    event?.preventDefault(); const run = request.current.begin(); setError(''); setAnalyses([]); setComparison(null);
    try {
      if (!client) throw new Error('API client is not ready. Retry connection.');
      const scenarioA = parseScenario(override?.a ?? a, config), scenarioB = (override?.view ?? view) === 'compare' ? parseScenario(override?.b ?? b, config) : null;
      setState('loading');
      if (config !== null && !config.features.moonFixedEphemeris) {
        setEphemerisStatus('Moon-fixed ephemeris disabled by server config; local cached Sun-angle lighting is used only on a reviewed map and matching sample.');
      } else {
        setEphemerisStatus('Checking Moon-fixed ephemeris; artistic lighting remains illustrative.');
        void client.ephemeris(scenarioA.period, run.signal).then(() => {
          if (run.current()) setEphemerisStatus('Auxiliary Moon-fixed ephemeris received. Scene uses only local Sun angles from the selected cached analysis sample; graphical lighting is not visibility.');
        }, e => { if (run.current()) setEphemerisStatus(`Moon-fixed ephemeris unavailable: ${errorMessage(e)}. Local cached Sun-angle lighting is used only on a reviewed map and matching sample.`); });
      }
      if (scenarioB) {
        const result = await client.compare({ scenarios: [{ id: 'A', ...scenarioA }, { id: 'B', ...scenarioB }] }, run.signal);
        if (!run.current()) return;
        const ordered = ['A', 'B'].map(id => result.scenarios.find(s => s.id === id)!.analysis);
        setComparison(result); setAnalyses(ordered); setTime(ordered[0].samples[0]?.timeUtc ?? ordered[0].period.startUtc);
      } else {
        const result = await client.analyze(scenarioA, run.signal);
        if (!run.current()) return; setAnalyses([result]); setTime(result.samples[0]?.timeUtc ?? result.period.startUtc);
      }
      setState('ready');
    } catch (e) { if (run.current()) { setError(errorMessage(e)); setState('error'); } }
  }
  return { globe, representation, setRepresentation, overview, patches, currentSite, selectPatch, prepareCompare, quickCompare, cancel: invalidate, client, config, sites, metadata, startup, view, setView, a, b, change, analyses, comparison, timeUtc, setTime, state, error, ephemerisStatus, submit, retryConnection: () => { invalidate(); setReload(v => v + 1); } };
}
function useData() { return useContext(WorkspaceContext)!; }
function FormSlot() {
  const w = useData();
  return <form onSubmit={w.submit} aria-busy={w.state === 'loading'}><div className="quickstart"><label>Exploratory patch<select aria-label="Exploratory patch" value={w.currentSite} onChange={e => w.selectPatch(e.target.value)}><option value="">Choose coordinates</option>{w.overview && <option value={w.overview.id}>South Pole Overview</option>}{w.patches.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label><button type="button" disabled={!w.overview} onClick={() => w.overview && w.selectPatch(w.overview.id)}>South Pole Overview</button><small>Coarse whole-pole overview → native 80 m patches on selection. No continuous global high-resolution tiles. Terrain View is a planar map; Globe View shows the Moon with south-polar relief at 1× height.</small><small>Exploratory coordinates · not approved landing sites or recommendations.</small><button type="button" onClick={w.prepareCompare}>Prepare patch comparison</button><button type="button" onClick={w.quickCompare} disabled={!w.client}>Quick compare · 2 samples/site</button><small>Quick comparison uses one UTC hour. Unknown visibility is never ranked.</small></div><ScenarioFields id="A" draft={w.a} sites={w.sites} onChange={draft => w.change('A', draft)} />{w.view === 'compare' && <><button type="button" onClick={() => w.change('B', { ...w.a })}>Copy A to B</button><button type="button" onClick={() => { const a = w.a; w.change('A', w.b); w.change('B', a); }}>Swap A ↔ B</button><ScenarioFields id="B" draft={w.b} sites={w.sites} onChange={draft => w.change('B', draft)} /></>}<button className="primary-button" type="submit" disabled={!w.client}>{w.state === 'loading' ? 'Restart analysis' : w.view === 'compare' ? 'Compare scenarios' : 'Analyze site'}</button>{w.state === 'loading' && <button type="button" onClick={w.cancel}>Cancel analysis</button>}<p>Changing inputs cancels pending results. Run analysis explicitly.</p>{w.error && <p role="alert" data-testid="analysis-error">{w.error}</p>}</form>;
}
function AnalysisSlot() { const w = useData(); return <AnalysisPanel analysis={w.analyses[0]} timeUtc={w.timeUtc} />; }
function CompareSlot({ site }: { site: 1 | 2 }) { const w = useData(); return <><AnalysisPanel analysis={w.analyses[site - 1]} timeUtc={w.timeUtc} slot={site === 1 ? 'A' : 'B'} />{site === 2 && w.comparison && <div data-testid="comparison-differences"><h3>Difference B − A</h3>{Object.entries(w.comparison.differences).map(([key,value]) => <p key={key}>{key}: {value != null && value > 0 ? '+' : ''}{metric(value, ' h')}</p>)}</div>}</>; }
function TimelineSlot() { const w = useData(); return <MissionTimeline analyses={w.analyses} timeUtc={w.timeUtc} onTime={w.setTime} />; }
function SceneSlot(props: TerrainSceneProps) {
  const w = useData();
  const [scientific, setScientific] = useState(false);
  const globe = w.representation === 'globe';
  const sceneMetadata = globe ? w.globe?.metadata ?? null : props.metadata;
  const analysis = w.analyses[0];
  const sample = analysis?.samples.find(s => Date.parse(s.timeUtc) === Date.parse(w.timeUtc));
  const direction = solarSceneDirection(sceneMetadata, analysis?.location ?? null, sample?.sun ?? null);
  const enabled = w.representation === 'terrain' && Boolean(direction);
  const lightingLabel = w.representation === 'globe' ? 'Fixed sunlight · visualization' :
    scientific && enabled ? 'Cached Sun at A · graphic estimate' : 'Exploration Lighting · illustrative fill';
  return <div className="explorer-stage"><div className="explorer-toolbar" aria-label="Explorer view and lighting">
    <div role="group" aria-label="Representation"><button type="button" aria-pressed={w.representation === 'globe'} onClick={() => w.setRepresentation('globe')}>Globe View</button><button type="button" aria-pressed={w.representation === 'terrain'} onClick={() => w.setRepresentation('terrain')}>Terrain View</button></div>
    <details className="explorer-guide"><summary>Explore → Choose Site → Analyze</summary><p>Full Moon viewed from the south pole. Geographic picking is available on reviewed relief at 80–90°S. Drag to orbit, scroll to zoom; choose A or B before clicking. Set UTC in Site & Time, then Analyze. Select a native patch for detail. Views share coordinates, time and results.</p></details>
    <label className="lighting-toggle"><input type="checkbox" checked={scientific && enabled} disabled={!enabled} onChange={e => setScientific(e.target.checked)} />Scientific Sun Lighting</label>
<<<<<<< Updated upstream
    <span className="lighting-explanation" title={w.representation === 'globe' ? 'The globe uses a fixed Sun direction for visualization.' : 'Scientific Sun Lighting requires a matching cached sample at A on reviewed terrain. Graphic shadows are not visibility.'}>{lightingLabel}</span>
  </div>{w.representation === 'globe' && !w.globe ? <p role="status">Reviewed Globe catalog unavailable. Choose Terrain View to inspect the available map.</p> : <Suspense fallback={<p role="status" className="terrain-loading">Preparing 3D explorer…</p>}><LunarTerrainViewer {...props} metadata={sceneMetadata} sunDirectionScene={scientific && enabled ? direction : null} sunlightLabel={scientific && enabled ? 'Sun at A · approximate map lighting · not visibility' : lightingLabel} /></Suspense>}</div>;
=======
    <span className="lighting-explanation" title={globe ? 'Globe View uses a fixed direction and a latitude-based working-area mask.' : 'Scientific Sun Lighting requires a matching cached sample at A on reviewed terrain. Graphic shadows are not visibility.'}>{globe ? 'Fixed sunlight · visualization' : scientific && enabled ? 'Cached Sun at A · graphic estimate' : 'Exploration Lighting · illustrative fill'}</span>
  </div>{globe && !w.globe && <p role="status">Reviewed Globe catalog unavailable. Geographic picking requires the reviewed polar relief.</p>}<Suspense fallback={<p role="status" className="terrain-loading">Preparing 3D explorer…</p>}><LunarTerrainViewer {...props} globe={globe} metadata={sceneMetadata} sunDirectionScene={scientific && enabled ? direction : null} sunlightLabel={scientific && enabled ? 'Sun at A · approximate map lighting · not visibility' : globe ? 'Fixed sunlight · visualization' : 'Exploration Lighting · illustrative fill'} /></Suspense></div>;
>>>>>>> Stashed changes

}
const slots: ShellSlots = { TerrainViewer: SceneSlot, ScenarioForm: FormSlot, AnalysisPanel: AnalysisSlot, ComparePanel: CompareSlot, MissionTimeline: TimelineSlot };
export function Application() {
  const w = useWorkspace();
  const selectedA = useMemo(() => draftCoordinates(w.a), [w.a.latitude, w.a.longitude]);
  const selectedB = useMemo(() => draftCoordinates(w.b), [w.b.latitude, w.b.longitude]);
  return <WorkspaceContext.Provider value={w}><AppShell slots={slots} dataMode={import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true' ? 'demo' : 'real'} view={w.view} onViewChange={w.setView} state={w.state} onRetry={() => void w.submit()} notice={<>{w.state === 'ready' && w.analyses.length > 0 && <ExportActions run={{ mode: import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true' ? 'demo' : 'real', scenarios: w.comparison ? w.comparison.scenarios : [{ id: 'A', analysis: w.analyses[0] }], differences: w.comparison?.differences }} />}{w.startup.map((message,i) => <p key={i} role="status">{message}</p>)}{w.startup.length > 0 && <button onClick={w.retryConnection}>Retry connection</button>}<div className="status-chips"><span>Graphic shadows ≠ visibility</span><span title="Mesh coordinates are interpolated from an 80 m LOLA grid, not surveyed subpixel landing positions.">{w.metadata?.terrainDataset.metadataVerified ? 'Reviewed regional map' : 'Illustrative map · geographic picks unavailable'}</span></div><details><summary>Connection & lighting details</summary><p data-testid="ephemeris-status">{w.ephemerisStatus}</p></details></>} scene={{ metadata: w.metadata, selectedA, selectedB, timeUtc: w.timeUtc, onSelectSite: site => { w.change(site.slot, { ...(site.slot === 'A' ? w.a : w.b), latitude: String(site.location.latitude), longitude: String(site.location.longitude) }); } }} /></WorkspaceContext.Provider>;
}
