import type { AnalysisResponse } from '../../api/types';
import { regionalPotentialWindows, type RegionalState } from './regionalWindow';

const labels = { sun: 'Sun', earth: 'Earth', both: 'Combined Sun and Earth' };
const colors: Record<RegionalState, string> = {
  'above-regional-skyline': '#24784b',
  'at-or-below-regional-skyline': '#945d25',
  unknown: '#656575',
};
const hours = (value: number) => `${Number(value.toPrecision(2))} h`;

export function RegionalSummary({ analysis, timeUtc, onTime }: {
  analysis: AnalysisResponse; timeUtc?: string; onTime?: (time: string) => void;
}) {
  const result = regionalPotentialWindows(analysis);
  return <section aria-label="Regional potential windows">
    <h3>Regional potential windows — discrete sampling estimate</h3>
    <p>Sample-supported coarse regional estimate, not confirmed visibility or blockage. Equal endpoint signs do not guarantee continuous availability; short events may be missed. No scientific error bound is available. Earth geometry is not radio performance.</p>
    <p>{result.sampleCount} samples · maximum bin step {result.maxStepMinutes ?? 'unknown'} minutes. Temporal uncertainty spans the whole bin; transition brackets are not crossing times. Exact-zero clearance is unknown.</p>
    <p>Track legend: green — above regional skyline; brown — at-or-below regional skyline (not confirmed blocked); gray — unknown.</p>
    {(['sun', 'earth', 'both'] as const).map(body => {
      const track = result.tracks[body];
      return <section key={body} aria-label={`${labels[body]} regional bins`}>
        <h4>{labels[body]}</h4>
        <p>{track.aboveHours === null ? 'No usable sample-bin estimate.' : <>
          Sample-bin estimated above: {hours(track.aboveHours)} (~{Math.round(track.abovePercent!)}% of selected period); at-or-below: {hours(track.belowHours!)}. </>}
          {' '}Unknown: {track.unknownHours === null ? 'duration unavailable (invalid period)' : hours(track.unknownHours)}.
        </p>
        <div style={{ display: 'flex', minHeight: 24 }} aria-label={`${labels[body]} UTC sample-bin track`}>
          {track.bins.map(bin => {
            const selected = timeUtc !== undefined && Date.parse(timeUtc) >= Date.parse(bin.startUtc) && Date.parse(timeUtc) < Date.parse(bin.endUtc);
            const description = `${bin.startUtc} – ${bin.endUtc}: ${bin.state}; ${bin.reason}; ${bin.sampleCount} bounding samples`;
            return <button type="button" key={bin.startUtc} title={description} aria-label={description}
              aria-current={selected ? 'time' : undefined} disabled={!onTime}
              onClick={() => onTime?.(bin.startUtc)}
              style={{ flexGrow: Date.parse(bin.endUtc) - Date.parse(bin.startUtc), flexBasis: 0, minWidth: 2, padding: 0,
                background: colors[bin.state], opacity: 1, border: selected ? '3px solid currentColor' : '1px solid transparent' }} />;
          })}
        </div>
        <details><summary>UTC bins and transition brackets ({track.bins.length})</summary>
          <ul>{track.bins.map(bin => <li key={bin.startUtc}>
            <time>{bin.startUtc}</time> – <time>{bin.endUtc}</time> [start, end): {bin.state}; {bin.reason === 'transition-uncertain' ? 'transition uncertain throughout this bracket' : bin.reason}; {bin.sampleCount} bounding samples.
          </li>)}</ul>
        </details>
      </section>;
    })}
  </section>;
}
