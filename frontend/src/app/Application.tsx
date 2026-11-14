import { createContext, useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { AppShell, type ShellSlots, type View } from './AppShell';
import { createConfiguredClient } from '../integration/client';
import { ApiClientError, type HttpLunarApiClient } from '../api/client';
import type { AnalysisResponse, CompareResponse, ConfigResponse, LandingSite, MapMetadataResponse } from '../api/types';
import { LunarTerrainViewer } from '../features/explorer';
import { ScenarioFields } from '../features/scenario-form/ScenarioForm';
import { AnalysisPanel, metric } from '../features/analysis/AnalysisPanel';
import { MissionTimeline } from '../features/timeline/MissionTimeline';
import { initialDraft, LatestRequest, parseScenario, type ScenarioDraft } from './scenario';
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
        api.mapMetadata(controller.signal).then(value => { if (!controller.signal.aborted) setMetadata(value); }, e => { messages.push(`Map metadata unavailable; illustrative fallback only. ${errorMessage(e)}`); }),
      ]);
      if (!controller.signal.aborted) setStartup(messages);
    }).catch(e => { if (!controller.signal.aborted) setStartup([errorMessage(e)]); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => () => request.current.cancel(), []);
  function invalidate() { request.current.cancel(); setAnalyses([]); setComparison(null); setState('empty'); setError(''); }
  function change(id: 'A' | 'B', draft: ScenarioDraft) { invalidate(); (id === 'A' ? setA : setB)(draft); }
  function setView(value: View) { invalidate(); setViewState(value); }
  async function submit(event?: FormEvent) {
    event?.preventDefault(); const run = request.current.begin(); setError(''); setAnalyses([]); setComparison(null);
    try {
      if (!client) throw new Error('API client is not ready. Retry connection.');
      const scenarioA = parseScenario(a, config), scenarioB = view === 'compare' ? parseScenario(b, config) : null;
      setState('loading');
      setEphemerisStatus('Checking Moon-fixed ephemeris; artistic lighting remains illustrative.');
      void client.ephemeris(scenarioA.period, run.signal).then(() => {
        if (run.current()) setEphemerisStatus('Ephemeris received; vector-to-scene lighting adapter is not validated. Artistic preview lighting only.');
      }, e => { if (run.current()) setEphemerisStatus(`Moon-fixed ephemeris unavailable: ${errorMessage(e)}. Artistic preview lighting only.`); });
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
  return { client, config, sites, metadata, startup, view, setView, a, b, change, analyses, comparison, timeUtc, setTime, state, error, ephemerisStatus, submit, retryConnection: () => { invalidate(); setReload(v => v + 1); } };
}
function useData() { return useContext(WorkspaceContext)!; }
function FormSlot() {
  const w = useData();
  return <form onSubmit={w.submit}><ScenarioFields id="A" draft={w.a} sites={w.sites} onChange={draft => w.change('A', draft)} />{w.view === 'compare' && <><button type="button" onClick={() => w.change('B', { ...w.a })}>Copy A to B</button><button type="button" onClick={() => { const a = w.a; w.change('A', w.b); w.change('B', a); }}>Swap A ↔ B</button><ScenarioFields id="B" draft={w.b} sites={w.sites} onChange={draft => w.change('B', draft)} /></>}<button className="primary-button" type="submit" disabled={!w.client}>{w.state === 'loading' ? 'Restart analysis' : w.view === 'compare' ? 'Compare scenarios' : 'Analyze site'}</button><p>Changing inputs cancels pending results. Run analysis explicitly.</p>{w.error && <p role="alert" data-testid="analysis-error">{w.error}</p>}</form>;
}
function AnalysisSlot() { const w = useData(); return <AnalysisPanel analysis={w.analyses[0]} timeUtc={w.timeUtc} />; }
function CompareSlot({ site }: { site: 1 | 2 }) { const w = useData(); return <><AnalysisPanel analysis={w.analyses[site - 1]} timeUtc={w.timeUtc} />{site === 2 && w.comparison && <div data-testid="comparison-differences"><h3>Difference B − A</h3>{Object.entries(w.comparison.differences).map(([key,value]) => <p key={key}>{key}: {value != null && value > 0 ? '+' : ''}{metric(value, ' h')}</p>)}</div>}</>; }
function TimelineSlot() { const w = useData(); return <MissionTimeline analyses={w.analyses} timeUtc={w.timeUtc} onTime={w.setTime} />; }
const slots: ShellSlots = { TerrainViewer: LunarTerrainViewer, ScenarioForm: FormSlot, AnalysisPanel: AnalysisSlot, ComparePanel: CompareSlot, MissionTimeline: TimelineSlot };
export function Application() {
  const w = useWorkspace();
  const coordinates = (draft: ScenarioDraft) => { try { return parseScenario(draft, w.config).location; } catch { return null; } };
  return <WorkspaceContext.Provider value={w}><AppShell slots={slots} dataMode={import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true' ? 'demo' : 'real'} view={w.view} onViewChange={w.setView} state={w.state} onRetry={() => void w.submit()} notice={<>{w.startup.map((message,i) => <p key={i} role="status">{message}</p>)}{w.startup.length > 0 && <button onClick={w.retryConnection}>Retry connection</button>}<p>3D terrain and lighting may be illustrative. Graphic shadows are not scientific visibility. Unverified terrain cannot provide geographic picks.</p><p data-testid="ephemeris-status">{w.ephemerisStatus}</p></>} scene={{ metadata: w.metadata, selectedA: coordinates(w.a), selectedB: coordinates(w.b), timeUtc: w.timeUtc, onSelectSite: site => { w.change(site.slot, { ...(site.slot === 'A' ? w.a : w.b), latitude: String(site.location.latitude), longitude: String(site.location.longitude) }); } }} /></WorkspaceContext.Provider>;
}
