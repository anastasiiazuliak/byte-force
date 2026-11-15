# Release test report — 2026-11-15

Current evidence for `.audit/final-integration` / PR15. This supersedes the historical `FINAL_*` reports, not their attribution or incident history. Local passing checks do **not** establish a pushed release SHA, passing GitHub CI, merge, deployment, or submission. **Final Git push/SHA and post-push CI confirmation remain pending.**

## Runtime and test results

| Check | Recorded result | Evidence and limits |
|---|---|---|
| .NET | SDK **10.0.113**, API runtime **10.0.13**; all **9 projects target `net10.0`** | Project targets inspected; `.validation/net10-runtime.json`; SDK also recorded in smoke log. Do not confuse package versions with actual runtime. |
| Full opt-in backend | **203 passed, 0 failed, 0 skipped** | [final-backend-live.log](../../.validation/final-backend-live.log): Models 5 + Horizons 19 + Core 91 + API 88. Includes opt-in live Horizons and real DEM/regional API checks; not 203 independent NASA calls. Supersedes 202 passed / 1 skipped. |
| Frontend after selective teammate export port | **74 tests passed in 12 files** | `.validation/final-unit.log` and `.validation/final-build.log`; includes serializer/actions tests. Production build passed; deferred Three.js chunk warning remains. |
| Frontend contracts | **6 passed**, subset of frontend suite | Do not add to the 74. Contract fixtures/types are not live NASA science. |
| Backend HTTP/OpenAPI schema | **12 passed** | Actual middleware/controller response shapes with synthetic scientific test providers; not 12 live NASA responses and not an extra full backend suite. |
| Python | **13 acquisition + 4 runtime + 7 guard = 24 cases** | Offline validation/regression checks; not 24 downloads or live NASA tests. |
| Combined browser matrix | **13 passed (56.4 s)** | [final-browser-export.log](../../.validation/final-browser-export.log), including live CSV download/content and print-dialog/media assertions. Breakdown below. |
| Launcher smoke | **PASS** | [final-smoke.log](../../.validation/final-smoke.log): SDK/proof verification, HTTP readiness, direct/proxied GLB MIME/signature, process shutdown. Explicitly not a browser/science test. |
| Docker Compose configuration | **PASS** | Configuration validation only. Docker daemon access **permission denied**; image build, container runtime and deployment remain unverified. |

Local `.validation/` evidence is ignored and not published to Git. Default CI-mode backend tests also passed: **198 passed, 5 explicitly skipped** (real DEM/mesh/live opt-ins), `.validation/final-backend-offline.log`. Python security regressions additionally verify oversized/zero tile dimensions and oversized compressed payloads fail before decompression.

## Browser evidence: intercepted versus live

The 13-case log contains:

- **4 application cases**: one real local API/static GLB/WebGL startup; one **intercepted synthetic** analysis/compare/timeline case; one **intercepted** network/NASA-error case; one **live browser → API → NASA** partial analysis/compare case. This case also downloads and reads the actual comparison CSV, checks provenance/unknowns, and opens/closes the printable report under print media.
- **2 reviewed-asset cases**: actual reviewed mesh picking/A/B markers/patch replacement; **live reviewed DEM regional profile and Horizons cached local sunlight**. Geometry interaction is not itself a live NASA request.
- **3 startup/control UX cases** at 390×844, 768×1024 and 1440×1000, without scientific-response interception; these do not submit scientific analysis.
- **4 post-analysis layout cases** at 390×844, 768×1024, 1024×768 and 1440×1000 using **intercepted synthetic scientific responses**, not live NASA/DEM analysis. They check chart sizing, warnings disclosure, scroll/overflow and cached UTC selection.

Thus **6 cases use intercepted responses**, **2 exercise live scientific NASA paths**, and **5 cover local startup/geometry/controls**. Do not describe all 13 as live scientific tests.

### Export status

CSV download and printable report actions are available after Analyze/Compare; see [export format](../EXPORT_FORMAT.md). The 74-test frontend result follows the selective export port. The final 13-case rerun **passed the live CSV download/content and print-dialog/media assertions**. A print-dialog/media check is not evidence of an actual saved PDF or physical print.

## Reproduction entry points (not additional passed runs)

From the final worktree: `npm test --prefix frontend`, `npm run test:contracts --prefix frontend`, `dotnet test backend/LunarNavigator.sln -c Release`, and `python3 scripts/run-local.py --smoke --timeout 120`. Backend live tests need their explicit opt-in configuration and actual assets/network; plain `dotnet test` alone must not be represented as reproducing 203/0. Browser live/reviewed paths require `LUNAR_RUN_LIVE_E2E=1` and `LUNAR_REVIEWED_E2E=1` plus proof-published assets before `npm run test:e2e --prefix frontend`.

## Remaining gates and scientific limits

- **Pending:** final SHA/push and GitHub CI confirmation. PR15 is intentionally left open; merge/release/submission are separate human actions.
- **Unverified:** Docker image build/runtime (daemon permissions), public deployment, video/public URL, licensing/rules sign-off and human submission receipt.
- Regional horizon/clearance is an estimate. Visibility and global summaries remain `null`/Unknown, `status=partial`, `quality.terrainApplied=false`. Graphical lighting does not prove visibility, power, thermal or radio-link performance.
- Resource source URLs, sizes and local/runtime paths remain in [release readiness](RELEASE_READINESS.md#ресурси); scientific provenance remains in [terrain science review](../science/TERRAIN_SCIENCE_REVIEW.md).

## Integration provenance

The new UI branch range **`a75d443..8394de2`** introduces a parallel `MissionApp` and shared interfaces. It was **not merged wholesale**: the existing integrated application shell and shared contracts were retained. **P2-02** export serializer, actions, tests and documentation were selectively ported, preserving teammate attribution (Khrystyna / UI source), rather than attributing their implementation to the integrator. See [branch audit](FINAL_BRANCH_AUDIT.md) for historical branch evidence and the current addendum.
