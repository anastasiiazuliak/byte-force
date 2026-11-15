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
}
