# Start all five lanes — after the architecture PR merge

**Current repository:** `git@github.com:anastasiiazuliak/byte-force.git`.
The architecture work is being reconciled on `feature/bootstrap-architecture`.
**Do not start lane implementation from that unmerged branch or from the unrelated
historical bootstrap `57f0aee`.** First merge the architecture PR into `main` after
review/CI. The coordinator then records one full `origin/main` SHA; all five lanes
start from that same SHA in independent clones. No fixed future SHA is invented here.

Follow the [team Git workflow](docs/integration/team-workflow.md) for clone, branch,
review and update commands. Do not recreate the repository, rerun an old bootstrap,
or overwrite existing lane branches. GitHub permissions and publication require a human.

## Five independent lanes

| Lane / branch | Current instructions | Full task prompt | Owned implementation |
|---|---|---|---|
| 1 · `feature/lane-1` | [3D](docs/agents/PERSON-01.md) | [Prompt 1](prompts/PERSON-01-PASTE-INTO-CODEX.md) | explorer scene, `docs/3d/` |
| 2 · `feature/lane-2` | [UI](docs/agents/PERSON-02.md) | [Prompt 2](prompts/PERSON-02-PASTE-INTO-CODEX.md) | UI features, components/styles/app |
| 3 · `feature/lane-3` | [API](docs/agents/PERSON-03.md) | [Prompt 3](prompts/PERSON-03-PASTE-INTO-CODEX.md) | API and non-terrain Core |
| 4 · `feature/lane-4` | [Data](docs/agents/PERSON-04.md) | [Prompt 4](prompts/PERSON-04-PASTE-INTO-CODEX.md) | pipelines, Terrain/Horizon, assets |
| 5 · `feature/lane-5` | [Integration](docs/agents/PERSON-05.md) | [Prompt 5](prompts/PERSON-05-PASTE-INTO-CODEX.md) | API client/mocks, CI, infra, integration tests |

After that shared-base gate, **all five start without waiting for another lane**.
Historical task dependencies describe final integration, not permission to start.
Use typed adapters and explicitly synthetic fixtures in your own zone while adjacent
implementations are absent. P0 first; do not create 37 agents editing one checkout.

## Preserve existing contributions

- Horizons already exists in `backend/ByteForce.Horizons/`, with offline tests and a
  live opt-in sample; see [Horizons](docs/horizons.md). Reuse it, do not rewrite it from a task prompt.
- **HUM-02 already merged in PR #4**, commit `c960326`, merge `92de0e8`. Existing
  `data/scripts/` and `data/README.md` stay at their legacy paths. Do not redo the PR
  or treat its merge as proof that source/checksum/CRS validation passed.
  Read the [data caveat](docs/DATA_SOURCES.md#audit-caveat) and [existing-code audit](docs/architecture/EXISTING_CODE_AUDIT.md).
- Frozen [contract](PARALLEL_CONTRACT.md), [OpenAPI](contracts/openapi.yaml),
  [DTO](contracts/api-types.ts), [scene transform](contracts/scene/TRANSFORM.md)
  already exist. Do not create independent copies or silently change them.
- [Tasks JSON](tasks.json), [issue metadata CSV](issues.csv), [issues](issues/),
  [people](people/) and [combined backlog](docs/Lunar_Navigator_TASK_BACKLOG.md)
  preserve the original assignments. They are a backlog, not a completion report.

## Completion still needs integration

Final provider/app wiring, verified DEM metadata and control points, real Horizons/LOLA
analysis, E2E, hosting, secrets, license review and NASA submission remain explicit
follow-up work. Synthetic geometry, illustrative lighting and mocked success do not
prove scientific visibility. `visible:null` stays unknown; comparisons use B−A.

Historical pack material and retired-script provenance: [archive](docs/archive/package-reconciliation.md).
