import type { AnalysisResponse } from '../../api/types';
import { clearanceStats } from './comparisonInsights';

const degrees = (value: number | null) => value === null ? 'Unknown' : `${value.toFixed(2)}°`;

export function ComparisonInsights({ analyses }: { analyses: AnalysisResponse[] }) {
  if (analyses.length !== 2) return null;
  return <section aria-label="Cached comparison insights">
    <h3>Cached regional clearance comparison</h3>
    <p>Arithmetic mean and minimum of finite, unique, in-period cached samples only; not time-weighted or continuous extrema. Missing samples are excluded, not zero. Different periods, cadence and coverage can make these statistics incomparable.</p>
    <p>Regional skyline clearance is not confirmed visibility: far-field terrain may be missing. No visibility-rate winner or landing-site ranking is inferred. Earth geometry is not radio performance.</p>
    {analyses.map((analysis, index) => <section key={index} aria-label={`Scenario ${index === 0 ? 'A' : 'B'} cached statistics`}>
      <h4>Scenario {index === 0 ? 'A' : 'B'}</h4>
      <p>{analysis.period.startUtc} – {analysis.period.endUtc} · requested step {analysis.period.stepMinutes} min · {analysis.samples.length} cached samples</p>
      {(['sun', 'earth'] as const).map(body => {
        const stats = clearanceStats(analysis, body);
        return <p key={body}>{body === 'sun' ? 'Sun' : 'Earth'} clearance: mean {degrees(stats.mean)} · minimum {degrees(stats.min)} · finite coverage {stats.finiteCount}/{stats.sampleCount} unique in-period samples.</p>;
      })}
      <p>Horizon: {analysis.horizon?.points.length ?? 0} cached points · terrain applied: {analysis.quality.terrainApplied ? 'yes' : 'no'} · terrain: {analysis.quality.terrainSource ?? 'unknown'} · resolution: {analysis.quality.terrainResolutionMeters ?? 'unknown'} m · ephemeris: {analysis.quality.ephemerisSource} · method: {analysis.quality.visibilityMethod}</p>
      {analysis.quality.warnings.map((warning, i) => <p key={i}>{warning}</p>)}
    </section>)}
  </section>;
}
