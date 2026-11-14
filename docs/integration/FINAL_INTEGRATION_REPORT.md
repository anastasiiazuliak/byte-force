# Фінальна інтеграція: стан, evidence та незавершений DoD

## Межі звіту

Робочий checkout `.audit/final-integration`, base **dbdb5be**; data/backend/scene вже в цій базі. Зміни підготовлено для feature/final-integration; звіт не означає merge, release або deploy. Commit і push state наведено у фінальній відповіді. Джерела: актуальні `Application.tsx`, backend DI/services, `scripts/run-local.py`, Docker/nginx конфігурація, вимоги [INT-02](../../issues/INT-02.md), [QA-01](../../issues/QA-01.md), [OPS-02](../../issues/OPS-02.md), [HUM-04](../../issues/HUM-04.md) і результати інтеграційної перевірки, передані координатором.

**Остаточні команди, counts та live rerun:** [FINAL_TEST_REPORT.md](FINAL_TEST_REPORT.md). Документ завершує координатор; цей звіт не підміняє його й не заявляє результатів ще не завершених запусків. [Branch audit](FINAL_BRANCH_AUDIT.md) ведеться окремо.

## Що інтегровано

- `Application` використовує authored AppShell з реальними slots: ScenarioFields, AnalysisPanel, ComparePanel, MissionTimeline, LunarTerrainViewer. API config/sites/metadata завантажуються незалежно; metadata failure не блокує ручне введення.
- Один typed client, real mode за замовчуванням; DEV-only opt-in synthetic transport. Analyze/compare, error/partial presentation, UTC timeline, cancel + request identity guard; редагування очищує попередні результати. Compare differences — B − A.
- Backend використовує реальний Horizons provider, terrain/horizon abstraction, altitude resolver та comparison service. Немає production synthetic-success fallback.
- `run-local.py`/`dev.sh` запускає API 5080, static 5081, frontend 5173. Виправлений Vite proxy дає direct/proxied GLB; `--smoke` пройшов і завершив процеси. Постійний сервер не залишено.
- Docker multi-stage/frontend contracts COPY, compose paths, nginx static routes та health web через API підготовлені й configuration-checked, **не build/runtime-verified**.

## Source attribution

UI source **a75d443**, автор **Khrystyna**: вибірково збережено дизайн/shell/стилі; `demoSlots` не merged у composition root. Це source attribution, не твердження про merge цілого UI branch. CI source **892f4b8**: вручну відтворено ту саму трирядкову зміну `fetch-depth: 0`. Збережено попередній Horizons внесок ([guide](../horizons.md)), HUM-02 `c960326` / merge `92de0e8`, acquisition scripts і [data caveat](../DATA_SOURCES.md#audit-caveat). Деталі інших гілок — у branch audit; авторство не переноситься на інтегратора.

## Перевірені результати та інцидент

| Рівень | Evidence / межа |
|---|---|
| Offline backend | 162 passed, 1 live skipped у переданому результаті; фінальний стан у test report |
| Live Horizons | Окремий opt-in запуск: 1 passed; не є offline CI |
| Frontend | 45 tests passed, включно з 6 contract tests; production build passed |
| Browser | Фінальний Playwright Chromium/SwiftShader rerun: **4 passed за 20.6 s, exit 0**; WebGL2 canvas, actual GLB MIME/`glTF`, camera buttons/negative picking; synthetic graphs, Play/Pause, scrub, compare, errors |
| Live browser | **Passed, без mocks**: browser → local API → NASA analyze 200 partial із двома JPL samples; actual compare 200 для різних довгот A=25°E / B=26°E (A cached, B live), terrain metrics null; screenshot `.validation/real-nasa-analysis.png` |
| Реальний API process | Після root fix HTTP 200 partial, два JPL samples; окремо підтверджено також live browser rerun |
| API contracts | 12 response payloads реального ASP.NET pipeline з offline synthetic science providers пройшли AJV |
| Security guard | Hash-pinned allowance лише для наявного 100044-byte synthetic TIFF, без загального послаблення; 7 regression tests passed (1 approved fixture, 6 rejection cases) |
| CI | Координатор додає offline Playwright job; live test explicit opt-in, skipped за замовчуванням; remote CI pass не заявляємо |
| Local launcher | Після proxy fix bounded smoke passed, чисте завершення |
| Deployment | Compose/config перевірено; Docker daemon permission denied, build/deploy не виконано |

**500 мав реальну причину:** truncated/corrupt DEM спричиняв invalid-deflate/unread-buffer failure при читанні, а не лише невдалий NASA response. Виправлення обробки DEM дозволило деградувати до чесного partial, не синтезувати terrain. Наукову придатність DEM цим не відновлено.

**Окремий teardown інцидент:** початковий E2E timeout виник після трьох passed tests, бо stdout дочірніх launcher processes залишався відкритим. Playwright `gracefulShutdown` із SIGTERM cleanup усунув зависання; фінальний rerun завершився exit 0. Це окремо від backend 500 і не є перевіркою terrain science.

## Дані й наукові gates

Офіційний URL: `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF`. HEAD 200, **189158392 bytes**. Погоджена спроба download з deadline 240 s завершилася timeout після **7340032 bytes**. `scripts/validate-data.py` відхилив incomplete файл; `.validation/dem-receipt.json` ignored. Локальний SHA — identity, не publisher checksum/науковий review. Реального DEM/data-science результату не підтверджено, real patch не генерували.

Tracked `0/0/0.glb` (~884 kB) відрендерився, але geometry provenance/metadata незалежно не перевірені. Навіть `validated` у manifest не є незалежним підтвердженням. `MetadataReviewConfirmed=false` зберігає metadata 503 та вимкнений geographic pick. Ручні координати працюють.

Повний download сам собою не знімає gate: поточний адаптер завжди повертає **`DatumAlignmentVerified=false`**. Це не configurable flag/env switch; для зміни потрібен майбутній reviewed adapter: frame/CRS/vertical datum alignment нерозв’язаний; наукову terrain visibility не можна заявляти. Реальних WebP/LROC textures немає, лише MIME configuration. Moon-fixed provider 503; raw vectors не застосовані до сцени, художнє освітлення фіксоване. Немає перевіреної Sun/Earth 3D synchronization. `visible:null`, відсутні horizon/summaries — невідомі, не нуль/false.

## DoD за задачами

Позначення: **повністю** — заявлений вузький крок підтверджено; **частково** — є wiring/evidence, але не весь результат; **mock-only** — synthetic demonstration; **не перевірено** — немає потрібного evidence.

| Задача / крок | Статус | Чому |
|---|---|---|
| INT-02: real API → UI/scene composition | Повністю для wiring | Реальні client/services та bounded startup; не scientific completion |
| INT-02: клік DEM → lat/lon → real terrain chart/horizon/summaries | Частково | Ручні координати + JPL partial; geographic pick навмисно disabled, terrain unverified |
| INT-02: нове місце/дата, cancel/stale guard | Частково | Реалізовано; обсяг фінальних tests див. test report, live matrix не засвідчено |
| INT-02: server errors без падіння UI | Частково | Browser errors пройшли; не всі upstream/network cases доведені |
| QA-01: повні A/B science E2E | Mock-only для повних панелей | Synthetic graphs/compare/timeline перевірено; live terrain A/B не доведено |
| QA-01: critical errors/partial | Частково | Є browser errors, real-process і live-browser partial; не заявляємо всю mobile/timeout/WebGL-loss матрицю |
| QA-01: розділення offline/synthetic/live | Повністю для поділу | Окремий opt-in live; фінальні результати в test report |
| QA-01: reproducible demo runbook | Повністю для документа | [DEMO](DEMO.md), не доказ staging |
| OPS-02: публічний HTTPS URL, 3D/analyze/compare | Не перевірено | Deployment не дозволено й не виконано |
| OPS-02: GLB/WebP MIME/cache | Частково | GLB localhost перевірено, WebP відсутні; production caching/compression ще потребують роботи |
| OPS-02: відтворювані інструкції | Частково | [DEPLOYMENT](DEPLOYMENT.md) є; Docker runtime blocked |
| HUM-04: сценарій, sources, limitations | Повністю для підготовки | [Pitch і walkthrough](DEMO.md) готові |
| HUM-04: recording, URL, licensing review, submission | Не перевірено | Людські кроки; не виконані автоматично |

## Наступні gates, а не приховане «готово»

1. Координатор фіксує фінальні unit/browser/live результати в test report: live browser passed, frontend 45/45; remote CI ще потребує перевірки після push.
2. Отримати повний DEM, повторити structural validation та незалежний scientific review; узгодити датум/frames і контрольні точки. Не вмикати review flags лише для розблокування UI.
3. Перевірити mesh provenance, підготувати/ліцензувати реальні textures, налаштувати перевірений vector-to-scene adapter.
4. Людина з Docker permissions будує/тестує контейнери; лише після дозволу hosting/TLS, storage, external/mobile smoke й rollback rehearsal.
5. Люди перевіряють credits/licenses, записують правдиве демо та подають матеріали за чинними правилами NASA. Без цього P0 scientific/deployment DoD не закритий.
