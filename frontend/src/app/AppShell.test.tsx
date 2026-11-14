import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell, PanelState } from './AppShell';
import { demoSlots } from './demoSlots';

describe('AppShell', () => {
  it('labels the demo and renders every Analyze slot', () => {
    const page = renderToStaticMarkup(<AppShell slots={demoSlots} dataMode="demo" />);

    expect(page).toContain('Demo · Synthetic');
    for (const id of ['terrain-scene-slot', 'site-time', 'analysis', 'timeline']) {
      expect(page).toContain(`id="${id}"`);
    }
  });

  it('shows an empty state when real results are unavailable', () => {
    const slots = {
      ...demoSlots,
      AnalysisPanel: () => <p>Live analysis output</p>,
      MissionTimeline: () => <p>Live timeline output</p>,
    };
    const page = renderToStaticMarkup(<AppShell slots={slots} dataMode="real" state="empty" />);
    expect(page).toContain('Real data');
    expect(page).toContain('Waiting for analysis.');
    expect(page).not.toContain('Live analysis output');
    expect(page).not.toContain('Live timeline output');
  });

  it('announces loading and offers retry after failure', () => {
    const loading = renderToStaticMarkup(<PanelState state="loading">{null}</PanelState>);
    const error = renderToStaticMarkup(<PanelState state="error" onRetry={() => {}}>{null}</PanelState>);
    expect(loading).toContain('role="status"');
    expect(error).toContain('role="alert"');
    expect(error).toContain('Retry');
  });
});
