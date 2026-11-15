import { useEffect, useRef, useState } from 'react';
import type { AnalysisResponse } from '../../api/types';
import { advance, axisFor, utcLabel, within } from './time';

export function MissionTimeline({ results, time, setTime, relative }: {
  results: (AnalysisResponse | null)[]; time: number; setTime: (time: number) => void; relative: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playbackCursor = useRef(time);
  const axis = axisFor(results, relative);
  const start = axis?.start ?? 0;
  const end = axis?.end ?? 0;

  useEffect(() => {
    if (!playing) return;
    let frame: number;
    let previous: number | undefined;
    const tick = (now: number) => {
      if (previous !== undefined) playbackCursor.current = advance(playbackCursor.current, now - previous, speed, end);
      previous = now;
      const cursor = playbackCursor.current;
      if (cursor >= end) setPlaying(false);
      setTime(cursor);
      if (cursor < end) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, end, setTime]);

  if (!axis || end <= start) return <p>No timeline available.</p>;
  const length = end - start;
  const nextEvent = results.reduce((next, result) => {
    if (!result) return next;
    const origin = relative ? Date.parse(result.period.startUtc) : 0;
    for (const interval of [...(result.intervals?.sunVisible ?? []), ...(result.intervals?.earthVisible ?? [])]) {
      for (const edge of [Date.parse(interval.startUtc) - origin, Date.parse(interval.endUtc) - origin]) {
        if (edge > time && edge <= end) next = Math.min(next, edge);
      }
    }
    return next;
  }, Infinity);
  const cursor = 100 * (time - start) / length;
  const label = relative ? `+${((time - start) / 3_600_000).toFixed(2)} h` : utcLabel(Math.floor(time));
  return (
    <>
      <div className="timeline">
        {results.map((result, index) => {
          const origin = result && relative ? Date.parse(result.period.startUtc) : 0;
          return (
            <section key={index} aria-label={`Site ${index + 1} timeline`}>
              {results.length === 2 && <h3>Site {index + 1}</h3>}
              {(['sunVisible', 'earthVisible'] as const).map((key, body) => {
                const intervals = result?.intervals?.[key] ?? [];
                const active = intervals.some(interval => within(interval, time + origin));
                const covered = result && within(result.period, time + origin);
                const status = active ? 'Visible' : covered && result.status === 'complete' &&
                  (body === 0 ? result.summary.sunVisibleHours : result.summary.earthVisibleHours) != null ? 'Blocked' : 'Unknown';
                return (
                  <div className="track-row" key={key}>
                    <span>{body === 0 ? 'Sunlight' : 'Earth visibility'}<small>{status}</small></span>
                    <div className="visibility-track" aria-hidden="true">
                      {intervals.map((interval, i) => {
                        const left = Math.max(0, (Date.parse(interval.startUtc) - origin - start) / length);
                        const right = Math.min(1, (Date.parse(interval.endUtc) - origin - start) / length);
                        return right > left && <span key={i} className={body === 0 ? 'sun-bar' : 'earth-bar'} style={{ left: `${100 * left}%`, width: `${100 * (right - left)}%` }} />;
                      })}
                      <i style={{ left: `${cursor}%` }} />
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      <div className="chart-ticks timeline-ticks">
        <span>{relative ? '+0 h' : utcLabel(start)}</span>
        <span>{relative ? `+${(length / 3_600_000).toFixed(2)} h` : utcLabel(end)}</span>
      </div>
      <div className="clock">
        <label>Selected time <output>{label}</output>
          <input type="range" min={start} max={end} step="any" value={time} aria-valuetext={label}
            onChange={event => { setPlaying(false); setTime(Number(event.target.value)); }}
            onKeyDown={event => {
              const deltas: Record<string, number> = { ArrowRight: 60_000, ArrowUp: 60_000, ArrowLeft: -60_000, ArrowDown: -60_000, PageUp: length / 10, PageDown: -length / 10 };
              const target = event.key === 'Home' ? start : event.key === 'End' ? end : time + (deltas[event.key] ?? NaN);
              if (!Number.isFinite(target)) return;
              event.preventDefault();
              setPlaying(false);
              setTime(Math.max(start, Math.min(end, target)));
            }} />
        </label>
        <div className="actions">
          <button disabled={time >= end && !playing} onClick={() => {
            playbackCursor.current = time;
            setPlaying(!playing);
          }}>{playing ? 'Pause' : 'Play'}</button>
          <label>Speed<select value={speed} onChange={event => setSpeed(Number(event.target.value))}>{[1, 4, 16].map(value => <option key={value} value={value}>×{value}</option>)}</select></label>
          <button disabled={!Number.isFinite(nextEvent)} onClick={() => { setPlaying(false); setTime(nextEvent); }}>Next event</button>
        </div>
      </div>
    </>
  );
import { useEffect, useState } from 'react';
import type { AnalysisResponse } from '../../api/types';
export function intervalContains(time: string, start: string, end: string) { return Date.parse(time) >= Date.parse(start) && Date.parse(time) < Date.parse(end); }
export function MissionTimeline({ analyses, timeUtc, onTime }: { analyses: AnalysisResponse[]; timeUtc: string; onTime: (time: string) => void }) {
  const times = [...new Set(analyses.flatMap(a => a.samples.map(s => s.timeUtc)))].sort();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const index = Math.max(0, times.findIndex(time => Date.parse(time) === Date.parse(timeUtc)));
  const key = times.join(',');
  useEffect(() => { setPlaying(false); }, [key]);
  useEffect(() => {
    if (!playing || times.length < 2) return;
    const timer = setInterval(() => { if (index >= times.length - 1) setPlaying(false); else onTime(times[index + 1]); }, 1000 / speed);
    return () => clearInterval(timer);
  }, [playing, index, key, speed, onTime]);
  if (!times.length) return <p role="status">Waiting for analysis samples.</p>;
  return <div><output data-testid="selected-utc" aria-live="polite">{timeUtc}</output><label>Selected UTC sample<input aria-label="Selected UTC sample" type="range" min="0" max={times.length - 1} value={index} onChange={e => { setPlaying(false); onTime(times[Number(e.target.value)]); }} /></label><button type="button" onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button><label>Playback speed<select value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[1,4,16].map(s => <option key={s} value={s}>×{s}</option>)}</select></label>
    {analyses.map((a,i) => <section key={i}><strong>Scenario {i === 0 ? 'A' : 'B'}</strong>{(['sunVisible','earthVisible'] as const).map(body => <p key={body}>{body === 'sunVisible' ? 'Sun' : 'Earth'} intervals [start, end): {a.quality.terrainApplied ? a.intervals[body].map(interval => <span key={interval.startUtc} aria-current={intervalContains(timeUtc, interval.startUtc, interval.endUtc) ? 'true' : undefined}> {interval.startUtc} – {interval.endUtc}; </span>) : 'Terrain visibility unknown'}</p>)}</section>)}
  </div>;
}
