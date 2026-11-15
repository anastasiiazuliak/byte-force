import { createContext, useContext, useState, useMemo, lazy, Suspense } from 'react';
import type { ShellSlots } from './AppShell';
import type { useWorkspace } from './useWorkspace';
import { solarSceneDirection } from '../features/explorer/lighting/solarSceneDirection';
import { measuredSkyDirections } from '../features/explorer/scene/skyDirections';
import type { TerrainSceneProps } from '../../../contracts/scene/scene-types';
import { ScenarioFields } from '../features/scenario-form/ScenarioForm';
import { AnalysisPanel, metric } from '../features/analysis/AnalysisPanel';
import { MissionTimeline } from '../features/timeline/MissionTimeline';
import { ComparisonInsights } from '../features/compare/ComparisonInsights';
import { comparisonTime, differentPeriods } from '../features/compare/comparisonInsights';

const LunarTerrainViewer = lazy(() =>
  import('../features/explorer').then((module) => ({
    default: module.LunarTerrainViewer,
  })),
);
export const WorkspaceContext = createContext<ReturnType<
  typeof useWorkspace
> | null>(null);

function useData() {
  return useContext(WorkspaceContext)!;
}
function FormSlot() {
  const w = useData();
  return (
    <form onSubmit={w.submit} aria-busy={w.state === 'loading'}>
      <div className="quickstart">
        <label>
          Exploratory patch
          <select
            aria-label="Exploratory patch"
            value={w.currentSite}
            onChange={(e) => w.selectPatch(e.target.value)}
          >
            <option value="">Choose coordinates</option>
            {w.overview && (
              <option value={w.overview.id}>South Pole Overview</option>
            )}
            {w.patches.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!w.overview}
          onClick={() => w.overview && w.selectPatch(w.overview.id)}
        >
          South Pole Overview
        </button>
        <small>
          Coarse whole-pole overview → native 80 m patches on selection. No
          continuous global high-resolution tiles. Terrain View is a planar map;
          Globe View shows the Moon with south-polar relief at 1× height.
        </small>
        <small>
          Exploratory coordinates · not approved landing sites or
          recommendations.
        </small>
        <button type="button" onClick={w.prepareCompare}>
          Prepare patch comparison
        </button>
        <button type="button" onClick={w.prepareDates}>
          Compare dates at Site A
        </button>
        <button type="button" onClick={w.quickCompare} disabled={!w.client}>
          Quick compare · 2 samples/site
        </button>
        <small>
          Quick comparison uses one UTC hour. Unknown visibility is never
          ranked.
        </small>
      </div>
      <ScenarioFields
        id="A"
        draft={w.a}
        sites={w.sites}
        onChange={(draft) => w.change('A', draft)}
      />
      <PeriodPresets id="A" />
      {w.view === 'compare' && (
        <>
          <fieldset>
            <legend>Compare mode presets · draft only</legend>
            <button type="button" onClick={w.samePeriod}>Same period · Use same UTC period</button>
            <button type="button" onClick={w.prepareDates}>Compare dates · Copy A coordinates to B</button>
            <p>Compare dates retains each scenario’s UTC period; edit B dates explicitly. Same period copies only A’s period and step to B, preserving B coordinates. Neither submits.</p>
          </fieldset>
          <button type="button" onClick={() => w.change('B', { ...w.a })}>
            Copy A to B
          </button>
          <button
            type="button"
            onClick={() => {
              const a = w.a;
              w.change('A', w.b);
              w.change('B', a);
            }}
          >
            Swap A ↔ B
          </button>
          <ScenarioFields
            id="B"
            draft={w.b}
            sites={w.sites}
            onChange={(draft) => w.change('B', draft)}
          />
          <PeriodPresets id="B" />
        </>
      )}
      <button className="primary-button" type="submit" disabled={!w.client}>
        {w.state === 'loading'
          ? 'Restart analysis'
          : w.view === 'compare'
            ? 'Compare scenarios'
            : 'Analyze site'}
      </button>
      {w.state === 'loading' && (
        <button type="button" onClick={w.cancel}>
          Cancel analysis
        </button>
      )}
      <p>Changing inputs cancels pending results. Run analysis explicitly.</p>
      {w.error && (
        <p role="alert" data-testid="analysis-error">
          {w.error}
        </p>
      )}
    </form>
  );
}
function PeriodPresets({ id }: { id: 'A' | 'B' }) {
  const w = useData();
  const draft = id === 'A' ? w.a : w.b;
  const start = Date.parse(draft.start + ':00Z');
  return <div role="group" aria-label={`Draft period ${id}`}>
    {([12, 24] as const).map(hours => <button key={hours} type="button" disabled={!Number.isFinite(start)}
      onClick={() => w.change(id, { ...draft, end: new Date(start + hours * 3600000).toISOString().slice(0, 16) })}>
      {hours} h draft {id}
    </button>)}
    <small>Changes end UTC only; step and configured sample limits still apply on explicit submission.</small>
  </div>;
}
function AnalysisSlot() {
  const w = useData();
  return <AnalysisPanel analysis={w.analyses[0]} timeUtc={w.timeUtc} />;
}
function CompareSlot({ site }: { site: 1 | 2 }) {
  const w = useData();
  return (
    <>
      <AnalysisPanel
        analysis={w.analyses[site - 1]}
        timeUtc={site === 2 ? comparisonTime(w.timeUtc, w.analyses[0], w.analyses[1]) : w.timeUtc}
        slot={site === 1 ? 'A' : 'B'}
      />
      {differentPeriods(w.analyses[0], w.analyses[1]) && <p>Equal elapsed time, dates differ · Scenario {site === 1 ? 'A' : 'B'} own UTC: {site === 1 ? w.timeUtc : comparisonTime(w.timeUtc, w.analyses[0], w.analyses[1])}. Exact cached samples only; no interpolation.</p>}
      {site === 2 && <ComparisonInsights analyses={w.analyses} />}
      {site === 2 && w.comparison && (
        <div data-testid="comparison-differences">
          <h3>Difference B − A</h3>
          {Object.entries(w.comparison.differences).map(([key, value]) => (
            <p key={key}>
              {key}: {value != null && value > 0 ? '+' : ''}
              {metric(value, ' h')}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
function TimelineSlot() {
  const w = useData();
  const relative = differentPeriods(w.analyses[0], w.analyses[1]);
  return (
    <>
      {relative && <p>Equal elapsed time, dates differ. Timeline UTC is Scenario A; B uses its own UTC at the same elapsed offset. A missing exact B sample remains unknown.</p>}
      <MissionTimeline
        analyses={relative ? w.analyses.slice(0, 1) : w.analyses}
        timeUtc={w.timeUtc}
        onTime={w.setTime}
      />
    </>
  );
}
function SceneSlot(props: TerrainSceneProps) {
  const w = useData();
  const [scientific, setScientific] = useState(false);
  const [skySlot, setSkySlot] = useState<'A' | 'B'>('A');
  const globe = w.representation === 'globe';
  const sceneMetadata = globe ? (w.globe?.metadata ?? null) : props.metadata;
  const analysis = w.analyses[0];
  const sample = analysis?.samples.find(
    (s) => Date.parse(s.timeUtc) === Date.parse(w.timeUtc),
  );
  const direction = solarSceneDirection(
    sceneMetadata,
    analysis?.location ?? null,
    sample?.sun ?? null,
  );
  const enabled = w.representation === 'terrain' && Boolean(direction);
  const effectiveSkySlot = w.analyses.length === 2 ? skySlot : 'A';
  const skyAnalysis = w.analyses[effectiveSkySlot === 'A' ? 0 : 1];
  const skyTime = effectiveSkySlot === 'B' ? comparisonTime(w.timeUtc, w.analyses[0], w.analyses[1]) : w.timeUtc;
  const skyDirections = useMemo(() => globe ? measuredSkyDirections(sceneMetadata, skyAnalysis, skyTime, effectiveSkySlot) : null,
    [globe, sceneMetadata, skyAnalysis, skyTime, effectiveSkySlot]);
  const lightingLabel =
    w.representation === 'globe'
      ? 'Cartographic relief · fixed map light'
      : scientific && enabled
        ? 'Cached Sun at A · graphic estimate'
        : 'Exploration Lighting · illustrative fill';
  return (
    <div className="explorer-stage">
      <div className="explorer-toolbar" aria-label="Explorer view and lighting">
        <div role="group" aria-label="Representation">
          <button
            type="button"
            aria-pressed={w.representation === 'globe'}
            onClick={() => w.setRepresentation('globe')}
          >
            Globe View
          </button>
          <button
            type="button"
            aria-pressed={w.representation === 'terrain'}
            onClick={() => w.setRepresentation('terrain')}
          >
            Terrain View
          </button>
        </div>
        <details className="explorer-guide">
          <summary>Explore → Choose Site → Analyze</summary>
          <p>
            Full Moon viewed from the south pole. Geographic picking is
            available on reviewed relief at 80–90°S. Drag to orbit, scroll to
            zoom; choose A or B before clicking. Set UTC in Site & Time, then
            Analyze. Select a native patch for detail. Views share coordinates,
            time and results.
          </p>
        </details>
        <label className="lighting-toggle">
          <input
            type="checkbox"
            checked={scientific && enabled}
            disabled={!enabled}
            onChange={(e) => setScientific(e.target.checked)}
          />
          Scientific Sun Lighting
        </label>
        <span
          className="lighting-explanation"
          title={
            globe
              ? 'The polar surface uses LOLA-derived cartography. Sun/Earth guides require an exact Horizons sample and are registered to the selected site, not the camera. Their display distance and size are symbolic, not orbital measurements.'
              : 'Scientific Sun Lighting requires a matching cached sample at A on reviewed terrain. Graphic shadows are not visibility.'
          }
        >
          {lightingLabel}
        </span>
        {globe && <span className="sky-registration-status" role="status">{skyDirections
          ? `Sky directions at Site ${effectiveSkySlot} · own UTC ${skyTime} · symbols not to scale; may be outside this view`
          : skyAnalysis ? 'Registered sky directions unavailable for this exact sample; check analysis data quality.' : 'Analyze a site to place Sun/Earth directions. No screen-fixed decorations.'}</span>}
        {globe && w.analyses.length === 2 && <label className="lighting-toggle">Sky reference<select aria-label="Sky reference" value={skySlot} onChange={e => setSkySlot(e.target.value as 'A' | 'B')}><option value="A">Site A</option><option value="B">Site B</option></select></label>}
      </div>
      {globe && !w.globe && (
        <p role="status">
          Reviewed Globe catalog unavailable. Geographic picking requires the
          reviewed polar relief.
        </p>
      )}
      <Suspense
        fallback={
          <p role="status" className="terrain-loading">
            Preparing 3D explorer…
          </p>
        }
      >
        <LunarTerrainViewer
          {...props}
          globe={globe}
          metadata={sceneMetadata}
          skyDirections={skyDirections}
          sunDirectionScene={scientific && enabled ? direction : null}
          sunlightLabel={
            scientific && enabled
              ? 'Sun at A · approximate map lighting · not visibility'
              : lightingLabel
          }
        />
      </Suspense>
    </div>
  );
}
export const slots: ShellSlots = {
  TerrainViewer: SceneSlot,
  ScenarioForm: FormSlot,
  AnalysisPanel: AnalysisSlot,
  ComparePanel: CompareSlot,
  MissionTimeline: TimelineSlot,
};
