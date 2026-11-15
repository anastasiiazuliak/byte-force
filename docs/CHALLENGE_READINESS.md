# Challenge readiness

Lunar Navigator supports an end-to-end regional landing-site exploration workflow. This is a research demonstrator, not a landing certification, power forecast or communications link budget.

## Demonstration workflow

1. Follow the [local setup](../README.md#run-locally), including proof-checked runtime assets. Open port 5173.
2. Explore Globe or Terrain View. Choose Site A on reviewed terrain or enter coordinates manually within supported coverage.
3. Set a UTC period and sampling step. The 12/24-hour presets change the draft only; press Analyze to request data.
4. Inspect Astronomical Position and the horizon chart. Its Sun/Earth markers use the exact selected cached sample. Hover or focus the chart controls for angles and clearance.
5. Move the timeline. Charts, results and direction indicators reuse cached samples; they do not send per-frame NASA requests.
6. Inspect Regional Potential Windows. Above/below labels describe the regional skyline at the bounding samples, not guaranteed continuous availability.
7. Choose Site B for a second location. Use the same period for a site comparison.
8. Use **Compare dates at Site A** to copy A's coordinates while retaining B's separate date draft. For different periods, B follows equal elapsed time from its own start, with its own UTC label.
9. Review comparative clearance statistics and uncertainty. Export CSV or print the results.

## Capability checklist

| Requirement | Implementation | Verification |
|---|---|---|
| Site selection | Reviewed surface picking, manual coordinates, shared A/B state | Geographic regression and browser tests |
| UTC selection | Validated periods, step, draft-only presets | UI, contract and API tests |
| Sun and Earth positions | JPL Horizons observer azimuth/elevation | Live backend and local-API browser tests |
| Regional horizon | Real LOLA, 360 bearings, up to 20 km | Real-DEM backend regressions |
| Bodies relative to horizon | Accessible azimuth/elevation chart, exact cached markers, gaps | Chart unit and browser tests |
| Power/communication potential | Separate Sun, Earth and combined regional tracks | Regional-window unit and browser tests |
| Temporal uncertainty | Whole sample bins; transitions and missing coverage unknown | Gap, transition and invalid-time regressions |
| Compare sites | Shared-period scenarios and regional clearance statistics | UI, API and browser tests |
| Compare dates | Same-site draft action and elapsed-time UTC alignment | Unit tests and explicitly synthetic browser fixtures; real API accepts separate periods |
| 3D navigation | Globe, polar terrain and three reviewed local patches | Reviewed-asset browser tests |
| Export | CSV and print without converting unknown visibility to false | Browser export tests |

## Interpretation and safeguards

- Clearance is body elevation minus the regional skyline in its azimuth direction. A positive value does not exclude obstructions beyond 20 km.
- NoData, missing azimuth bearings, unsupported interpolation brackets and missing temporal samples remain unknown. A larger-than-nominal bearing gap is not bridged.
- Endpoint-supported bins are coarse sample descriptions. Equal endpoint signs do not prove that a body stayed above/below the skyline between observations. Opposite signs do not determine an exact crossing time.
- Unknown time is not zero available time. Derived client estimates are explicitly sample-bin estimates, not backend-confirmed visibility or uptime.
- Negative clearance alone does not establish confirmed disk obstruction: validated DEM/interpolation error bounds and angular-disk margins are absent. Backend real-data visibility and global summary fields remain null/partial.
- Comparison statistics describe available finite samples, not a best-site ranking or continuous-time average. Different cadence or incomplete coverage limits comparability.
- Graphics, fill lighting, symbolic celestial sizes and rendered shadows do not establish visibility.
- The standalone Moon-fixed ephemeris endpoint can return `EPHEMERIS_UNAVAILABLE`; observer directions remain available through Analyze. Reviewed map metadata requires launcher-approved assets; its default unavailable state must not be bypassed.

## Acceptance evidence

Local validation on 15 November 2026:

- Frontend production/TypeScript build passed; **161 unit/integration tests** and **6 contract tests** passed (contract tests are also included in the full test suite).
- Stable .NET SDK **10.0.113**: restore and Release build passed. Backend offline run: **201 passed, 5 opt-in skipped**. With real DEM/mesh/live opt-ins: **206 passed, no skips**. Actual HTTP payload schema validation passed.
- Browser acceptance: **33 passed**, including reviewed assets and live local-API analysis/comparison/export. Upstream NASA responses may be cached; this is not proof that every browser request fetched fresh NASA data.
- New date-comparison browser cases explicitly intercept synthetic responses. They test UI behavior and uncertainty, not scientific accuracy. Desktop/mobile screenshots were visually reviewed; no horizontal clipping was observed. Mobile labels remain compact and comparison panels require scrolling.
- Repository tracked-file guard and whitespace checks passed. Python overview regression execution exceeded local bounded timeouts; do not interpret that as a passing full Python suite. See CI for independent job results.

The external challenge page was unavailable during this review; the acceptance checklist follows the supplied challenge requirements rather than claiming independent verification of the inaccessible page.
