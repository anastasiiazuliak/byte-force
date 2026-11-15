import type { AnalysisResponse } from '../../api/types';

export function Quality({ analysis }: { analysis: AnalysisResponse }) {
  const { quality, period, status } = analysis;
  return (
    <details className="quality">
      <summary>Data quality · {status === 'partial' ? 'Partial' : 'Complete'}</summary>
      <dl className="metrics">
        <div><dt>Ephemeris</dt><dd>{quality.ephemerisSource}</dd></div>
        <div><dt>Terrain source</dt><dd>{quality.terrainSource ?? 'Unknown'}</dd></div>
        <div><dt>DEM resolution</dt><dd>{quality.terrainResolutionMeters == null ? 'Unknown' : `${quality.terrainResolutionMeters} m`}</dd></div>
        <div><dt>Sampling step</dt><dd>{period.stepMinutes} min</dd></div>
        <div><dt>Method</dt><dd>{quality.visibilityMethod}</dd></div>
      </dl>
      {!!quality.warnings.length && <ul>{quality.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
    </details>
  );
}

export function Glossary() {
  return (
    <dl className="glossary">
      <dt>Geometric line of sight</dt><dd>A direct path to Earth based on local geometry. Radio performance also depends on equipment and propagation.</dd>
      <dt>Solar elevation</dt><dd>The angle of the Sun above the local horizontal plane, in degrees. Actual power depends on the site and the equipment.</dd>
      <dt>Terrain horizon</dt><dd>The elevation angle of the terrain skyline in a given direction.</dd>
    </dl>
  );
}
