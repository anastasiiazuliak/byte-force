import type { AnalysisResponse, Visibility } from '../../api/types';
export const metric = (value: number | null | undefined, unit = '') => value == null || !Number.isFinite(value) ? 'Unknown' : `${value.toFixed(2)}${unit}`;
export const visibility = (value: Visibility | undefined) => value == null ? 'Unknown' : value ? 'Visible' : 'Blocked';
export function humanWarning(warning: string) {
  if (/^[A-Z][A-Z_]+$/.test(warning)) {
    if (/MISSING|UNAVAILABLE|NO_DEM|NOT_FOUND/.test(warning)) return 'Terrain data is missing or unavailable. Visibility remains unknown.';
    if (/UNVERIFIED|UNREVIEWED|DATUM|ALIGNMENT/.test(warning)) return 'Terrain reference or alignment has not been reviewed for this request. Visibility remains unknown.';
    if (/REGIONAL|FAR_FIELD/.test(warning)) return 'Only nearby terrain was sampled. Distant terrain is unknown; this is not a complete visibility result.';
  }
  return warning.replace(/_/g, ' ');
}
function utcLabel(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().replace('T', ' ').replace(/\.000Z$/, ' UTC').replace(/Z$/, ' UTC') : value;
}

export function AnalysisPanel({ analysis, timeUtc }: { analysis?: AnalysisResponse; timeUtc: string }) {
  if (!analysis) return <p role="status">Waiting for analysis.</p>;
  const regional = !analysis.quality.terrainApplied && Boolean(analysis.horizon?.points.length);
  const sample = analysis.samples.find(s => Date.parse(s.timeUtc) === Date.parse(timeUtc));
  const start = Date.parse(analysis.period.startUtc);
  const duration = Date.parse(analysis.period.endUtc) - start;
  const x = (time: string) => 360 * (Date.parse(time) - start) / duration;
  const cursor = x(timeUtc);
  const altitudePath = (body: 'sun' | 'earth') => {
    let previous = -Infinity;
    return analysis.samples.map(s => {
      const time = Date.parse(s.timeUtc);
      const angle = s[body].elevationDeg;
      if (!Number.isFinite(time) || angle == null || !Number.isFinite(angle)) {
        previous = -Infinity;
        return '';
      }
      const command = time > previous && time - previous <= analysis.period.stepMinutes * 60_000 ? 'L' : 'M';
      previous = time;
      return `${command}${x(s.timeUtc)},${90 - angle}h0.01`;
    }).join(' ');
  };
  return <article data-testid="analysis-result"><p><strong>{analysis.status === 'partial' ? 'Partial analysis' : 'Complete analysis'}</strong></p><p className="quality-banner">{regional ? 'REGIONAL ESTIMATE · far-field visibility unknown' : analysis.quality.terrainApplied ? 'Terrain visibility solution' : 'Terrain visibility unavailable'}</p><p className="analysis-time"><time dateTime={timeUtc}>{utcLabel(timeUtc)}</time> · exact samples only</p>
    <p>Sun visible: {metric(analysis.summary.sunVisibleHours, ' h')} ({metric(analysis.summary.sunVisiblePercent, '%')})</p><p>Earth visible: {metric(analysis.summary.earthVisibleHours, ' h')} ({metric(analysis.summary.earthVisiblePercent, '%')})</p><p>Both visible: {metric(analysis.summary.bothVisibleHours, ' h')}</p>
    {(['sun', 'earth'] as const).map(body => <section key={body}><h3>{body === 'sun' ? 'Sun' : 'Earth'}</h3><p>{visibility(sample?.[body].visible)} · altitude {metric(sample?.[body].elevationDeg, '°')}</p>{regional && sample?.[body].clearanceDeg != null && <p className="regional-assessment">{sample[body].clearanceDeg! > 0 ? 'Above the nearby sampled skyline; distant terrain is still unknown.' : 'At or below the nearby sampled skyline in this regional model.'} This is an estimate, not confirmed visibility.</p>}<p>Azimuth {metric(sample?.[body].azimuthDeg, '°')} · terrain horizon {metric(sample?.[body].horizonDeg, '°')} · clearance {metric(sample?.[body].clearanceDeg, '°')}</p></section>)}
    <p>{analysis.quality.terrainApplied ? 'Terrain applied' : regional ? 'Actual DEM sampled regionally. Distant terrain and sampling uncertainty prevent a complete visibility solution.' : analysis.quality.terrainSource ? 'Terrain not considered — available data is unreviewed or insufficient for this request; visibility is unknown' : 'Terrain not considered — DEM data unavailable; visibility is unknown'}</p><p>Ephemeris: {analysis.quality.ephemerisSource} · Terrain: {analysis.quality.terrainSource ?? 'Unavailable'}</p><p>Method: {analysis.quality.visibilityMethod} · DEM resolution: {metric(analysis.quality.terrainResolutionMeters, ' m')} · Step: {analysis.period.stepMinutes} min</p>
    {analysis.quality.warnings.length > 0 && <details className="analysis-warnings"><summary>Quality warnings ({analysis.quality.warnings.length})</summary>{analysis.quality.warnings.map((warning, i) => <p role="note" key={i}>{humanWarning(warning)}</p>)}</details>}
    {analysis.samples.length > 0 && Number.isFinite(start) && duration > 0 && <figure className="science-plot">
      <figcaption>Geometric altitude · −90° to +90°<br /><span className="sun-key">Sun (yellow)</span> · <span className="earth-key">Earth (blue)</span> · not terrain visibility</figcaption>
      <svg viewBox="0 0 360 180" role="img" aria-label="Sun and Earth altitude over UTC period in degrees"><title>Altitude −90° to +90°; UTC left to right. Gaps indicate missing samples.</title><path className="plot-grid" d="M0 90H360" />{(['sun', 'earth'] as const).map(body => <path key={body} className={`${body}-line`} d={altitudePath(body)} />)}{Number.isFinite(cursor) && cursor >= 0 && cursor <= 360 && <line x1={cursor} x2={cursor} y1="0" y2="180" stroke="currentColor" />}</svg>
      <div className="chart-ticks"><time dateTime={analysis.period.startUtc}>{utcLabel(analysis.period.startUtc)}</time><time dateTime={analysis.period.endUtc}>{utcLabel(analysis.period.endUtc)}</time></div>
    </figure>}
    <details open={regional}><summary>Samples & horizon (degrees, UTC)</summary><div className="table-scroll"><table><thead><tr><th>UTC</th><th>Sun altitude °</th><th>Earth altitude °</th></tr></thead><tbody>{analysis.samples.map(s => <tr key={s.timeUtc} aria-current={Date.parse(s.timeUtc) === Date.parse(timeUtc) ? 'true' : undefined}><td><time dateTime={s.timeUtc}>{utcLabel(s.timeUtc)}</time></td><td>{metric(s.sun.elevationDeg)}</td><td>{metric(s.earth.elevationDeg)}</td></tr>)}</tbody></table></div><p>{analysis.horizon ? `${analysis.horizon.points.length} horizon points` : 'Horizon unavailable'}</p>{analysis.horizon && <svg viewBox="0 0 360 180" role="img" aria-label="Terrain horizon profile: azimuth 0 to 360 degrees"><polyline fill="none" stroke="currentColor" points={[...analysis.horizon.points].sort((a,b) => a.azimuthDeg-b.azimuthDeg).map(p => `${p.azimuthDeg},${90-p.elevationDeg}`).join(' ')} /></svg>}</details>
  </article>;
}
