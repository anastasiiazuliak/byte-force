# Final test report — 2026-11-15

Виконано в `.audit/final-integration`, branch `feature/final-integration`, початкова командна база `dbdb5be80f86b7cbf03adf4d5c0ce6eb9238de50`. Це не тест старого локального bootstrap. Усі наведені passed отримані фактичним запуском, а не тільки оглядом конфігурацій.

## Підсумок

| Перевірка | Результат |
|---|---|
| Frontend `npm ci`, production `npm run build` | PASS; Three/R3F bundle-size warning >500 kB залишається, це не вимірювання FPS |
| `npm test` | **45 passed**, 8 files |
| `npm run test:contracts` | **6 passed**, повторний subset; OpenAPI 3.1, DTO assignability із documented exceptions, усі JSON fixture parse, mock/schema shapes |
| `npm audit` | **0 vulnerabilities** |
| .NET restore, Release build | PASS, **0 warnings/errors** |
| Offline `dotnet test ... -c Release` | **162 passed, 1 explicitly skipped live test, 0 failed** |
| Backend exported HTTP/OpenAPI payloads | **12/12 passed**; actual ASP.NET middleware/controller pipeline із synthetic scientific test providers, НЕ 12 live NASA results |
| Backend schema-validator `npm ci` / audit | PASS, 0 vulnerabilities після сумісного patch-level dependency refresh |
| `python3 scripts/test_repository_guard.py` | **7 passed**: 1 reviewed-fixture positive, 6 rejection cases |
| Repository guard, Python AST, shell syntax, `git diff --check` | PASS; фінально повторюється після staging |
| `docker compose config --quiet` | PASS; daemon access denied, image build/runtime НЕ пройдено |
| `scripts/run-local.py --smoke --timeout 120` | PASS, frontend/API/static startup, direct/proxied GLB MIME/signature, чисте завершення |
| Offline Playwright без live flag | **3 passed, 1 explicitly skipped live case**, exit 0 |
| Live .NET Horizons opt-in | **1 passed**, два реальні UTC моменти з finite Sun/Earth angles і UTC timestamps |
| Playwright Chromium/SwiftShader, з live opt-in | **4 passed, exit 0**, фінальний rerun 20.6 s |

## Відтворення

З кореня checkout:

```sh
npm ci --prefix frontend
npm run build --prefix frontend
npm test --prefix frontend
npm run test:contracts --prefix frontend
dotnet restore backend/LunarNavigator.sln
dotnet build backend/LunarNavigator.sln -c Release --no-restore
dotnet test backend/LunarNavigator.sln -c Release --no-build
npm ci --prefix backend/tests/LunarNavigator.Api.Tests/Contracts
npm --prefix backend/tests/LunarNavigator.Api.Tests/Contracts test -- ../bin/Release/net8.0/ContractResponses
python3 scripts/test_repository_guard.py
python3 scripts/check-repository.py
```

Браузер (Linux/WSL, окрема інсталяція Chromium і OS libraries):

```sh
cd frontend
npx playwright install chromium
npm run test:e2e
# explicit external NASA calls, не offline CI:
LUNAR_RUN_LIVE_E2E=1 npm run test:e2e
```

Playwright запускає справжні API/Vite/static services, відмовляється від зайнятих портів і завершує їх через SIGTERM/finally. Без opt-in offline CI виконує 3 browser cases; live case явно skipped, не підмінюється fixture. CI додає browser dependencies через `playwright install --with-deps chromium`.

Окремий live .NET test:

```sh
LUNAR_RUN_LIVE_HORIZONS=1 dotnet test backend/tests/LunarNavigator.Api.Tests/LunarNavigator.Api.Tests.csproj -c Release --filter FullyQualifiedName~LiveHorizonsTests
```

## Що реально перевірено в браузері

1. Справжній localhost API health через Vite proxy; contributed `.glb` повертає `model/gltf-binary`, header `glTF`; WebGL2 canvas видимий, GLB loading завершений, немає page errors. Camera Top-Down/Reset працюють; клік неперевіреної геометрії не заповнює географічні поля. SwiftShader — software renderer, не доказ mobile/GPU performance.
2. **Явно synthetic route fixtures:** Analyze → partial/null UI → altitude graph → UTC scrub → Play/Pause без нового analyze request → Compare з двома panels і B−A unknown differences. Synthetic provenance видно в UI; ці fixtures не видаються за NASA.
3. **Injected failures:** network abort і NASA-style 503 показуються як error, без synthetic success fallback.
4. **Без interception/mocks:** browser form `latitude=-89.5, longitude=25`, UTC `2026-11-14T00:00..01:00`, step 60 → actual API → JPL Horizons → HTTP 200 partial із двома real samples. Scrub змінює selected UTC. B має longitude=26; actual compare HTTP 200, JPL азимути різних місць відрізняються. Terrain metrics/visibility залишаються null. Це реальний частковий сценарій, НЕ завершене terrain-aware scientific comparison.

Screenshots (ignored, локальні): `.validation/lunar-browser.png`, `.validation/real-nasa-analysis.png`. Desktop viewport 1440×1000; mobile, hardware GPU, frame-time, memory budget та WebGL-loss recovery не сертифіковано.

## Unit/integration coverage

Frontend: DTO/client aliases/base URL/AbortSignal, typed HTTP/network/decode errors і empty success response, production mock isolation, stable cache key; strict coordinates/UTC/limits, stale/cancel identity guard; partial/null presentation, compare, interval boundaries, cached timeline; projection/metadata/tiles/lighting helpers і UI composition.

Backend: endpoints/validation/catalog, Horizons parser/UTC/cache/retry/cancellation, unavailable Moon-fixed 503, analysis/intervals/compare, terrain/horizon adapters, profile NoData/clipped-ray rejection, invalid/truncated TIFF bounds/reads/decompression, absent DEM partial behavior, map review gate, internal error no-path/no-exception leakage. Додаткові legacy terrain tests тепер включені в активний Core tests project.

Contract changes не зроблено. Відомі v2 discrepancies в [contract-audit](contract-audit.md) залишаються відкритими. `map-metadata-real` schema validation — shape test, не підтвердження наукової якості contributor metadata.

## Знайдені й усунені збої

- Main містив conflict markers у TerrainFactory та API README; прибрано з узгодженим env/path resolution.
- Horizon provider залишався unavailable навіть за наявності реалізації; DI wiring і safety checks додано.
- Перший live browser analyze повернув **500**: truncated DEM мав читабельний TIFF header, але не всі compressed tiles. Short read передавав unread pooled-buffer bytes у ZLibStream. Виправлено file-range/complete-read/decompression checks і unavailable fallback; регресійні tests та real browser rerun пройшли.
- Перші 3 browser cases passed, але процес test runner timeout через незавершений launcher teardown/відкритий stdout children. Playwright `gracefulShutdown: SIGTERM` з finally cleanup усунув зависання; фінальні запуски завершились exit 0.
- Попереднє CI fetch-depth fix не було в main: перенесено, перевірки не вимкнено.
- Guard не допускав уже змерджений synthetic TIFF fixture: додано лише exact-path + SHA256 allowance для існуючих 100044 bytes. Змінений fixture, довільний DEM, .env, token-pattern, generated artifact і oversized file відхиляються.

## Не пройдено / blockers

- NASA regional DEM HEAD підтвердив 189158392 bytes, але download timeout залишив 7340032 bytes. Independent validator **очікувано FAIL**; це не замасковано як passed data readiness. Local SHA256 — не publisher checksum. Real DEM/terrain accuracy не перевірено.
- Datum/frame alignment не reviewed; production adapter завжди `DatumAlignmentVerified=false`. Повний download сам собою не дозволить verified visibility.
- Metadata endpoint консервативно 503 без review; geographic picking blocked. Tracked GLB provenance не independently reviewed. Реальні LROC/WebP textures відсутні.
- Moon-fixed ephemeris 503; shared time drives UI samples/cursor, але verified Sun/Earth 3D direction/lighting animation не підключена. Art light fixed і не є science.
- Docker daemon permission denied: config PASS не означає Docker build/runtime або production deployment.
- Авторизований GitHub CLI підтверджено через наявний keyring; inspected historical main CI failures відповідають виправленим conflict markers / synthetic-fixture policy. Поточний integration CI status перевіряється після push і наведений у фінальному handoff, не виводиться з локальних passed.

Локальні сервіси після тестів зупинені. Запуск користувачем: `python3 scripts/run-local.py`; адреси frontend 5173, API 5080, static 5081. Зовнішній hosting/HTTPS, recording, license review та NASA submission не виконувались.

## Remote CI evidence та review handoff

Авторизований `gh pr checks 15 --watch` підтвердив **8 successful, 0 failing/pending** для commit `5a6673a4d1864d534b358c29b5e142122e679d23`:

- [push run 43653378211](https://github.com/anastasiiazuliak/byte-force/actions/runs/43653378211): frontend, backend, repository, e2e — success.
- [pull_request run 43653382231](https://github.com/anastasiiazuliak/byte-force/actions/runs/43653382231): ті самі чотири jobs — success.

Це реально отриманий GitHub status, не висновок із local build. Remote E2E offline: live NASA case explicit skipped; локальний opt-in live pass задокументований окремо. Подальші documentation-only commits можуть мати нові run IDs; їхній status наведено у фінальному handoff.

**PR #15:** https://github.com/anastasiiazuliak/byte-force/pull/15 — `feature/final-integration → main`. PR створено, не змерджено; source UI PR #14 і feature-гілки не видаляли/не закривали. Реальна production/scientific readiness все ще має зазначені вище blockers.
