import { useEffect, useState } from 'react';
import type { AnalysisResponse } from '../../api/types';

export function intervalContains(time: string, start: string, end: string) {
  return (
    Date.parse(time) >= Date.parse(start) && Date.parse(time) < Date.parse(end)
  );
}
export function MissionTimeline({
  analyses,
  timeUtc,
  onTime,
}: {
  analyses: AnalysisResponse[];
  timeUtc: string;
  onTime: (time: string) => void;
}) {
  const times = [
    ...new Set(analyses.flatMap((a) => a.samples.map((s) => s.timeUtc))),
  ].sort();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const index = Math.max(
    0,
    times.findIndex((time) => Date.parse(time) === Date.parse(timeUtc)),
  );
  const key = times.join(',');
  useEffect(() => {
    setPlaying(false);
  }, [key]);
  useEffect(() => {
    if (!playing || times.length < 2) return;
    const timer = setInterval(() => {
      if (index >= times.length - 1) setPlaying(false);
      else onTime(times[index + 1]);
    }, 1000 / speed);
    return () => clearInterval(timer);
  }, [playing, index, key, speed, onTime]);
  if (!times.length) return <p role="status">Waiting for analysis samples.</p>;
  return (
    <div>
      <output data-testid="selected-utc" aria-live="polite">
        {timeUtc}
      </output>
      <label>
        Selected UTC sample
        <input
          aria-label="Selected UTC sample"
          type="range"
          min="0"
          max={times.length - 1}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            onTime(times[Number(e.target.value)]);
          }}
        />
      </label>
      <button type="button" onClick={() => setPlaying(!playing)}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <label>
        Playback speed
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          {[1, 4, 16].map((s) => (
            <option key={s} value={s}>
              ×{s}
            </option>
          ))}
        </select>
      </label>
      {analyses.map((a, i) => (
        <section key={i}>
          <strong>Scenario {i === 0 ? 'A' : 'B'}</strong>
          {(['sunVisible', 'earthVisible'] as const).map((body) => (
            <p key={body}>
              {body === 'sunVisible' ? 'Sun' : 'Earth'} intervals [start, end):{' '}
              {a.quality.terrainApplied
                ? a.intervals[body].map((interval) => (
                    <span
                      key={interval.startUtc}
                      aria-current={
                        intervalContains(
                          timeUtc,
                          interval.startUtc,
                          interval.endUtc,
                        )
                          ? 'true'
                          : undefined
                      }
                    >
                      {' '}
                      {interval.startUtc} – {interval.endUtc};{' '}
                    </span>
                  ))
                : 'Terrain visibility unknown'}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
