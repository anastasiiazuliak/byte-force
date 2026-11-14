import type { LandingSite } from '../../api/types';
import type { ScenarioDraft } from '../../app/scenario';
export function ScenarioFields({ id, draft, sites, onChange }: { id: 'A' | 'B'; draft: ScenarioDraft; sites: LandingSite[]; onChange: (draft: ScenarioDraft) => void }) {
  return <fieldset><legend>Scenario {id}</legend>
    <label>Landing site {id}<select aria-label={`Landing site ${id}`} value="" onChange={event => { const site = sites.find(s => s.id === event.target.value); if (site) onChange({ ...draft, latitude: String(site.latitude), longitude: String(site.longitude) }); }}><option value="">Custom coordinates / choose site</option>{sites.map(site => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label>
    {(['latitude', 'longitude', 'start', 'end', 'step'] as const).map(key => <label key={key}>{({ latitude: 'Latitude (° N; south negative)', longitude: 'Longitude (° E)', start: 'Start UTC', end: 'End UTC', step: 'Step (minutes)' })[key]} {id}<input data-testid={`${id}-${key}`} aria-label={`${({ latitude: 'Latitude', longitude: 'Longitude', start: 'Start UTC', end: 'End UTC', step: 'Step minutes' })[key]} ${id}`} type={key === 'start' || key === 'end' ? 'datetime-local' : 'text'} inputMode={key === 'latitude' || key === 'longitude' || key === 'step' ? 'decimal' : undefined} value={draft[key]} onChange={event => onChange({ ...draft, [key]: event.target.value })} required /></label>)}
    <small>UTC only · longitude east-positive. Manual coordinates are user input, not verified landing sites.</small>
  </fieldset>;
}
