# Final branch and frontend integration audit

> **Historical snapshot — not current release evidence.** Counts, blockers, branch refs and pending statements below describe their original stage. Current completed results and remaining gates: [RELEASE_TEST_REPORT](RELEASE_TEST_REPORT.md) and [RELEASE_READINESS](RELEASE_READINESS.md). Final push/SHA and post-push CI confirmation remain pending.

## Scope and evidence

- Audited local refs against `origin/main` **dbdb5be80f86b7cbf03adf4d5c0ce6eb9238de50** on 2026-11-15. No fetch, merge, stage, or commit performed. This is the locally available remote-ref snapshot, not a claim about current GitHub state.
- Git author names/emails below are attribution from commit objects, not independently verified identities or inferred team membership.
- Initial agent review used Git only; parent subsequently verified authenticated GitHub CLI access. API-confirmed PR states and historical CI evidence are recorded below; branch creator identity is still not inferred from Git authors.
- Changes in this task are confined to `frontend/**` excluding `frontend/e2e/**`, plus this document. Backend work belongs to the parent integration.

## Every origin ref

| Ref | Tip | Tip author | Commits absent from main | git cherry (+ / −) | Ancestry |
|---|---|---|---:|---|---|
| `origin/HEAD` | `dbdb5be` | DorayMini <hriptunroman602@gmail.com> | 0 | 0 / 0 | contained |
| `origin/docs` | `bcba2a3` | anastasiiazuliak <anastasiyazuliak@gmail.com> | 0 | 0 / 0 | contained |
| `origin/feature/ARC-03-coordinates-and-tiles` | `30ff2ce` | IlyaPopovych <popovych.illia@polytech.pp.ua> | 0 | 0 / 0 | contained |
| `origin/feature/DATA-02-horizon-and-manifest` | `f754142` | IlyaPopovych <popovych.illia@polytech.pp.ua> | 0 | 0 / 0 | contained |
| `origin/feature/DATA-03-terrain-mesh` | `f636e11` | IlyaPopovych <popovych.illia@polytech.pp.ua> | 0 | 0 / 0 | contained |
| `origin/feature/DATA-04-lod-tiles` | `dc21ca9` | IlyaPopovych <popovych.illia@polytech.pp.ua> | 0 | 0 / 0 | contained |
| `origin/feature/DATA-05-science-validation` | `2a56eb7` | IlyaPopovych <popovych.illia@polytech.pp.ua> | 0 | 0 / 0 | contained |
| `origin/feature/FEIU-01-UI-adapt-design-` | `a75d443` | Khrystyna <pavlovych.khrystyna@polytech.pp.ua> | 1 | 1 / 0 | not contained |
| `origin/feature/HUM-02-data-sources` | `c960326` | IlyaPopovych <popovych.illia@polytech.pp.ua> | 0 | 0 / 0 | contained |
| `origin/feature/P2-01-P2-03-illumination-highres` | `2432bc5` | IlyaPopovych <popovych.illia@polytech.pp.ua> | 0 | 0 / 0 | contained |
| `origin/feature/bootstrap-architecture` | `892f4b8` | izachoc <andreborse31@gmail.com> | 1 | 1 / 0 | not contained |
| `origin/feature/lane-4` | `783c07a` | IlyaPopovych <popovych.illia@polytech.pp.ua> | 0 | 0 / 0 | contained |
| `origin/main` | `dbdb5be` | DorayMini <hriptunroman602@gmail.com> | 0 | 0 / 0 | contained |
| `origin/origin/lfeature/lane-3-backend` | `60b45f1` | anastasiiazuliak <anastasiyazuliak@gmail.com> | 0 | 0 / 0 | contained |

`origin/HEAD` is a symbolic alias of `origin/main`. `git cherry` finds no patch-equivalent unmerged commits (−) in this snapshot; the only + commits are below. Zero unique commits on old branches means ancestor content is already included, not that their historical contribution was empty.

### Unique commits and inspected diffs

```text
refs/remotes/origin/feature/FEIU-01-UI-adapt-design-
a75d443b7ea347443a7d1f1ec159fe1841c6132f Khrystyna <pavlovych.khrystyna@polytech.pp.ua> ui and adapted design
+ a75d443b7ea347443a7d1f1ec159fe1841c6132f ui and adapted design
refs/remotes/origin/feature/bootstrap-architecture
892f4b8f7c55980776bb825a7a94be43d5d3c6fa izachoc <andreborse31@gmail.com> fix(ci): resolve repository validation failure
+ 892f4b8f7c55980776bb825a7a94be43d5d3c6fa fix(ci): resolve repository validation failure
```

#### UI source — selectively integrated, not merged

- `a75d443b7ea347443a7d1f1ec159fe1841c6132f`, author **Khrystyna <pavlovych.khrystyna@polytech.pp.ua>**, parent `dbdb5be` (main). Full diff examined: six frontend-only files, 401 insertions/3 deletions.
- Preserved source `AppShell.tsx`, `AppShell.test.tsx`, `components/layout/Panel.tsx`, and `styles/index.css` using `git show` copies. Adapted shell to controlled view/composition and live API quality labeling. The original navy/purple mission-control layout, collapsible panels, header, mobile layout and slot architecture remain.
- Did not import `demoSlots.tsx` or its synthetic previews. Replaced starter `main.tsx` with the live Application entry. No branch-wide merge/cherry-pick. Parent should record the source commit in the integration commit; an optional later ours-strategy ancestry record is not required by this implementation.

#### Bootstrap CI fix — parent action required

- `892f4b8f7c55980776bb825a7a94be43d5d3c6fa`, author **izachoc <andreborse31@gmail.com>**, remains absent from main and patch-unique.
- Bootstrap PR #5 merged earlier work, not this subsequent fix. Parent must review/integrate the CI fix; this frontend owner did not alter infrastructure.

```text
892f4b8 fix(ci): resolve repository validation failure
 .github/workflows/ci.yml | 3 +++
 1 file changed, 3 insertions(+)
```

## Local heads and tags

```text
refs/heads/feature/bootstrap-architecture 892f4b8f7c55980776bb825a7a94be43d5d3c6fa izachoc <<andreborse31@gmail.com>>
refs/heads/feature/final-integration dbdb5be80f86b7cbf03adf4d5c0ce6eb9238de50 DorayMini <<hriptunroman602@gmail.com>>
refs/heads/feature/lane-1 57f0aee296ac73bb65932c603a5ce6ec5ee8fec9 izachoc <<andreborse31@gmail.com>>
refs/heads/feature/lane-2 57f0aee296ac73bb65932c603a5ce6ec5ee8fec9 izachoc <<andreborse31@gmail.com>>
refs/heads/feature/lane-3 57f0aee296ac73bb65932c603a5ce6ec5ee8fec9 izachoc <<andreborse31@gmail.com>>
refs/heads/feature/lane-4 57f0aee296ac73bb65932c603a5ce6ec5ee8fec9 izachoc <<andreborse31@gmail.com>>
refs/heads/feature/lane-5 57f0aee296ac73bb65932c603a5ce6ec5ee8fec9 izachoc <<andreborse31@gmail.com>>
refs/heads/main 57f0aee296ac73bb65932c603a5ce6ec5ee8fec9 izachoc <<andreborse31@gmail.com>>
```

## Historical contribution attribution (all origin refs, deduplicated commits)

Counts are commit authorship including merges, not effort or ownership rankings.

```text
15	IlyaPopovych <popovych.illia@polytech.pp.ua>
    11	anastasiiazuliak <anastasiyazuliak@gmail.com>
    11	izachoc <102189909+izachoc@users.noreply.github.com>
     4	izachoc <andreborse31@gmail.com>
     2	DorayMini <hriptunroman602@gmail.com>
     1	Khrystyna <pavlovych.khrystyna@polytech.pp.ua>
     1	anastasiiazuliak <zuliak.anastasiia@polytech.pp.ua>
```

## Local PR merge evidence already in main

```text
81f754d IlyaPopovych <popovych.illia@polytech.pp.ua> Merge pull request #13 from anastasiiazuliak/feature/P2-01-P2-03-illumination-highres
fab63d9 IlyaPopovych <popovych.illia@polytech.pp.ua> Merge pull request #12 from anastasiiazuliak/feature/DATA-04-lod-tiles
f3a3c02 IlyaPopovych <popovych.illia@polytech.pp.ua> Merge pull request #11 from anastasiiazuliak/feature/DATA-02-horizon-and-manifest
6a51a62 IlyaPopovych <popovych.illia@polytech.pp.ua> Merge pull request #10 from anastasiiazuliak/feature/DATA-05-science-validation
ba4c73b IlyaPopovych <popovych.illia@polytech.pp.ua> Merge pull request #9 from anastasiiazuliak/feature/DATA-03-terrain-mesh
ee09db8 izachoc <102189909+izachoc@users.noreply.github.com> Merge pull request #8 from anastasiiazuliak/origin/lfeature/lane-3-backend
64d6f85 anastasiiazuliak <anastasiyazuliak@gmail.com> Merge branch 'main' of https://github.com/anastasiiazuliak/byte-force
93efdb7 anastasiiazuliak <anastasiyazuliak@gmail.com> Merge pull request #7 from anastasiiazuliak/feature/lane-4
7d90c48 anastasiiazuliak <anastasiyazuliak@gmail.com> Merge branch 'main' of https://github.com/anastasiiazuliak/byte-force
1db7249 anastasiiazuliak <anastasiyazuliak@gmail.com> Merge branch 'main' of https://github.com/anastasiiazuliak/byte-force
a0e2697 anastasiiazuliak <anastasiyazuliak@gmail.com> Merge pull request #6 from anastasiiazuliak/feature/ARC-03-coordinates-and-tiles
2198200 IlyaPopovych <popovych.illia@polytech.pp.ua> Merge pull request #5 from anastasiiazuliak/feature/bootstrap-architecture
eb38e83 anastasiiazuliak <anastasiyazuliak@gmail.com> Merge branch 'main' of https://github.com/anastasiiazuliak/byte-force
92de0e8 IlyaPopovych <popovych.illia@polytech.pp.ua> Merge pull request #4 from anastasiiazuliak/feature/HUM-02-data-sources
d033534 anastasiiazuliak <anastasiyazuliak@gmail.com> Merge branch 'main' of https://github.com/anastasiiazuliak/byte-force
```

Docs (`origin/docs`, tip `bcba2a3`) is contained in main. Existing 3D scene, performance code and docs were already in main, principally available through `dbdb5be`; they were reused rather than attributed to the UI source branch.

## Frontend implementation / handoff

- Entry: `frontend/src/main.tsx` → exported `Application` from `src/app/Application.tsx` → source-preserving `AppShell` → existing exported `LunarTerrainViewer`.
- One client per configuration generation via `createConfiguredClient` from `src/integration/client.ts`; all HTTP operations go through it. Development mocks require explicit existing `VITE_USE_MOCKS=true`; production remains live API.
- Health/config/catalog/metadata startup requests have visible failure notices and retry. Catalog failure leaves manual entry usable; no invented sites or coordinates are preselected.
- Explicit analyze and compare submissions use frozen DTOs, UTC Z serialization, finite coordinate validation, independent A/B periods and config sampling limits. Copy A→B and swap are supported. Compare shows server-provided B−A differences, preserving null as Unknown.
- `LatestRequest` (exported from `src/app/scenario.ts`) uses AbortController plus generation identity. Input edits, view changes, retries, superseding submits and unmount prevent stale analysis/comparison publication, even for transports ignoring abort. Startup effects independently guard cancellation.
- Shared selected UTC drives scene, sample cards, altitude cursor, horizon data and timeline. Playback/scrub uses cached samples only; no requests per frame. Different scenario periods use absolute UTC union, not a fabricated relative alignment. At timestamps without an exact scenario sample, that scenario shows Unknown.
- Analysis shows partial/complete, null visibility, geometric altitude versus terrain horizon/clearance, source/method/resolution, warnings, altitude SVG and sample table, and horizon profile. Terrain-not-applied is prominent. No automatic winner or made-up science.
- Optional ephemeris is requested once per explicit submission. Structured 503 is displayed without substituting synthetic vectors. Even if an endpoint later returns vectors, graphics remain explicitly artistic until vector→scene adapter validation; no claim of scientific lighting.
- Geographic picking/markers require loaded GLB plus verified metadata and the exact supported spherical polar CRS. Synthetic/missing meshes and unverified/incompatible metadata cannot publish geographic picks. Runtime scene origin is applied to picks/markers/fly-to; picking checks published bounds. Fallback relief is labeled synthetic, and fallback schematic labels do not invent verified named coordinates.

### Exports and selectors for parent-owned E2E

- Exports: `Application`, `errorMessage`; `AppShell`, `PanelState`, `ShellSlots`; `ScenarioFields`; `AnalysisPanel`, `metric`, `visibility`; `MissionTimeline`, `intervalContains`; `parseScenario`, `initialDraft`, `LatestRequest`; `canUseGeographicTerrain`; existing explorer exports remain.
- Workspace nav accessible buttons: exact `Analyze` / `Compare`; submission `Analyze site` / `Compare scenarios` / `Restart analysis`; `Copy A to B`, `Swap A ↔ B`, `Retry connection`.
- Form labels: `Latitude A`, `Longitude A`, `Start UTC A`, `End UTC A`, `Step minutes A` (same for B); catalogs `Landing site A` / `Landing site B`.
- Test IDs: `A-latitude`, `A-longitude`, `A-start`, `A-end`, `A-step` (and B); `analysis-result` (two in Compare); `analysis-error`; `comparison-differences`; `ephemeris-status`; `selected-utc`; existing `lunar-terrain-viewer`.
- Timeline range accessible name `Selected UTC sample`, playback buttons `Play` / `Pause`, selector `Playback speed`. Panel IDs `terrain-scene-slot`, `site-time`, `analysis`, `comparison`, `timeline` retained.
- No E2E files changed. Parent owns real browser/WebGL checks, mobile screenshots, deployment, broader backend and integration evidence.

## Validation

- `npm ci` (frontend): passed; subsequent install added only dev test dependencies `@testing-library/react` and `jsdom`; final `npm ci` also passed, 0 vulnerabilities.
- `npm run build`: passed after correcting one test-only TypeScript option; Vite reports a >500 kB bundle-size warning from existing Three/R3F scene imports. Not a performance certification.
- `npm test`: **8 test files, 43 tests passed**, including 4 new Application interaction tests and 12 scenario/lifecycle/metadata/boundary tests.
- `npm run test:contracts`: **5 tests passed**; frozen contracts untouched.
- New interaction coverage: UTC submit, partial/null quality, real structured 503, stale response after coordinate edit with abort-ignoring transport, A=B compare and scrub without new HTTP requests.
- `git diff --check`: passed at review. No backend tests, Playwright, production deployment, real NASA downloads or scientific verification are claimed here.

## Remaining caveats / parent actions

- Integrate/bootstrap CI fix `892f4b8` and record selective UI source `a75d443` attribution.
- NASA DEM integrity, verified CRS/datum and deployed GLB availability remain runtime prerequisites. Missing assets retain a visibly synthetic fallback; not a verified lunar surface.
- Moon-fixed lighting adapter is deliberately unvalidated; art lighting must remain labeled. Real backend ephemeris may honestly return 503.
- LOD loader/performance utilities already exist but are not promoted here into a new verified production asset pipeline. Parent validates real-browser GPU behavior, load/performance and deployment paths.
- P2 export, advanced full chart tooling, interpolated between-sample science and real FPS/memory certification are not claimed by this frontend integration.

## Parent integration outcome

Відсутній CI patch `892f4b8` відтворено в repository checkout (`fetch-depth: 0`) та доповнено offline browser/security/schema CI. UI source `a75d443` включено вибірково з attribution; `demoSlots` не підключено як другий застосунок. Решта team branches вже є ancestors main — повторно не merge-или. Branch creation identity Git не зберігає, таблиця наводить commit authors, а не вигаданих branch creators.

Actual merge conflicts при вибірковому перенесенні не виникли. Знайдено **вже закомічені** conflict markers у main `TerrainFactory.cs` і API README: усунено, поєднано path/env behavior та safe unavailable cases. Rootcause runtime 500 від incomplete DEM і деталі всіх фінальних tests — у [FINAL_TEST_REPORT](FINAL_TEST_REPORT.md).

Final local evidence: frontend 45 passed; backend 162 passed + 1 live skipped; separate live1 passed; browser with live opt-in4 passed; AJV12 payloads. Baseline per-branch tests окремо не вважаються passed: запускали сукупний інтегрований tree, з незмінними contracts і documented science gates.

## Authenticated GitHub verification (parent)

`gh auth status` verified account `izachoc` via existing keyring (no token copied to files). `gh pr list --state all` confirmed:

| PR | State | Head | PR author |
|---|---|---|---|
| #14 | OPEN | feature/FEIU-01-UI-adapt-design- | pavlovychky |
| #13 | MERGED | feature/P2-01-P2-03-illumination-highres | IlyaPopovych |
| #12 | MERGED | feature/DATA-04-lod-tiles | IlyaPopovych |
| #11 | MERGED | feature/DATA-02-horizon-and-manifest | IlyaPopovych |
| #10 | MERGED | feature/DATA-05-science-validation | IlyaPopovych |
| #9 | MERGED | feature/DATA-03-terrain-mesh | IlyaPopovych |
| #8 | MERGED | origin/lfeature/lane-3-backend | anastasiiazuliak |
| #7 | MERGED | feature/lane-4 | IlyaPopovych |
| #6 | MERGED | feature/ARC-03-coordinates-and-tiles | IlyaPopovych |
| #5 | MERGED | feature/bootstrap-architecture | izachoc |
| #4 | MERGED | feature/HUM-02-data-sources | IlyaPopovych |

Historical main [run 43636580355](https://github.com/anastasiiazuliak/byte-force/actions/runs/43636580355): frontend success, backend failure from `TerrainFactory.cs` conflict markers (CS8300), repository failure from the existing synthetic TIFF. These confirm the locally found root causes. No historical failures were suppressed; current fixes compile the real source and accept only one exact-path/hash-pinned synthetic fixture with rejection regression tests.

PR #14 remains untouched: its useful UI source is selectively integrated with attribution in this branch. Reviewers should coordinate its disposition after final integration review, not blindly merge its old demo composition over the integrated Application. No source branch or PR was deleted/closed by the integrator. Final integration PR URL and current CI status are reported after push in the final handoff.

## Current selective UI/export addendum

New UI branch range `a75d443..8394de2` introduces a parallel `MissionApp` and shared interfaces; it was **not merged wholesale**. The existing integrated shell and contracts were retained. P2-02 export serializer/actions/tests/docs were selectively ported, preserving teammate attribution (Khrystyna / UI contribution), not reassigned to the integrator. Current frontend evidence is 74 tests in 12 files; the earlier 13-case browser log predates new live export assertions, whose completed rerun remains pending. See [current test report](RELEASE_TEST_REPORT.md). This addendum does not refresh the historical remote-ref table or claim push/CI success.
