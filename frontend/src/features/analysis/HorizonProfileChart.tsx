import { useId, useState } from 'react';
import type { AnalysisSample, HorizonProfile } from '../../api/types';
import { metric, utcLabel } from './analysisHelpers';

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function horizonGeometry(profile: HorizonProfile | null | undefined, sample?: AnalysisSample) {
  // Invalid elevations remain in the ordered sequence so NoData breaks a line.
  const points = [...(profile?.points ?? [])].filter(p => finite(p.azimuthDeg) && p.azimuthDeg >= 0 && p.azimuthDeg <= 360).sort((a, b) => a.azimuthDeg - b.azimuthDeg);
  const gaps = points.slice(1).map((p, i) => p.azimuthDeg - points[i].azimuthDeg).filter(g => g > 0);
  const smallest = gaps.length ? Math.min(...gaps) : 0;
  // The contract carries no spacing metadata. Require repeated fine spacing,
  // never extrapolate a sparse set of bearings into a continuous skyline.
  const step = smallest > 0 && smallest <= 10 && gaps.filter(g => Math.abs(g - smallest) < 1e-6).length >= 2 ? smallest : 0;
  const adjacent = (a: number, b: number) => step > 0 && b > a && b - a <= step + 1e-6;
  const segments: { azimuthDeg: number; elevationDeg: number }[][] = [];
  let current: { azimuthDeg: number; elevationDeg: number }[] = [];
  for (const p of points) {
    if (!finite(p.elevationDeg)) { current = []; continue; }
    if (!current.length || !adjacent(current[current.length - 1].azimuthDeg, p.azimuthDeg)) { current = []; segments.push(current); }
    current.push(p);
  }
  const first = points[0], last = points[points.length - 1];
  if (first && last && finite(first.elevationDeg) && finite(last.elevationDeg) && adjacent(last.azimuthDeg, first.azimuthDeg + 360)) {
    const elevationDeg = last.elevationDeg + (first.elevationDeg - last.elevationDeg) * (360 - last.azimuthDeg) / (first.azimuthDeg + 360 - last.azimuthDeg);
    if (last.azimuthDeg < 360) segments.push([last, { azimuthDeg: 360, elevationDeg }]);
    if (first.azimuthDeg > 0) segments.push([{ azimuthDeg: 0, elevationDeg }, first]);
  }
  const values = [...points.map(p => p.elevationDeg), sample?.sun.elevationDeg, sample?.earth.elevationDeg].filter(finite);
  const low = Math.min(0, ...values), high = Math.max(0, ...values);
  const padding = Math.max(.5, (high - low) * .1);
  const min = low - padding, max = high + padding;
  const x = (az: number) => 54 + az / 360 * 612;
  const y = (alt: number) => 242 - (alt - min) / (max - min) * 214;
  return { min, max, x, y, segments, points: points.filter(p => finite(p.elevationDeg)) };
}

export function HorizonProfileChart({ profile, sample, timeUtc }: { profile: HorizonProfile | null | undefined; sample?: AnalysisSample; timeUtc: string }) {
  const [active, setActive] = useState<string | null>(null);
  const id = useId();
  const geometry = horizonGeometry(profile, sample);
  const body = active?.startsWith(`${timeUtc}:`) ? active.slice(timeUtc.length + 1) as 'sun' | 'earth' : null;
  const position = body ? sample?.[body] : undefined;
  return <figure style={{ margin: '1rem 0', padding: '1rem', border: '1px solid currentColor', borderRadius: 8 }}>
    <figcaption><strong>Terrain horizon & current astronomical positions</strong><br/><time dateTime={timeUtc}>{utcLabel(timeUtc)}</time> · exact cached UTC sample<br/>
      <span>LOLA regional horizon — solid line / isolated points</span> · <span className="sun-key">Sun — circle</span> · <span className="earth-key">Earth — diamond</span>
    </figcaption>
    {!geometry.points.length && <p>Terrain horizon unavailable. Astronomical positions remain independent of terrain coverage.</p>}
    <svg viewBox="0 0 720 300" style={{ display: 'block', width: '100%', maxHeight: 400 }} role="group" aria-label="Terrain horizon and exact astronomical positions">
      <g role="img" aria-label="Terrain horizon profile: azimuth 0 to 360 degrees">
        <path d={`M54 28V242H666 M54 ${geometry.y(0)}H666`} fill="none" stroke="currentColor" opacity=".4"/>
        {[0, 90, 180, 270, 360].map(az => <g key={az}><path d={`M${geometry.x(az)} 242v5`} stroke="currentColor"/><text x={geometry.x(az)} y="263" textAnchor="middle" fill="currentColor">{az}°</text></g>)}
        {[geometry.min, 0, geometry.max].map((alt, i) => <text key={i} x="49" y={geometry.y(alt) + 4} textAnchor="end" fill="currentColor" fontSize="11">{metric(alt, '°')}</text>)}
        <text x="360" y="289" textAnchor="middle" fill="currentColor">Azimuth · North 0° / 360° · East 90°</text>
        <text x="54" y="16" fill="currentColor">Altitude (°)</text>
        {geometry.segments.map((segment, i) => <path key={i} data-testid="horizon-segment" d={segment.map((p, j) => `${j ? 'L' : 'M'}${geometry.x(p.azimuthDeg)},${geometry.y(p.elevationDeg)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2"/>)}
        {geometry.points.map((p, i) => <circle key={i} cx={geometry.x(p.azimuthDeg)} cy={geometry.y(p.elevationDeg)} r="2" fill="currentColor"/>)}
      </g>
      {(['sun', 'earth'] as const).map(name => {
        const p = sample?.[name];
        if (!p || !finite(p.azimuthDeg) || !finite(p.elevationDeg) || p.azimuthDeg < 0 || p.azimuthDeg > 360) return null;
        const x = geometry.x(p.azimuthDeg), y = geometry.y(p.elevationDeg);
        const show = () => setActive(`${timeUtc}:${name}`);
        return <g key={name} role="button" tabIndex={0} aria-label={`Inspect ${name === 'sun' ? 'Sun' : 'Earth'} horizon position`} aria-describedby={body === name ? id : undefined} className={`${name}-key`} style={{ cursor: 'pointer' }} onMouseEnter={show} onMouseLeave={() => setActive(null)} onFocus={show} onBlur={() => setActive(null)} onClick={show} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); } if (e.key === 'Escape') setActive(null); }}>
          <circle cx={x} cy={y} r="12" fill="transparent" stroke="currentColor" strokeOpacity=".3"/>
          {name === 'sun' ? <circle data-testid="sun-horizon-marker" cx={x} cy={y} r="6" fill="currentColor"/> : <path data-testid="earth-horizon-marker" d={`M${x} ${y - 7}l7 7 -7 7 -7 -7Z`} fill="currentColor"/>}
        </g>;
      })}
    </svg>
    {!sample && <p>No exact cached positions at this UTC; markers are not interpolated.</p>}
    {body && position && <p id={id} role="tooltip">{body === 'sun' ? 'Sun' : 'Earth'} · {utcLabel(timeUtc)} · azimuth {metric(position.azimuthDeg, '°')} · elevation {metric(position.elevationDeg, '°')} · horizon {metric(position.horizonDeg, '°')} · clearance {metric(position.clearanceDeg, '°')}</p>}
    <p className="muted">Gaps mean unavailable or unproven azimuth coverage; isolated points do not imply a continuous skyline. Horizon and clearance are cached values, not confirmed visibility.</p>
  </figure>;
}
