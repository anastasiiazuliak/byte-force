import { useRef } from 'react';
import { canExport, createCsv, type ExportRun } from './exportData';
import './export.css';

const measure = (value: number | null, unit: string) => value === null ? 'Unknown' : `${value} ${unit}`;

function downloadCsv(run: ExportRun) {
  const url = URL.createObjectURL(new Blob([createCsv(run)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lunar-${run.differences ? 'compare' : 'analysis'}${run.mode === 'demo' ? '-synthetic' : ''}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportActions({ run }: { run: ExportRun }) {
  const dialog = useRef<HTMLDialogElement>(null);
  if (!canExport(run)) return <p className="muted">Export unavailable for this data source.</p>;
  return (
    <>
      <div className="export-report-actions" role="group" aria-label="Export results">
        <button type="button" onClick={() => downloadCsv(run)}>Download CSV</button>
        <button type="button" onClick={() => dialog.current?.showModal()}>Print report</button>
      </div>
      <dialog ref={dialog} className="export-report" aria-labelledby="export-report-title">
        <div className="actions report-controls">
          <button type="button" onClick={() => dialog.current?.close()}>Close</button>
          <button type="button" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
        <h2 id="export-report-title">Lunar Site Navigator · {run.differences ? 'Comparison' : 'Analysis'} report</h2>
        <p>{run.mode === 'demo' ? 'Demo · Synthetic data' : 'Live API · quality varies'} · API version {run.apiVersion ?? 'unknown'}</p>
        {run.scenarios.map(({ id, analysis, error }) => (
          <section key={id}>
            <h3>Site {id === 'A' ? '1 (A)' : '2 (B)'}</h3>
            {analysis ? <>
              <p>{analysis.status === 'partial' ? 'Partial results' : 'Complete results'} · {analysis.samples.length} samples</p>
              <dl>
                <dt>Coordinates</dt><dd>{analysis.location.latitude}°, {analysis.location.longitude}°</dd>
                <dt>Period (UTC)</dt><dd>{analysis.period.startUtc} → {analysis.period.endUtc} · step {analysis.period.stepMinutes} min</dd>
                <dt>Sunlight</dt><dd>{measure(analysis.summary.sunVisibleHours, 'h')} ({measure(analysis.summary.sunVisiblePercent, '%')})</dd>
                <dt>Earth visibility</dt><dd>{measure(analysis.summary.earthVisibleHours, 'h')} ({measure(analysis.summary.earthVisiblePercent, '%')})</dd>
                <dt>Both visible</dt><dd>{measure(analysis.summary.bothVisibleHours, 'h')}</dd>
                <dt>Ephemeris</dt><dd>{analysis.quality.ephemerisSource}</dd>
                <dt>Terrain</dt><dd>{analysis.quality.terrainApplied ? 'Applied' : 'Not applied'} · {analysis.quality.terrainSource ?? 'Unknown source'}</dd>
                <dt>DEM resolution</dt><dd>{measure(analysis.quality.terrainResolutionMeters, 'm')}</dd>
                <dt>Visibility method</dt><dd>{analysis.quality.visibilityMethod}</dd>
              </dl>
              {analysis.quality.warnings.length > 0 && <>
                <h4>Warnings</h4>
                <ul>{analysis.quality.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
              </>}
            </> : <p>Unavailable · {error ?? 'Scenario result unavailable.'}</p>}
          </section>
        ))}
        {run.differences && <section>
          <h3>Duration differences (B − A)</h3>
          <dl>
            <dt>Sunlight</dt><dd>{measure(run.differences.sunVisibleHours, 'h')}</dd>
            <dt>Earth visibility</dt><dd>{measure(run.differences.earthVisibleHours, 'h')}</dd>
            <dt>Both visible</dt><dd>{measure(run.differences.bothVisibleHours, 'h')}</dd>
          </dl>
        </section>}
      </dialog>
    </>
  );
}
