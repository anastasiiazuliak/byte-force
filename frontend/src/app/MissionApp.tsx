import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ComponentType, FormEvent } from 'react';
import type { ConfigResponse, HealthResponse, LandingSite, MapMetadataResponse } from '../api/types';
import { createApiClient, type HttpLunarApiClient } from '../api/client';
import type { TerrainSceneProps, SceneStatus, SiteSlot } from '../../../contracts/scene/scene-types';
import { Panel } from '../components/layout/Panel';
import { AnalysisPanel } from '../features/analysis/AnalysisPanel';
import { compare, difference, errorMessage, type Results } from '../features/compare/compare';
import { ExportActions } from '../features/export/ExportActions';
import { Glossary } from '../features/methodology/Quality';
import { PeriodFields, SitePicker } from '../features/scenario-form/ScenarioForm';
import { coordinates, defaultDraft, validate, type Draft } from '../features/scenario-form/scenario';
import { MissionTimeline } from '../features/timeline/MissionTimeline';
import { axisFor } from '../features/timeline/time';

type Mode = 'real' | 'demo';
type Resource<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; value: T };

function useResource<T>(method: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState<Resource<T>>({ state: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    method(controller.signal).then(
      value => { if (!controller.signal.aborted) setResource({ state: 'ready', value }); },
      error => { if (!controller.signal.aborted) setResource({ state: 'error', message: errorMessage(error) }); },
    );
    return () => controller.abort();
  }, [method, attempt]);
  return {
    resource,
    value: resource.state === 'ready' ? resource.value : undefined,
    retry: () => { setResource({ state: 'loading' }); setAttempt(count => count + 1); },
  };
}

function ResourceStatus<T>({ label, entry, ready }: {
  label: string; entry: ReturnType<typeof useResource<T>>; ready: (value: T) => string;
}) {
  const { resource } = entry;
  return <li><strong>{label} · </strong>
    {resource.state === 'loading' && <span role="status">Loading…</span>}
    {resource.state === 'ready' && ready(resource.value)}
    {resource.state === 'error' && <><span role="alert">{resource.message}</span> <button onClick={entry.retry}>Retry {label}</button></>}
  </li>;
}

interface Run {
  results: Results;
  errors: (string | null)[];
  phase: 'empty' | 'loading' | 'error' | 'ready';
}
const idle: Run = { results: [null, null], errors: [], phase: 'empty' };
const IntegratedTerrain = lazy(async () => {
  const { LunarTerrainViewer } = await import('../features/explorer/components/LunarTerrainViewer');
  return { default: LunarTerrainViewer };
});

export function MissionApp({ client, mode, TerrainViewer }: {
  client: HttpLunarApiClient;
  mode: Mode;
  TerrainViewer?: ComponentType<TerrainSceneProps>;
}) {
  const [view, setView] = useState<'analyze' | 'compare'>('analyze');
  const [drafts, setDrafts] = useState<[Draft, Draft | null]>([defaultDraft, null]);
  const [custom, setCustom] = useState(false);
  const [separatePeriods, setSeparatePeriods] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [learn, setLearn] = useState(false);
  const [editing, setEditing] = useState(true);
  const [relative, setRelative] = useState(false);
  const [time, setTime] = useState(0);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [pickSlot, setPickSlot] = useState<SiteSlot | null>(null);
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>('loading');
  const [run, setRun] = useState<Run>(idle);
  const [validation, setValidation] = useState<string[]>([]);
  const pending = useRef<AbortController | null>(null);
  const retry = useRef<(() => void) | null>(null);
  const siteHeading = useRef<HTMLButtonElement>(null);
  const health = useResource<HealthResponse>(client.health);
  const config = useResource<ConfigResponse>(client.config);
  const catalog = useResource(client.landingSites);
  const metadata = useResource<MapMetadataResponse>(client.mapMetadata);
  const sites: LandingSite[] = catalog.value?.sites ?? [];
  const verifiedTerrain = mode === 'real' && metadata.value?.terrainDataset.metadataVerified &&
    metadata.value.render.sceneTransform?.validated && metadata.value.assets.terrainTemplate;
  const SceneComponent = TerrainViewer ?? (verifiedTerrain ? IntegratedTerrain : undefined);

  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (!editing) siteHeading.current?.focus();
  }, [editing]);

  const comparing = view === 'compare';
  const visibleResults = comparing ? run.results : [run.results[0]];
  const deltas = difference(...run.results);
  const timeFor = (index: number) => {
    const result = run.results[index];
    return !result ? null : relative ? time + Date.parse(result.period.startUtc) : time;
  };
  const plotAxis = axisFor(visibleResults, relative);

  function clearResults() {
    pending.current?.abort();
    retry.current = null;
    setRun(idle);
    setValidation([]);
  }

  function changeView(next: typeof view) {
    if (next === view) return;
    clearResults();
    setView(next);
    setRelative(false);
    setEditing(true);
    setPickSlot(null);
  }

  function updateDraft(index: 0 | 1, draft: Draft) {
    clearResults();
    setDrafts(([a, b]) => index === 0 ? [draft, b] : [a, draft]);
  }

  function setAxis(next: boolean) {
    const axis = axisFor(visibleResults, next);
    setRelative(next);
    setTime(axis?.start ?? 0);
    setTimelineVersion(version => version + 1);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const a = validate(drafts[0], config.value);
    const b = comparing ? (drafts[1] ? validate(separatePeriods ? drafts[1] : {
      ...drafts[1], start: drafts[0].start, end: drafts[0].end, step: drafts[0].step,
    }, config.value) : 'Add a second scenario.') : null;
    if (typeof a === 'string' || typeof b === 'string') {
      setValidation([typeof a === 'string' ? 'Site 1: ' + a : '', typeof b === 'string' ? 'Site 2: ' + b : ''].filter(Boolean));
      return;
    }
    const first = a;
    const second = b;
    async function execute() {
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      setValidation([]);
      setRun({ ...idle, phase: 'loading' });
      try {
        const outcome = second
          ? await compare(client, [{ ...first, id: 'A' }, { ...second, id: 'B' }], controller.signal)
          : { results: [await client.analyze(first, controller.signal), null] as Results, errors: [] };
        if (controller.signal.aborted) return;
        const axis = axisFor(outcome.results, false);
        setTime(axis?.start ?? 0);
        setRelative(false);
        setTimelineVersion(version => version + 1);
        setRun({ ...outcome, phase: axis ? 'ready' : 'error' });
        if (second && axis) setEditing(false);
      } catch (error) {
        if (!controller.signal.aborted) setRun({ ...idle, phase: 'error', errors: [errorMessage(error)] });
      }
    }
    retry.current = () => { void execute(); };
    retry.current();
  }

  function resultPanel(index: 0 | 1) {
    const result = run.results[index];
    const selectedTime = timeFor(index);
    if (result && selectedTime !== null) return <AnalysisPanel result={result} time={selectedTime} advanced={advanced}
      axis={plotAxis ?? undefined} relative={relative} />;
    return <p>{run.errors[index] ?? 'Scenario result unavailable.'}</p>;
  }

  const sceneTime = timeFor(0) ?? timeFor(1);
  const ready = run.phase === 'ready';
  const periodA = run.results[0]?.period;
  const periodB = run.results[1]?.period;
  const differentPeriods = periodA && periodB && (periodA.startUtc !== periodB.startUtc || periodA.endUtc !== periodB.endUtc);
  const picked = pickSlot === 'B' ? drafts[1] : drafts[0];

  return (
    <div className="app-shell mission-app" lang="en">
      <header className="app-header">
        <h1>Lunar Site Navigator</h1>
        <nav aria-label="Workspace">
          <button aria-pressed={!comparing} onClick={() => changeView('analyze')}>Analyze</button>
          <button aria-pressed={comparing} onClick={() => changeView('compare')}>Compare</button>
        </nav>
        <div className="header-tools">
          <span className="data-mode">{mode === 'demo' ? 'Demo · Synthetic' : 'Real data'}</span>
          <button aria-expanded={learn} aria-controls="learn" onClick={() => setLearn(!learn)}>Learn</button>
        </div>
      </header>
      <aside id="learn" hidden={!learn}><Glossary /></aside>
      <main className={`mission-workspace ${comparing ? 'compare-workspace' : ''} ${ready ? 'has-results' : ''} ${editing ? 'editing' : 'closed-form'}`}>
        <section className="scene mission-scene" id="terrain-scene-slot" aria-label="Lunar terrain">
          {SceneComponent ? <Suspense fallback={<p className="loading" role="status">Loading terrain viewer…</p>}>
            <SceneComponent metadata={metadata.value ?? null} selectedA={coordinates(drafts[0], config.value?.region)}
              selectedB={comparing && drafts[1] ? coordinates(drafts[1], config.value?.region) : null}
              timeUtc={sceneTime === null ? null : new Date(sceneTime).toISOString()} onStatus={setSceneStatus}
              onSelectSite={({ location }) => {
                if (!picked || !pickSlot) return;
                setCustom(true);
                updateDraft(pickSlot === 'B' ? 1 : 0, { ...picked, siteId: '', latitude: String(location.latitude), longitude: String(location.longitude) });
                setPickSlot(null);
              }} />
            {sceneStatus !== 'ready' && <p className="terrain-caption" role="status">{sceneStatus === 'error' ? 'Terrain failed to load' : sceneStatus === 'loading' ? 'Loading terrain…' : 'Demo terrain'}</p>}
            {pickSlot && <p className="pick-prompt" role="status">Select a location on the terrain for site {pickSlot}.</p>}
          </Suspense> : <><div className="terrain-disc" aria-hidden="true" /><p className="terrain-caption">Terrain preview</p></>}
        </section>

        <section className="panel site-editor" aria-labelledby="site-time-toggle">
          <h2><button ref={siteHeading} id="site-time-toggle" aria-controls="site-time-form" aria-expanded={editing}
            onClick={() => { setEditing(!editing); setPickSlot(null); }}><span>Site &amp; Time</span><span aria-hidden="true">☰</span></button></h2>
          <div className="panel-body" id="site-time-form" hidden={!editing}>
            <form onSubmit={submit}>
              <div className="coordinate-modes" role="group" aria-label="Coordinate entry mode">
                <button type="button" disabled={!sites.length} aria-pressed={!custom && !!sites.length} onClick={() => setCustom(false)}>Select Coordinates</button>
                <button type="button" aria-pressed={custom || !sites.length} onClick={() => setCustom(true)}>Custom Coordinates</button>
              </div>
              <SitePicker draft={drafts[0]} onChange={draft => updateDraft(0, draft)} sites={sites} custom={custom} label={comparing ? 'Site 1' : 'Landing site'}
                onPick={SceneComponent && sceneStatus === 'ready' ? () => setPickSlot('A') : undefined} />
              {comparing && (drafts[1] ? <>
                <SitePicker draft={drafts[1]} onChange={draft => updateDraft(1, draft)} sites={sites} custom={custom} label="Site 2"
                  onPick={SceneComponent && sceneStatus === 'ready' ? () => setPickSlot('B') : undefined} />
                <div className="actions">
                  <button type="button" onClick={() => {
                    clearResults();
                    setDrafts(([a, b]) => b ? [separatePeriods ? b : { ...b, start: a.start, end: a.end, step: a.step }, a] : [a, b]);
                  }}>Swap A ↔ B</button>
                  <button type="button" onClick={() => updateDraft(1, { ...drafts[0] })}>Copy A to B</button>
                  <button type="button" onClick={() => { clearResults(); setDrafts(([a]) => [a, null]); setSeparatePeriods(false); }}>Reset B</button>
                </div>
                <label className="check"><input type="checkbox" checked={separatePeriods} onChange={event => { clearResults(); setSeparatePeriods(event.target.checked); }} /> Set a separate UTC period for Site 2</label>
              </> : <button type="button" onClick={() => updateDraft(1, { ...drafts[0] })}>Add B</button>)}
              <PeriodFields draft={drafts[0]} onChange={draft => updateDraft(0, draft)} label={comparing && !separatePeriods ? 'Shared period · UTC' : 'Site 1 period · UTC'} />
              {comparing && separatePeriods && drafts[1] && <PeriodFields draft={drafts[1]} onChange={draft => updateDraft(1, draft)} label="Site 2 period · UTC" />}
              {validation.length > 0 && <ul className="notice" role="alert">{validation.map(message => <li key={message}>{message}</li>)}</ul>}
              <button className="primary-button" disabled={run.phase === 'loading' || !config.value} type="submit">Analyze</button>
            </form>
            <details className="service-status" open={config.resource.state === 'error' || catalog.resource.state === 'error' || undefined}>
              <summary>Data services</summary>
              <ul>
                <ResourceStatus label="API" entry={health} ready={value => `Online · ${value.version}`} />
                <ResourceStatus label="Limits" entry={config} ready={value => `${value.analysis.maxSamples} samples maximum`} />
                <ResourceStatus label="Site catalog" entry={catalog} ready={value => value.sites.length ? `${value.sites.length} available` : 'Empty · use custom coordinates'} />
                <ResourceStatus label="Terrain metadata" entry={metadata} ready={value => value.terrainDataset.metadataVerified ? 'Verified' : 'Partial · unverified metadata'} />
              </ul>
            </details>
          </div>
        </section>

        {ready && <div className="result-tools">
          <span role="status">{run.results.some(result => result?.status === 'partial') || run.errors.some(Boolean) ? 'Partial results' : 'Analysis complete'}</span>
          <div className="actions" role="group" aria-label="Analysis detail">
            <button aria-pressed={!advanced} onClick={() => setAdvanced(false)}>Basic</button>
            <button aria-pressed={advanced} onClick={() => setAdvanced(true)}>Advanced</button>
          </div>
          {run.errors.some(Boolean) && <button onClick={() => retry.current?.()}>Retry analysis</button>}
          <ExportActions run={{
            mode,
            apiVersion: health.value?.version,
            scenarios: visibleResults.map((analysis, index) => ({
              id: index === 0 ? 'A' : 'B',
              analysis,
              error: run.errors[index],
            })),
            differences: comparing ? deltas : undefined,
          }} />
        </div>}
        {(ready || !comparing) && <Panel id="analysis" title={comparing ? 'Site 1 · Analysis' : 'Analysis'}>
          {ready ? resultPanel(0) : <p>Waiting for analysis.</p>}
        </Panel>}
        {comparing && ready && <Panel id="comparison" title="Site 2 · Analysis">{resultPanel(1)}</Panel>}

        <Panel id="timeline" title="Conditions Timeline">
          {run.phase === 'loading' && <p className="loading" role="status">Running analysis…</p>}
          {run.phase === 'error' && <div role="alert"><p>{run.errors.filter(Boolean).join(' · ') || 'Analysis unavailable.'}</p><button onClick={() => retry.current?.()}>Retry analysis</button></div>}
          {run.phase === 'empty' && <>
            {comparing && <div className="timeline" aria-hidden="true">
              {[1, 2].map(site => <div key={site}><h3>Site {site}</h3>
                {['Sunlight', 'Earth visibility'].map(label => <div className="track-row" key={label}>
                  <span>{label}</span><div className="visibility-track" />
                </div>)}
              </div>)}
            </div>}
            <p className="muted">Run analysis to view {comparing ? 'both timelines' : 'visibility intervals'}.</p>
          </>}
          {ready && <>
            {comparing && <div className="comparison-deltas" aria-label="Duration differences B minus A">
              <strong>B − A</strong>
              {([['Sunlight', deltas.sunVisibleHours], ['Earth visibility', deltas.earthVisibleHours], ['Both visible', deltas.bothVisibleHours]] as const).map(([label, value]) =>
                <span key={label}>{label} <b>{value === null ? 'Unknown' : `${value > 0 ? '+' : ''}${value.toFixed(2)} h`}</b></span>)}
            </div>}
            {comparing && differentPeriods && <label className="timeline-axis">Timeline alignment
              <select value={relative ? 'offset' : 'utc'} onChange={event => setAxis(event.target.value === 'offset')}>
                <option value="utc">Absolute UTC</option><option value="offset">Time since each start</option>
              </select>
              <small>{relative ? 'Each site begins at +0 h.' : 'Both sites are placed on the same UTC axis.'}</small>
            </label>}
            <MissionTimeline key={timelineVersion} results={visibleResults} time={time} setTime={setTime} relative={relative} />
          </>}
        </Panel>
      </main>
    </div>
  );
}

export function ConfiguredMission() {
  const [mode, setMode] = useState<Mode>('real');
  const [client, setClient] = useState<HttpLunarApiClient>(() => createApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL || '/api/v1' }));
  const [loadingDemo, setLoadingDemo] = useState(import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true');
  const [demoError, setDemoError] = useState(false);
  useEffect(() => {
    if (!loadingDemo) return;
    let active = true;
    import('../integration/client').then(({ createConfiguredClient }) => createConfiguredClient()).then(
      configured => { if (active) { setClient(configured); setMode('demo'); setLoadingDemo(false); } },
      () => { if (active) setDemoError(true); },
    );
    return () => { active = false; };
  }, [loadingDemo]);
  if (demoError) return <main role="alert">Unable to load the synthetic demo.</main>;
  if (loadingDemo) return <main className="loading" role="status">Loading synthetic demo…</main>;
  return <MissionApp client={client} mode={mode} />;
}
