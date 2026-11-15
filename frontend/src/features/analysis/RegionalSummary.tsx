import type { AnalysisResponse } from '../../api/types';
import { regionalWindow } from './regionalWindow';

export function RegionalSummary({analysis}: {analysis: AnalysisResponse}) {
  return <section><h3>Estimated time above local terrain</h3>
    <dl className="metrics">{(['sun','earth','both'] as const).map(body => {
      const value = regionalWindow(analysis, body);
      const label = {sun:'Sunlight', earth:'Direct Earth link geometry', both:'Sun and Earth together'}[body];
      return <div key={body}><dt>{label}</dt><dd>{value ? value.percent.toFixed(1) + '% · ' + value.hours.toFixed(2) + ' h' : 'Insufficient terrain samples'}</dd></div>;
    })}</dl>
    <small>Regional skyline estimate over the selected period. Linear interpolation between {analysis.samples.length} samples can miss short events. Earth clearance describes geometry only; radio performance is unknown.</small>
  </section>;
}
