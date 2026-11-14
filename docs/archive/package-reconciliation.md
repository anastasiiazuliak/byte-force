# Parallel v2 package reconciliation and provenance

The source package was committed at `0b0a5c6`; the pre-reconciliation audit is
[EXISTING_CODE_AUDIT](../architecture/EXISTING_CODE_AUDIT.md), committed at `d897310`.
Original files remain recoverable from that history. This page records documentation
reconciliation, not a new scientific validation or a rerun of HUM-02.

## Canonical moves (source bytes preserved)

- Package `contracts/` → root `contracts/` (all six files, including both fixtures).
- `TEAM_SPEC.md` → `docs/TEAM_SPEC.md`; duplicate `docs/Lunar_Navigator_TEAM_SPEC.md` becomes a forwarding page.
- `issues/`, `people/`, `prompts/`, `PARALLEL_CONTRACT.md`, `START_ALL_5.md`, `TEAM_ASSIGNMENTS.md` → root.
  Current-start notices and portable links are coordinated documentation updates; task IDs and task bodies remain.
- `tasks.json`, `issues.csv`, `publish_github_issues.py` → root, byte-preserved.
  CSV `body_file` paths still resolve to root `issues/*.md`; publishing is dry-run by default.
- Unique `QUICK_START.md` → this archive; package overview retained as [parallel-pack README](parallel-pack-README.md).
- Unique [combined backlog](../Lunar_Navigator_TASK_BACKLOG.md) remains intact, with a current-status notice and its existing task-ID anchors preserved.
- All HUM-02 `data/**` remains untouched. `docs/DATA_SOURCES.md` retains original claims with a review caveat and portable links.

The read-only outer bootstrap supplied the current README/agent/team/client guide basis,
not replacement science. Its six contracts match the moved package byte-for-byte;
TEAM_SPEC and 37 issues differ only in trailing whitespace; five people pages match
byte-for-byte; prompts differ only in trailing whitespace/blank lines.

## Removed nested starter and historical scripts

Every nested starter file was compared before removal. Identical contracts/specs are
redundant; nonidentical minimal scaffold files are superseded by the active architecture
scaffold, not merged over it. The old bootstrap script creates a new Git repository and
initial commit; the old worktree script creates fixed lane branches. Neither is a safe
current-team entry point. No root bootstrap scripts were copied or executed.

| Original package path | Canonical destination / replacement | Comparison / decision | Original SHA-256 |
|---|---|---|---|
| `starter-repo/PARALLEL_CONTRACT.md` | `PARALLEL_CONTRACT.md` | byte-identical | `d2036eabc2b513a053818b3169549a2eed58db43c7a328f6ca783b4719b915f5` |
| `starter-repo/README.md` | `README.md` | superseded scaffold; retained in upstream history | `dba030546e8751ef843d4cc67fc18b09662676031afad35d2bc5865015faee11` |
| `starter-repo/START_ALL_5.md` | `START_ALL_5.md` | byte-identical | `daaaeca84e6281556f14c40162df5b89ea83b519b8bbf99a544092badad7b9a3` |
| `starter-repo/backend/LunarNavigator.Api/LunarNavigator.Api.csproj` | `backend/LunarNavigator.Api/LunarNavigator.Api.csproj` | byte-identical | `0a043c66ee659bd627d3f08a30439d43078b8fca414ec3b1616559cc950ec408` |
| `starter-repo/backend/LunarNavigator.Api/Program.cs` | `backend/LunarNavigator.Api/Program.cs` | superseded scaffold; retained in upstream history | `528d27f8af29b2d36fec5f1d90efc2b5bf9d6722d9a3943616c42befb7f008df` |
| `starter-repo/backend/LunarNavigator.Core/LunarNavigator.Core.csproj` | `backend/LunarNavigator.Core/LunarNavigator.Core.csproj` | byte-identical | `353809367201f4c18664096c4fb5666e8b4a765363ff4102b242028d4730cd9c` |
| `starter-repo/backend/LunarNavigator.Tests/README.md` | `backend/LunarNavigator.Tests/README.md` | byte-identical | `d2cfa924cb0573f01890322f1fd3a6c2183898f24e05baab0ac00ef01dce6d2d` |
| `starter-repo/contracts/api-types.ts` | `contracts/api-types.ts` | byte-identical | `055412dde8a79838b6f790456e80106c2b39f3a8e1869c75369003f76060e19e` |
| `starter-repo/contracts/fixtures/analyze-partial.json` | `contracts/fixtures/analyze-partial.json` | byte-identical | `51782a45026e7cae8614d458993b5d6eb3fb5a20046b3895559cefc9dd20d91e` |
| `starter-repo/contracts/fixtures/map-metadata-unverified.json` | `contracts/fixtures/map-metadata-unverified.json` | byte-identical | `bdfa5d359ac6bac450be7687a7aadbfce71d2e372be02fbd4778b6678a2c1f3f` |
| `starter-repo/contracts/openapi.yaml` | `contracts/openapi.yaml` | byte-identical | `fcb98f29b30249aab2b1046cc29a7f9a61adddaa8bd2904187c0d202b3029221` |
| `starter-repo/contracts/scene/TRANSFORM.md` | `contracts/scene/TRANSFORM.md` | byte-identical | `76388f4802016d43b289712a6d870bd363420e9915e609b3f36c77be4dc07944` |
| `starter-repo/contracts/scene/scene-types.ts` | `contracts/scene/scene-types.ts` | byte-identical | `511d4a15a899c435a0f8fbcde1b18c00e4536b2c90ff8cee67db08c66312d20f` |
| `starter-repo/docs/TEAM_SPEC.md` | `docs/TEAM_SPEC.md` | byte-identical | `7cab2424dc574872b1bee3d3ed1ef0d367b86e19e67b7518abab5f1b29b10546` |
| `starter-repo/frontend/contracts/api-types.ts` | `contracts/api-types.ts` | byte-identical | `055412dde8a79838b6f790456e80106c2b39f3a8e1869c75369003f76060e19e` |
| `starter-repo/frontend/index.html` | `frontend/index.html` | superseded scaffold; retained in upstream history | `7a907c7d4534b756c568862867e8872e0bbf385332d5e9fd842f18fda441ed33` |
| `starter-repo/frontend/package.json` | `frontend/package.json` | superseded scaffold; retained in upstream history | `03611d4987a88857ae794df7bc2fd4cfbe4e788b7f74c1ef63bb9d8423678ab5` |
| `starter-repo/frontend/src/api/types.ts` | `frontend/src/api/types.ts` | superseded scaffold; retained in upstream history | `64c9f7177dfbdfa4eaa80ee08c228f863c6e9c36bd8951bd4b09d35df9711301` |
| `starter-repo/frontend/src/main.tsx` | `frontend/src/main.tsx` | superseded scaffold; retained in upstream history | `4b6ad96b007f49257558aef7d988f6d46128f8329fcb55ec69f87d916bc0931a` |
| `starter-repo/frontend/src/styles/index.css` | `frontend/src/styles/index.css` | superseded scaffold; retained in upstream history | `2a0cb327154d21ee5cc5265979b42af258728c3f4b010d37a5b56f5e1555c8b7` |
| `starter-repo/frontend/tsconfig.json` | `frontend/tsconfig.json` | superseded scaffold; retained in upstream history | `f848e033eb4135b82cbc014917323a290ea3b8b23e8bc21bb1fa4e5d1749bee0` |
| `starter-repo/frontend/vite.config.ts` | `frontend/vite.config.ts` | superseded scaffold; retained in upstream history | `e4261ed26f14bdd2fdae99a7c63509e1f8b7821d51549e956cf29cb3e10ae88e` |
| `starter-repo/scripts/setup-notes.md` | `scripts/setup-notes.md` | superseded scaffold; retained in upstream history | `3ded17997392896e6ead5a2437cb4c3a090d4a7d999ab8ffdf034dc89a8b8105` |
| `scripts/bootstrap.sh` | current team workflow (manual clone/branch instructions) | retired, not executed | `72b0a517fccbcd0b6a0f26d65c932438d8d1dd5a3f5e23c8f33e9da3dfe40b91` |
| `scripts/start-worktrees.sh` | current team workflow (manual clone/branch instructions) | retired, not executed | `8804331fb8e970427e8c2e0b62db4ab0a695c68051dd5194892d0ae0eabcb12c` |
