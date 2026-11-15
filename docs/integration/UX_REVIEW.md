# PR15 UX integration review

Scope: `.audit/final-integration`, `feature/final-integration`. No commits or staging. Existing PERSON02 dark palette, panel language, Analyze/Compare selectors, and shared UTC state retained. The original review below predates the selective P2-02 export port; its historical counts are not the current release totals. Current evidence: [RELEASE_TEST_REPORT](RELEASE_TEST_REPORT.md).

## Scientific boundaries

Source: `docs/science/TERRAIN_SCIENCE_REVIEW.md`. A nonempty actual horizon with `terrainApplied=false` displays **REGIONAL ESTIMATE · far-field visibility unknown**, renders its regional profile, and does not say no DEM. Null visibility and summaries remain **Unknown**, never zero. Missing DEM and available-but-unreviewed/insufficient terrain have distinct explanatory text. Warnings retain explanatory prose; machine-style warning names receive human-language explanations. Learn summarizes LOLA, MOON_ME / DE421, the 1737.4 km reference sphere, apparent disc-center directions, reviewed 1962–2649 UTC, and excluded power/thermal/link-budget claims. Input validation rejects the exclusive 2650 cutoff.

`Application.SceneSlot` consumes the selected exact analysis sample using the 3D agent's `solarSceneDirection`. No invented global vectors or per-frame requests. Its label is **Local Sun · estimated cached graphical lighting · not visibility**; without validated metadata/sample it labels illustrative lighting. Public scene contract unchanged. Existing auxiliary ephemeris call remains one per submitted run, not per timeline update.

## New controls and stable selectors

- Label/select **Exploratory patch**: `connecting-ridge`, `near-shackleton`, `near-de-gerlache`. Updates scene metadata, A coordinates, and current selection; manual coordinate changes clear selection. Dates and B remain intact.
- Button **Prepare patch comparison**: prepares connecting-ridge A and near-Shackleton B, opens Compare, preserves date/step drafts; does not submit. Existing **Compare scenarios** runs the normal request pipeline.
- Button **Cancel analysis** during loading: aborts and invalidates request identity, clears pending/results state. Form exposes `aria-busy`.
- Link **Skip to site and time** → `#site-time`.
- Disclosure **Connection & lighting details**; existing `ephemeris-status` retained.
- Existing **Latitude A**, **Analyze site**, **Compare**, **Copy A to B**, **Swap A ↔ B**, UTC slider and result/error test IDs remain.

Catalog helper: `frontend/src/app/siteCatalog.ts`, one fetch of `/static/metadata/explorer-sites.json` with startup AbortSignal. Schema v1, three exact exploratory coordinates; 404/malformed/unreviewed catalogs fail softly to coordinate-only presets, without promoting map flags. Approved runtime connecting-ridge metadata establishes the same-origin local root. Catalog acceptance requires reviewed datum/projection, 80 m source, exact reviewed patch URLs/origins, finite valid bounds, and no texture claim. Foreign, traversal, encoded, query-bearing and unknown GLB paths are rejected. Parent remains responsible for deployment byte/hash proof before enabling runtime review flags; this frontend is not a cryptographic asset verifier.

## Layout and accessibility

Larger terrain hero; more panel/fieldset spacing; shorter status chips and collapsible connection detail. Mobile uses one column, tablet fits terrain/form without squeezing three panels, desktop retains terrain emphasis. Existing focus outline and 44 px controls retained; keyboard skip link, explicit cancellation, polite loading/status, alert errors, and global reduced-motion treatment added. Graphic shadows never serve as visibility evidence.

## Original review validation (historical)

- `npm test --prefix frontend`: **65 passed**, including metadata-ready assertion.
- From frontend: `./node_modules/.bin/tsc --noEmit`: passed.
- `./node_modules/.bin/playwright test e2e/ux.spec.ts`: **3 passed**, real local startup, no scientific-response interception.
- Browser viewport checks: **390×844**, **768×1024**, **1440×1000**. Verified keyboard Tab/skip link, reduced-motion preference, patch coordinates, comparison preparation, B preservation, manual coordinate selection reset, no document horizontal overflow, and Learn disclosure.
- Unit coverage: missing map/data, errors, loading/cancellation, stale responses, regional payload rendering despite false quality flag, UTC scrubbing with no extra network, catalog 404/malformed/unreviewed/foreign/unknown URLs, accepted local reviewed mappings, and epoch limits. Test fixture datum expectations updated for tightened 3D datum gate without removing original cases.

Browser runs use the runner's dataset-free fallback GLB; they do **not** certify deployed reviewed three-patch assets or actual NASA regional results. Parent must verify catalog/byte receipts and run its existing live-science browser path after deployment. Transient proxy connection refusals appeared while local backend started; all three UX browser tests subsequently passed. Unit scientific payloads are explicitly test inputs, never runtime mock fallbacks. No claim of complete terrain visibility or recommended landing sites.

## Current post-analysis layout and export evidence

The completed `.validation/final-browser.log` records **13 passed**, including four post-analysis layout cases at **390×844, 768×1024, 1024×768 and 1440×1000**. These four cases explicitly **intercept scientific responses with synthetic fixtures** (seven samples, 360-point profile, long warnings); they are layout/accessibility evidence, not actual NASA/DEM analysis. They verify synthetic/regional/Unknown labels, collapsed warnings with accessible disclosure, two bounded charts fitting their containers, no document horizontal overflow, and cached UTC selection. Desktop widths above 800 use a bounded independently scrolling analysis panel; smaller widths use document flow. Startup/keyboard/reduced-motion cases cover 390/768/1440 without scientific-response interception, but do not submit analysis.

Current frontend result after selective export port: **74 tests / 12 files**, contracts 6 as a subset. P2-02 serializer/actions/tests/docs were selectively ported from the UI branch `a75d443..8394de2`, preserving Khrystyna's attribution; parallel `MissionApp`/shared interfaces were not merged wholesale and the existing shell was retained. CSV and print actions are available after Analyze/Compare; see [export format](../EXPORT_FORMAT.md). The final `.validation/final-browser-export.log` rerun is **13 passed**, including live CSV download/content and print-dialog/media assertions. This does not verify a saved PDF or physical printer. Live scientific browser evidence and intercepted cases are separated in the current test report. Code `dfd0a62` is pushed with GitHub **8/8 checks passed**; final desktop form-height/docs follow-up is separate. Desktop forms now share the bounded scroll behavior, preventing long Compare drafts from pushing the timeline far below the terrain; keyboard reachability of the submit button and the final 13-case live browser rerun passed (`.validation/final-browser-release.log`).
