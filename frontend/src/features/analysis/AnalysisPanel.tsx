import { RegionalSummary } from './RegionalSummary';
import { useMemo, useState } from 'react';
import type { AnalysisResponse } from '../../api/types';
import { compassPoint, humanWarning, metric, plotGeometry, utcLabel, visibility, type PlotMode } from './analysisHelpers';
export { metric, visibility, humanWarning } from './analysisHelpers';

export function AnalysisPanel({ analysis, timeUtc, slot = 'A' }: { analysis?: AnalysisResponse; timeUtc: string; slot?: 'A' | 'B' }) {
  const [mode, setMode] = useState<PlotMode>('altitude');
  const [hovered, setHovered] = useState<number | null>(null);
  const [tableOpen, setTableOpen] = useState(false);

  const selectedTimeMs = useMemo(() => Date.parse(timeUtc), [timeUtc]);
  const sample = useMemo(
    () => analysis?.samples.find(s => Date.parse(s.timeUtc) === selectedTimeMs),
    [analysis, selectedTimeMs],
  );
  const plot = useMemo(() => (analysis ? plotGeometry(analysis, mode) : null), [analysis, mode]);
  const sortedHorizonPoints = useMemo(
    () =>
      analysis?.horizon
        ? [...analysis.horizon.points]
            .sort((a, b) => a.azimuthDeg - b.azimuthDeg)
            .map(p => `${p.azimuthDeg},${90 - p.elevationDeg}`)
            .join(' ')
        : '',
    [analysis],
  );

  if (!analysis || !plot) return <p role="status">Waiting for analysis.</p>;
  const regional = Boolean(analysis.horizon?.points.length);
  const tooltip = hovered == null ? undefined : analysis.samples[hovered];
  const synthetic = [analysis.quality.ephemerisSource, ...analysis.quality.warnings].filter(w => /synthetic|not nasa|not real science/i.test(w));
  const summaryAvailable = Object.values(analysis.summary).some(v => v != null);
  return <article data-testid="analysis-result" className="analysis-result">
    <p><strong>{analysis.status === 'partial' ? 'Partial analysis' : 'Complete analysis'}</strong> · Slot {slot}</p>
    {synthetic.length > 0 && <p className="quality-banner" role="note">Synthetic test data — not NASA science. {Array.from(new Set(synthetic)).join(' ')}</p>}
    <p className="analysis-time"><time dateTime={timeUtc}>{utcLabel(timeUtc)}</time> · shared selected UTC · exact samples only</p>
    <RegionalSummary analysis={analysis} />
    <section><h3>1. Astronomical Position</h3><p className="muted">Local sky directions, not a global 3D vector. North 0° · East 90°.</p>
      {!sample && <p>No exact sample at the selected UTC. Positions are not interpolated.</p>}
      <svg className="sky-compass" viewBox="0 0 140 140" role="img" aria-label={`Local sky compass for slot ${slot}: north 0 degrees, east 90 degrees`}>
        <circle cx="70" cy="70" r="43" fill="none" stroke="currentColor"/><path d="M70 22V118M22 70H118" className="plot-grid"/>
        <text x="70" y="15" textAnchor="middle">N 0°</text><text x="119" y="74">E</text><text x="70" y="134" textAnchor="middle">S</text><text x="8" y="74">W</text>
        {(['sun', 'earth'] as const).map(body => { const az = sample?.[body].azimuthDeg; if (az == null || !Number.isFinite(az)) return null; const point = compassPoint(az); return <g key={body} className={`${body}-key`}><circle cx={point.x} cy={point.y} r={body === 'sun' ? 5 : 3} fill="currentColor"/><title>{body}: azimuth {metric(az, '°')}</title></g>; })}
      </svg>
      {(['sun', 'earth'] as const).map(body => <p key={body}><strong className={`${body}-key`}>{body === 'sun' ? 'Sun' : 'Earth'}</strong> · azimuth {metric(sample?.[body].azimuthDeg, '°')} · altitude {metric(sample?.[body].elevationDeg, '°')}</p>)}
    </section>
    <section><h3>2. Regional Terrain Assessment</h3>
      <p className="quality-banner">{regional && !analysis.quality.terrainApplied ? 'REGIONAL ESTIMATE · far-field visibility unknown' : analysis.quality.terrainApplied ? 'Terrain visibility solution' : 'Terrain visibility unavailable'}</p>
      <p>{regional ? 'Nearby DEM skyline only. Distant terrain and sampling uncertainty may change the result.' : 'Terrain not considered — no usable nearby skyline is available for this request.'}</p>
      {regional && (['sun', 'earth'] as const).map(body => <p key={body}>{body === 'sun' ? 'Sun' : 'Earth'} · terrain horizon {metric(sample?.[body].horizonDeg, '°')} · clearance {metric(sample?.[body].clearanceDeg, '°')}</p>)}
      {regional && <p className="regional-assessment">Above the sampled skyline does not confirm visibility: distant terrain may still block it. At or below it suggests nearby obstruction, but blockage is not confirmed without validated sampling and error bounds.</p>}
    </section>
    <section><h3>3. Confirmed Visibility</h3>
      {(['sun', 'earth'] as const).map(body => <p key={body}>{body === 'sun' ? 'Sun' : 'Earth'}: {visibility(sample?.[body].visible)}</p>)}
      <p className="muted">Only validated visibility results appear here. A nearby skyline estimate alone cannot confirm the final status.</p>
      {!summaryAvailable ? <p>Visibility summary unavailable: terrain coverage or validation is insufficient to determine visible durations.</p> : <><p>Sun visible: {metric(analysis.summary.sunVisibleHours, ' h')} · {metric(analysis.summary.sunVisiblePercent, '%')}</p><p>Earth visible: {metric(analysis.summary.earthVisibleHours, ' h')} · {metric(analysis.summary.earthVisiblePercent, '%')}</p><p>Both visible: {metric(analysis.summary.bothVisibleHours, ' h')}</p></>}
    </section>
    {analysis.samples.length > 0 && <figure className="science-plot">
      <label>Chart quantity<select value={mode} onChange={e => { setMode(e.target.value as PlotMode); setHovered(null); }}><option value="altitude">Airless apparent altitude</option><option value="clearance">Terrain clearance</option></select></label>
      <figcaption><span className="sun-key">Sun (yellow, solid)</span> · <span className="earth-key">Earth (blue, dashed)</span><br/>Degrees · zero reference · gaps mean missing data · not confirmed visibility</figcaption>
      <svg viewBox="0 0 360 180" role="img" aria-label={mode === 'altitude' ? 'Sun and Earth altitude over UTC period in degrees' : 'Sun and Earth clearance over UTC period in degrees'}>
        <text x="1" y="15" fill="currentColor">{metric(plot.max, '°')}</text><text x="1" y="174" fill="currentColor">{metric(plot.min, '°')}</text>
        <path className="plot-grid" d={`M30 ${plot.y(0)}H330`}/><text x="2" y={plot.y(0)} fill="currentColor">0°</text>
        {(['sun', 'earth'] as const).map(body => <path key={body} className={`${body}-line`} strokeDasharray={body === 'earth' ? '5 3' : undefined} d={plot.path(body)}/>)}
        {sample && <line x1={plot.x(sample.timeUtc)} x2={plot.x(sample.timeUtc)} y1="20" y2="150" stroke="currentColor"/>}
      </svg>
      <div className="chart-ticks"><time>{utcLabel(analysis.period.startUtc)}</time><time>{utcLabel(analysis.period.endUtc)}</time></div>
      <div className="sample-targets" aria-label={`Slot ${slot} exact chart samples`}>{analysis.samples.map((s, i) => <button key={`${s.timeUtc}-${i}`} type="button" aria-label={`Inspect sample ${utcLabel(s.timeUtc)}`} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)} onClick={() => setHovered(i)} aria-current={s === sample ? 'true' : undefined}>{i + 1}</button>)}</div>
      {tooltip && <p role="tooltip">{utcLabel(tooltip.timeUtc)} · Sun {metric(tooltip.sun[plot.field], '°')} · Earth {metric(tooltip.earth[plot.field], '°')}</p>}
    </figure>}
    {analysis.samples.length === 2 && <p className="quality-banner">Two samples are only a snapshot. For context, manually choose a 12–24 h period and run analysis. No additional NASA requests are made automatically.</p>}
    <details><summary>Technical metadata & quality warnings ({analysis.quality.warnings.length})</summary>
      <p>Ephemeris: {analysis.quality.ephemerisSource} · Terrain: {analysis.quality.terrainSource ?? 'Unavailable'}</p><p>Method: {analysis.quality.visibilityMethod} · DEM resolution: {metric(analysis.quality.terrainResolutionMeters, ' m')} · Step: {analysis.period.stepMinutes} min</p>
      {analysis.quality.warnings.map((warning, i) => <p key={i}>{humanWarning(warning)}</p>)}
    </details>
    <details open={tableOpen} onToggle={e => setTableOpen(e.currentTarget.open)}><summary>Samples & horizon (degrees, UTC)</summary><div className="table-scroll"><table><thead><tr><th>UTC</th><th>Sun altitude °</th><th>Earth altitude °</th><th>Sun clearance °</th><th>Earth clearance °</th></tr></thead><tbody>{tableOpen && analysis.samples.map((s, i) => <tr key={i} aria-current={s === sample ? 'true' : undefined}><td><time dateTime={s.timeUtc}>{utcLabel(s.timeUtc)}</time></td><td>{metric(s.sun.elevationDeg)}</td><td>{metric(s.earth.elevationDeg)}</td><td>{metric(s.sun.clearanceDeg)}</td><td>{metric(s.earth.clearanceDeg)}</td></tr>)}</tbody></table></div><p>{analysis.horizon ? `${analysis.horizon.points.length} horizon points` : 'Horizon unavailable'}</p>{analysis.horizon && <svg viewBox="0 0 360 180" role="img" aria-label="Terrain horizon profile: azimuth 0 to 360 degrees"><polyline fill="none" stroke="currentColor" points={sortedHorizonPoints}/></svg>}</details>
  </article>;
}
