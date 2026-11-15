import { createContext, useContext, useState, useMemo, lazy, Suspense } from 'react';
import type { ShellSlots } from './AppShell';
import type { useWorkspace } from './useWorkspace';
import { solarSceneDirection } from '../features/explorer/lighting/solarSceneDirection';
import { measuredSkyDirections } from '../features/explorer/scene/skyDirections';
import type { TerrainSceneProps } from '../../../contracts/scene/scene-types';
import { ScenarioFields } from '../features/scenario-form/ScenarioForm';
import { AnalysisPanel, metric } from '../features/analysis/AnalysisPanel';
import { MissionTimeline } from '../features/timeline/MissionTimeline';

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
      {w.view === 'compare' && (
        <>
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
        timeUtc={w.timeUtc}
        slot={site === 1 ? 'A' : 'B'}
      />
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
  return (
    <MissionTimeline
      analyses={w.analyses}
      timeUtc={w.timeUtc}
      onTime={w.setTime}
    />
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
  const skyDirections = useMemo(() => globe ? measuredSkyDirections(sceneMetadata, skyAnalysis, w.timeUtc, effectiveSkySlot) : null,
    [globe, sceneMetadata, skyAnalysis, w.timeUtc, effectiveSkySlot]);
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
          ? `Sky directions at Site ${effectiveSkySlot} · symbols not to scale; may be outside this view`
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
