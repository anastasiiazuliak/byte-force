import { memo } from 'react';
import type { AnalysisResponse, BodyPosition, HorizonProfile } from '../../api/types';
import { sampleAt, utcLabel, within } from '../timeline/time';
import { Quality } from '../methodology/Quality';

const bodies = ['sun', 'earth'] as const;
const labels = { sun: 'Sun', earth: 'Earth' };
const degrees = (value: number | null | undefined) => value == null ? 'Unknown' : `${value.toFixed(1)}°`;
const hours = (value: number | null) => value == null ? 'Unknown' : `${value.toFixed(2)} h`;

function Visibility({ position, intervalVisible, terrain }: { position?: BodyPosition; intervalVisible: boolean; terrain: boolean }) {
  const visible = position?.visible ?? (intervalVisible ? true : null);
  if (visible === true) return <span className="available">✓ Visible</span>;
  if (visible === false) return <span className="blocked">× {terrain && (position?.clearanceDeg ?? 0) < 0 ? 'Blocked by terrain' : 'Blocked'}</span>;
  return <span className="unknown">? Unknown</span>;
}

function nextEnd(analysis: AnalysisResponse, body: typeof bodies[number], time: number) {
  const interval = (analysis.intervals?.[body === 'sun' ? 'sunVisible' : 'earthVisible'] ?? []).find(item => within(item, time));
  if (!interval || Date.parse(interval.endUtc) >= Date.parse(analysis.period.endUtc)) return 'Unknown';
  return utcLabel(Date.parse(interval.endUtc));
}

const Plot = memo(function Plot({ result, origin, length }: { result: AnalysisResponse; origin: number; length: number }) {
  if (length <= 0 || !result.samples.length) return <p>No elevation samples.</p>;
  const x = (time: string) => (Date.parse(time) - origin) / length * 360;
  const y = (angle: number) => 90 - angle;
  return (
    <svg viewBox="0 0 360 180" role="img" aria-label="Elevation and horizon over the selected period, from −90 to +90 degrees">
      <path className="plot-grid" d="M0 90H360" />
      {bodies.map(body => {
        return (['elevationDeg', 'horizonDeg'] as const).map(field => {
          let last = -Infinity;
          const path = result.samples.map(sample => {
            const time = Date.parse(sample.timeUtc);
            const angle = sample[body][field];
            const command = time - last <= result.period.stepMinutes * 60_000 ? 'L' : 'M';
            last = angle == null ? -Infinity : time;
            return angle == null ? '' : `${command}${x(sample.timeUtc)},${y(angle)}h0.01`;
          }).join('');
          return <path key={body + field} className={body + '-line'} strokeDasharray={field === 'horizonDeg' ? '5 4' : undefined} d={path} />;
        });
      })}
    </svg>
  );
});

function Horizon({ profile, sample }: { profile: HorizonProfile | null; sample: ReturnType<typeof sampleAt> }) {
  if (!profile?.points.length) return <p>Terrain horizon unavailable.</p>;
  const points = [...profile.points].sort((a, b) => a.azimuthDeg - b.azimuthDeg);
  const y = (angle: number) => 90 - angle;
  const silhouette = points.map(point => `${point.azimuthDeg},${y(point.elevationDeg)}`).join(' ');
  return (
    <figure className="science-plot">
      <figcaption>360° terrain horizon · azimuth 0° → 360° · elevation ±90°</figcaption>
      <svg viewBox="0 0 360 180" role="img" aria-label="Terrain skyline and selected Sun and Earth positions">
        <path className="plot-grid" d="M0 90H360" />
        <polyline className="horizon-line" points={silhouette} />
        {sample && bodies.map(body => <g key={body} className={body + '-marker'} transform={`translate(${sample[body].azimuthDeg},${y(sample[body].elevationDeg)})`}>
          <circle r="4" /><text x={sample[body].azimuthDeg > 315 ? -36 : 8} y="-5">{labels[body]}</text>
        </g>)}
      </svg>
    </figure>
  );
}

export function AnalysisPanel({ result, time, advanced, axis, relative = false }: {
  result: AnalysisResponse; time: number; advanced: boolean; axis?: { start: number; end: number }; relative?: boolean;
}) {
  const sample = sampleAt(result.samples, time, result.period.stepMinutes);
  const { summary, quality, period } = result;
  const percent = (value: number | null) => value == null ? '' : ` (${value.toFixed(1)}%)`;
  const origin = (axis?.start ?? Date.parse(period.startUtc)) + (relative ? Date.parse(period.startUtc) : 0);
  const length = axis ? axis.end - axis.start : Date.parse(period.endUtc) - Date.parse(period.startUtc);
  const cursor = (time - origin) / length;
  return (
    <>
      <p className="muted">{result.status === 'partial' ? 'Partial data · ' : ''}{utcLabel(time)}{sample?.estimated ? ' · Interpolated' : ''}</p>
      {!quality.terrainApplied && <p className="notice">Terrain not considered. Local terrain may obstruct visibility.</p>}
      <dl className="metrics">
        <div><dt>Solar elevation</dt><dd>{degrees(sample?.sun.elevationDeg)}</dd></div>
        <div><dt>Sunlight duration</dt><dd>{hours(summary.sunVisibleHours)}{percent(summary.sunVisiblePercent)}</dd></div>
        <div><dt>Earth elevation</dt><dd>{degrees(sample?.earth.elevationDeg)}</dd></div>
        {bodies.map(body => (
          <div key={body}><dt>{labels[body]} visibility</dt><dd><Visibility position={sample?.[body]} terrain={quality.terrainApplied}
            intervalVisible={(result.intervals?.[body === 'sun' ? 'sunVisible' : 'earthVisible'] ?? []).some(interval => within(interval, time))} /></dd></div>
        ))}
        <div><dt>Earth visibility duration</dt><dd>{hours(summary.earthVisibleHours)}{percent(summary.earthVisiblePercent)}</dd></div>
        <div><dt>Next sunset</dt><dd>{nextEnd(result, 'sun', time)}</dd></div>
        <div><dt>Next Earthset</dt><dd>{nextEnd(result, 'earth', time)}</dd></div>
        {advanced && bodies.map(body => <div key={body}>
          <dt>{labels[body]} azimuth / horizon / clearance</dt>
          <dd>{degrees(sample?.[body].azimuthDeg)} / {degrees(sample?.[body].horizonDeg)} / {degrees(sample?.[body].clearanceDeg)}</dd>
        </div>)}
      </dl>
      {advanced && <>
        <figure className="science-plot">
          <figcaption>Elevation (°) · Sun in yellow, Earth in blue · dashed terrain horizon</figcaption>
          <div className="chart-area" title={sample ? `${utcLabel(time)} · Sun ${degrees(sample.sun.elevationDeg)} · Earth ${degrees(sample.earth.elevationDeg)}` : undefined}>
            <Plot result={result} origin={origin} length={length} />
            {cursor >= 0 && cursor <= 1 && <i aria-hidden="true" style={{ left: `${cursor * 100}%` }} />}
          </div>
          <div className="chart-ticks"><span>{relative ? '+0 h' : utcLabel(origin)}</span><span>{relative ? `+${(length / 3_600_000).toFixed(2)} h` : utcLabel(origin + length)}</span></div>
          <details><summary>Elevation sample values</summary><ul className="sample-list">
            {result.samples.map((item, i) => <li key={i}>{utcLabel(Date.parse(item.timeUtc))}: Sun {degrees(item.sun.elevationDeg)}, horizon {degrees(item.sun.horizonDeg)} · Earth {degrees(item.earth.elevationDeg)}, horizon {degrees(item.earth.horizonDeg)}</li>)}
          </ul></details>
        </figure>
        <Horizon profile={result.horizon} sample={sample} />
      </>}
      <Quality analysis={result} />
    </>
  );
import { useState } from 'react';
import type { AnalysisResponse } from '../../api/types';
import { compassPoint, humanWarning, metric, plotGeometry, utcLabel, visibility, type PlotMode } from './analysisHelpers';
export { metric, visibility, humanWarning } from './analysisHelpers';

export function AnalysisPanel({ analysis, timeUtc, slot = 'A' }: { analysis?: AnalysisResponse; timeUtc: string; slot?: 'A' | 'B' }) {
  const [mode, setMode] = useState<PlotMode>('altitude');
  const [hovered, setHovered] = useState<number | null>(null);
  if (!analysis) return <p role="status">Waiting for analysis.</p>;
  const regional = Boolean(analysis.horizon?.points.length);
  const sample = analysis.samples.find(s => Date.parse(s.timeUtc) === Date.parse(timeUtc));
  const plot = plotGeometry(analysis, mode);
  const tooltip = hovered == null ? undefined : analysis.samples[hovered];
  const synthetic = [analysis.quality.ephemerisSource, ...analysis.quality.warnings].filter(w => /synthetic|not nasa|not real science/i.test(w));
  const summaryAvailable = Object.values(analysis.summary).some(v => v != null);
  return <article data-testid="analysis-result" className="analysis-result">
    <p><strong>{analysis.status === 'partial' ? 'Partial analysis' : 'Complete analysis'}</strong> · Slot {slot}</p>
    {synthetic.length > 0 && <p className="quality-banner" role="note">Synthetic test data — not NASA science. {Array.from(new Set(synthetic)).join(' ')}</p>}
    <p className="analysis-time"><time dateTime={timeUtc}>{utcLabel(timeUtc)}</time> · shared selected UTC · exact samples only</p>
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
      <label>Chart quantity<select value={mode} onChange={e => { setMode(e.target.value as PlotMode); setHovered(null); }}><option value="altitude">Geometric altitude</option><option value="clearance">Terrain clearance</option></select></label>
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
    <details><summary>Samples & horizon (degrees, UTC)</summary><div className="table-scroll"><table><thead><tr><th>UTC</th><th>Sun altitude °</th><th>Earth altitude °</th><th>Sun clearance °</th><th>Earth clearance °</th></tr></thead><tbody>{analysis.samples.map((s, i) => <tr key={i} aria-current={s === sample ? 'true' : undefined}><td><time dateTime={s.timeUtc}>{utcLabel(s.timeUtc)}</time></td><td>{metric(s.sun.elevationDeg)}</td><td>{metric(s.earth.elevationDeg)}</td><td>{metric(s.sun.clearanceDeg)}</td><td>{metric(s.earth.clearanceDeg)}</td></tr>)}</tbody></table></div><p>{analysis.horizon ? `${analysis.horizon.points.length} horizon points` : 'Horizon unavailable'}</p>{analysis.horizon && <svg viewBox="0 0 360 180" role="img" aria-label="Terrain horizon profile: azimuth 0 to 360 degrees"><polyline fill="none" stroke="currentColor" points={[...analysis.horizon.points].sort((a,b) => a.azimuthDeg-b.azimuthDeg).map(p => `${p.azimuthDeg},${90-p.elevationDeg}`).join(' ')}/></svg>}</details>
  </article>;
}
