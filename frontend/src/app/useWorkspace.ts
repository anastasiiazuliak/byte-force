import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { View } from './AppShell';
import { createConfiguredClient } from '../integration/client';
import type { HttpLunarApiClient } from '../api/client';
import type {
  AnalysisResponse,
  CompareResponse,
  ConfigResponse,
  LandingSite,
  MapMetadataResponse,
} from '../api/types';
import {
  exploratoryPatches,
  loadSiteCatalog,
  type Overview,
} from './siteCatalog';
import {
  initialDraft,
  LatestRequest,
  parseScenario,
  type ScenarioDraft,
} from './scenario';
import { errorMessage } from './errorMessage';

export function useWorkspace() {
  const [client, setClient] = useState<HttpLunarApiClient | null>(null);
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [sites, setSites] = useState<LandingSite[]>([]);
  const [metadata, setMetadata] = useState<MapMetadataResponse | null>(null);
  const [patches, setPatches] = useState(exploratoryPatches);
  const [globe, setGlobe] = useState<Overview | null>(null);
  const [representation, setRepresentation] = useState<'globe' | 'terrain'>(
    'globe',
  );
  const [overview, setOverview] = useState<Overview | null>(null);
  const [currentSite, setCurrentSite] = useState('');
  const mapIntent = useRef<string | null>(null);
  const [startup, setStartup] = useState<string[]>(['Connecting to API…']);
  const [reload, setReload] = useState(0);
  const [view, setViewState] = useState<View>('analyze');
  const [a, setA] = useState<ScenarioDraft>({ ...initialDraft });
  const [b, setB] = useState<ScenarioDraft>({ ...initialDraft });
  const [analyses, setAnalyses] = useState<AnalysisResponse[]>([]);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [timeUtc, setTime] = useState(initialDraft.start + ':00Z');
  const [state, setState] = useState<'empty' | 'loading' | 'error' | 'ready'>(
    'empty',
  );
  const [error, setError] = useState('');
  const [ephemerisStatus, setEphemerisStatus] = useState(
    'Moon-fixed ephemeris not requested; artistic preview lighting only.',
  );
  const request = useRef(new LatestRequest());
  useEffect(() => {
    const controller = new AbortController();
    setStartup(['Connecting to API…']);
    setMetadata(null);
    setConfig(null);
    setSites([]);
    void createConfiguredClient()
      .then(async (api) => {
        if (controller.signal.aborted) return;
        setClient(api);
        const messages: string[] = [];
        await Promise.all([
          api.health(controller.signal).then(
            () => {},
            (e) => {
              messages.push(`Health: ${errorMessage(e)}`);
            },
          ),
          api.config(controller.signal).then(
            (value) => {
              if (!controller.signal.aborted) setConfig(value);
            },
            (e) => {
              messages.push(
                `Configuration unavailable; conservative local limits apply. ${errorMessage(e)}`,
              );
            },
          ),
          api.landingSites(controller.signal).then(
            (value) => {
              if (!controller.signal.aborted) setSites(value.sites);
            },
            (e) => {
              messages.push(
                `Catalog unavailable; enter coordinates manually. ${errorMessage(e)}`,
              );
            },
          ),
          api.mapMetadata(controller.signal).then(
            (value) => {
              if (!controller.signal.aborted) {
                setMetadata(value);
                void loadSiteCatalog(
                  controller.signal,
                  value,
                  (o) => {
                    if (!controller.signal.aborted) {
                      setOverview(o);
                      if (
                        mapIntent.current === null ||
                        mapIntent.current === o.id
                      ) {
                        setMetadata(o.metadata);
                        setCurrentSite(o.id);
                      }
                    }
                  },
                  (g) => {
                    if (!controller.signal.aborted) setGlobe(g);
                  },
                ).then((p) => {
                  if (!controller.signal.aborted) {
                    setPatches(p);
                    const selected = p.find(
                      (patch) => patch.id === mapIntent.current,
                    );
                    if (selected?.metadata) setMetadata(selected.metadata);
                  }
                });
              }
            },
            (e) => {
              messages.push(
                `Map metadata unavailable; illustrative fallback only. ${errorMessage(e)}`,
              );
            },
          ),
        ]);
        if (!controller.signal.aborted) setStartup(messages);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setStartup([errorMessage(e)]);
      });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => () => request.current.cancel(), []);
  function invalidate() {
    request.current.cancel();
    setAnalyses([]);
    setComparison(null);
    setState('empty');
    setError('');
  }
  function selectPatch(id: string) {
    setRepresentation('terrain');
    mapIntent.current = id;
    if (id === overview?.id) {
      setCurrentSite(id);
      setMetadata(overview.metadata);
      return;
    }
    const patch = patches.find((p) => p.id === id);
    if (!patch) return;
    invalidate();
    setCurrentSite(id);
    if (patch.metadata) setMetadata(patch.metadata);
    setA((d) => ({
      ...d,
      latitude: String(patch.latitude),
      longitude: String(patch.longitude),
    }));
  }
  function prepareCompare() {
    invalidate();
    setViewState('compare');
    const first = patches[0],
      second = patches[1];
    mapIntent.current = first.id;
    setA((d) => ({
      ...d,
      latitude: String(first.latitude),
      longitude: String(first.longitude),
    }));
    setB((d) => ({
      ...d,
      latitude: String(second.latitude),
      longitude: String(second.longitude),
    }));
    setCurrentSite(first.id);
    if (first.metadata) setMetadata(first.metadata);
  }
  function prepareDates() {
    invalidate();
    setViewState('compare');
    setB((draft) => ({ ...draft, latitude: a.latitude, longitude: a.longitude }));
  }
  function samePeriod() {
    change('B', { ...b, start: a.start, end: a.end, step: a.step });
  }
  function quickCompare() {
    const first = patches[0],
      second = patches[1];
    mapIntent.current = first.id;
    const start = new Date(a.start + ':00Z');
    const candidateEnd = new Date(start.getTime() + 3600000);
    const end = Number.isFinite(candidateEnd.getTime())
      ? candidateEnd.toISOString().slice(0, 16)
      : a.end;
    const draftA = {
      ...a,
      latitude: String(first.latitude),
      longitude: String(first.longitude),
      end,
      step: '60',
    };
    const draftB = {
      ...draftA,
      latitude: String(second.latitude),
      longitude: String(second.longitude),
    };
    setA(draftA);
    setB(draftB);
    setViewState('compare');
    setCurrentSite(first.id);
    if (first.metadata) setMetadata(first.metadata);
    void submit(undefined, { a: draftA, b: draftB, view: 'compare' });
  }
  function change(id: 'A' | 'B', draft: ScenarioDraft) {
    invalidate();
    if (
      id === 'A' &&
      (draft.latitude !== a.latitude || draft.longitude !== a.longitude)
    )
      setCurrentSite('');
    (id === 'A' ? setA : setB)(draft);
  }
  function setView(value: View) {
    invalidate();
    setViewState(value);
  }
  async function submit(
    event?: FormEvent,
    override?: { a: ScenarioDraft; b: ScenarioDraft; view: View },
  ) {
    event?.preventDefault();
    const run = request.current.begin();
    setError('');
    setAnalyses([]);
    setComparison(null);
    try {
      if (!client)
        throw new Error('API client is not ready. Retry connection.');
      const scenarioA = parseScenario(override?.a ?? a, config),
        scenarioB =
          (override?.view ?? view) === 'compare'
            ? parseScenario(override?.b ?? b, config)
            : null;
      setState('loading');
      if (config !== null && !config.features.moonFixedEphemeris) {
        setEphemerisStatus(
          'Moon-fixed ephemeris disabled by server config; local cached Sun-angle lighting is used only on a reviewed map and matching sample.',
        );
      } else {
        setEphemerisStatus(
          'Checking Moon-fixed ephemeris; artistic lighting remains illustrative.',
        );
        void client.ephemeris(scenarioA.period, run.signal).then(
          () => {
            if (run.current())
              setEphemerisStatus(
                'Auxiliary Moon-fixed ephemeris received. Scene uses only local Sun angles from the selected cached analysis sample; graphical lighting is not visibility.',
              );
          },
          (e) => {
            if (run.current())
              setEphemerisStatus(
                `Moon-fixed ephemeris unavailable: ${errorMessage(e)}. Local cached Sun-angle lighting is used only on a reviewed map and matching sample.`,
              );
          },
        );
      }
      if (scenarioB) {
        const result = await client.compare(
          {
            scenarios: [
              { id: 'A', ...scenarioA },
              { id: 'B', ...scenarioB },
            ],
          },
          run.signal,
        );
        if (!run.current()) return;
        const ordered = ['A', 'B'].map(
          (id) => result.scenarios.find((s) => s.id === id)!.analysis,
        );
        setComparison(result);
        setAnalyses(ordered);
        setTime(ordered[0].samples[0]?.timeUtc ?? ordered[0].period.startUtc);
      } else {
        const result = await client.analyze(scenarioA, run.signal);
        if (!run.current()) return;
        setAnalyses([result]);
        setTime(result.samples[0]?.timeUtc ?? result.period.startUtc);
      }
      setState('ready');
    } catch (e) {
      if (run.current()) {
        setError(errorMessage(e));
        setState('error');
      }
    }
  }
  return {
    globe,
    representation,
    setRepresentation,
    overview,
    patches,
    currentSite,
    selectPatch,
    prepareCompare,
    prepareDates,
    samePeriod,
    quickCompare,
    cancel: invalidate,
    client,
    config,
    sites,
    metadata,
    startup,
    view,
    setView,
    a,
    b,
    change,
    analyses,
    comparison,
    timeUtc,
    setTime,
    state,
    error,
    ephemerisStatus,
    submit,
    retryConnection: () => {
      invalidate();
      setReload((v) => v + 1);
    },
  };
}
