import { useState } from 'react';
import type { ShellSlots, View } from './AppShell';

function TerrainViewer() {
  return (
    <>
      <div className="terrain-disc" aria-hidden="true" />
      <p className="terrain-caption">Terrain preview</p>
    </>
  );
}

function ScenarioForm({ view }: { view: View }) {
  const [custom, setCustom] = useState(false);
  const [preview, setPreview] = useState(false);
  const sites = view === 'compare' ? ['Site 1', 'Site 2'] : ['Landing Site'];
  return (
    <form onSubmit={(event) => { event.preventDefault(); setPreview(true); }} onChange={() => setPreview(false)}>
      <div className="coordinate-modes" role="group" aria-label="Coordinate entry mode">
        <button type="button" aria-pressed={!custom} onClick={() => { setCustom(false); setPreview(false); }}>Select Coordinates</button>
        <button type="button" aria-pressed={custom} onClick={() => { setCustom(true); setPreview(false); }}>Custom Coordinates</button>
      </div>
      {sites.map((site) => (
        <label key={site}>{site}
          {custom ? <input placeholder="Latitude, longitude" /> : (
            <select defaultValue="">
              <option value="">Select coordinates</option>
              <option>Demo site A</option>
              <option>Demo site B</option>
            </select>
          )}
        </label>
      ))}
      <div className="date-time">
        <label>Date (UTC)<input type="date" defaultValue="2028-04-15" /></label>
        <label>Time (UTC)<input type="time" defaultValue="16:00" /></label>
      </div>
      <button type="submit" className="primary-button">Analyze</button>
      {preview && <p className="muted" role="status">Showing the synthetic preview.</p>}
    </form>
  );
}

function AnalysisPanel({ site = 1 }: { site?: 1 | 2 }) {
  return (
    <dl className="metrics">
      <div><dt>Solar Elevation</dt><dd>{site === 1 ? '5.2°' : '15.2°'}</dd></div>
      <div><dt>Sunlight Duration</dt><dd>~14.6 h</dd></div>
      <div><dt>Earth Visibility</dt><dd><span className="available">Visible</span></dd></div>
      <div><dt>Next Sunset</dt><dd>{site === 1 ? 'in 9 h 35 min' : 'in 12 h 3 min'}</dd></div>
      <div><dt>Next Earthset</dt><dd>in 9 h 35 min</dd></div>
    </dl>
  );
}

function MissionTimeline({ view }: { view: View }) {
  return (
    <div className="timeline">
      {(view === 'compare' ? [1, 2] : [1]).map((site) => (
        <div key={site}>
          {view === 'compare' && <h3>Site {site}</h3>}
          <div className="track-row"><span>Sunlight</span><div className="track sun" aria-label="Illustrative sunlight interval" role="img" /></div>
          <div className="track-row"><span>Earth Visibility</span><div className="track earth" aria-label="Illustrative Earth visibility intervals" role="img" /></div>
          <div className="track-row muted"><span>Next 24 hours</span><div className="scale"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div></div>
        </div>
      ))}
    </div>
  );
}

export const demoSlots: ShellSlots = {
  TerrainViewer,
  ScenarioForm,
  AnalysisPanel,
  MissionTimeline,
  ComparePanel: AnalysisPanel,
};
