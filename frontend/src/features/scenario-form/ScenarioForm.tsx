import type { LandingSite } from '../../api/types';
import type { Draft } from './scenario';

export function SitePicker({ draft, onChange, sites, custom, label, onPick }: {
  draft: Draft; onChange: (draft: Draft) => void; sites: LandingSite[];
  custom: boolean; label: string; onPick?: () => void;
}) {
  const selected = sites.find(site => site.id === draft.siteId);
  return (
    <fieldset>
      <legend>{label}</legend>
      {custom || !sites.length ? (
        <div className="input-pair">
          <label>Latitude (− south)<input inputMode="decimal" value={draft.latitude} onChange={event => onChange({ ...draft, siteId: '', latitude: event.target.value })} /></label>
          <label>Longitude (+ east)<input inputMode="decimal" value={draft.longitude} onChange={event => onChange({ ...draft, siteId: '', longitude: event.target.value })} /></label>
        </div>
      ) : (
        <>
          <label className="sr-only" htmlFor={label.replaceAll(' ', '-')}>Select {label}</label>
          <select id={label.replaceAll(' ', '-')} value={selected?.id ?? ''} onChange={event => {
            const site = sites.find(item => item.id === event.target.value);
            onChange({ ...draft, siteId: site?.id ?? '', latitude: site ? String(site.latitude) : '', longitude: site ? String(site.longitude) : '' });
          }}>
            <option value="">Select coordinates</option>
            {sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
          {selected && <p className="muted">{selected.description} {selected.sourceUrl && /^https?:\/\//i.test(selected.sourceUrl) && <a href={selected.sourceUrl}>Site source</a>}</p>}
        </>
      )}
      <button type="button" disabled={!onPick} onClick={onPick}>Pick on terrain</button>
    </fieldset>
  );
}

export function PeriodFields({ draft, onChange, label }: {
  draft: Draft; onChange: (draft: Draft) => void; label: string;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <label>Start (UTC)<input required type="datetime-local" value={draft.start} onChange={event => onChange({ ...draft, start: event.target.value })} /></label>
      <label>End (UTC)<input required type="datetime-local" value={draft.end} onChange={event => onChange({ ...draft, end: event.target.value })} /></label>
      <label>Step (minutes)<input inputMode="numeric" required value={draft.step} onChange={event => onChange({ ...draft, step: event.target.value })} /></label>
    </fieldset>
  );
import type { ScenarioDraft } from '../../app/scenario';
export function ScenarioFields({ id, draft, sites, onChange }: { id: 'A' | 'B'; draft: ScenarioDraft; sites: LandingSite[]; onChange: (draft: ScenarioDraft) => void }) {
  return <fieldset><legend>Scenario {id}</legend>
    <label>Landing site {id}<select aria-label={`Landing site ${id}`} value="" onChange={event => { const site = sites.find(s => s.id === event.target.value); if (site) onChange({ ...draft, latitude: String(site.latitude), longitude: String(site.longitude) }); }}><option value="">Custom coordinates / choose site</option>{sites.map(site => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label>
    {(['latitude', 'longitude', 'start', 'end', 'step'] as const).map(key => <label key={key}>{({ latitude: 'Latitude (° N; south negative)', longitude: 'Longitude (° E)', start: 'Start UTC', end: 'End UTC', step: 'Step (minutes)' })[key]} {id}<input data-testid={`${id}-${key}`} aria-label={`${({ latitude: 'Latitude', longitude: 'Longitude', start: 'Start UTC', end: 'End UTC', step: 'Step minutes' })[key]} ${id}`} type={key === 'start' || key === 'end' ? 'datetime-local' : 'text'} inputMode={key === 'latitude' || key === 'longitude' || key === 'step' ? 'decimal' : undefined} value={draft[key]} onChange={event => onChange({ ...draft, [key]: event.target.value })} required /></label>)}
    <small>UTC only · longitude east-positive. Manual coordinates are user input, not verified landing sites.</small>
  </fieldset>;
}
