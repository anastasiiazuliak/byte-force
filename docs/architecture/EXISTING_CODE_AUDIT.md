# Existing code audit — Lunar Navigator

Дата: 2026-11-14. Початковий read-only аудит завершено до змін реалізації. Робоча гілка `feature/bootstrap-architecture`, база `92de0e85620df512fdd7ce199126ed6c5d5b43ca`. Локальний bootstrap `57f0aee296ac73bb65932c603a5ce6ec5ee8fec9` лише прочитано; його working tree не змінюється. Історії не merge-яться: переносимо лише перевірені відсутні компоненти.

## 1. Гілки та вже змерджена робота

| Ref | SHA | Комітів main-only / branch-only | Висновок |
|---|---|---|---|
| origin/main | 92de0e85620df512fdd7ce199126ed6c5d5b43ca | — | Початкова база |
| origin/docs | bcba2a34862ac54448e90751cac78c7941a1e47b | 12 / 0 | Повністю ancestor main, Horizons вже тут |
| origin/feature/HUM-02-data-sources | c960326e03a5587c71dffd41e1807b78b0b4954c | 7 / 0 | Повністю ancestor main, змерджено PR #4 |

Перевірки: `git log origin/main..BRANCH`, `git rev-list --left-right --count origin/main...BRANCH`, огляд first-parent history і merge parents. Шість файлів HUM-02 не мають подальших content changes проти main. Повторний merge цих гілок не потрібний. Перед push виконується новий fetch і перевірка ancestry.

## 2. Що реально існувало на GitHub

- `src/LunarNavigator.Horizons/`: компактний IHorizonsClient/HttpClient, lunar observer, airless apparent Sun/Earth center azimuth/elevation для одного UTC instant, strict CSV-in-JSON parser, cancellation, process-local sequential request gate.
- `tests/LunarNavigator.Horizons.Tests/`: 24 offline protocol/parser/observer tests, stub HttpMessageHandler, synthetic response fixtures. Baseline build/test пройшли на SDK 10.0.113 (NuGet audit у baseline не виконано).
- `samples/Horizons.Sample/` та `docs/horizons.md`: окремий live sample і документація. Live NASA sample не запускався.
- `ByteForce.slnx`: лише три net10.0 проєкти; active Web API, React frontend, CI та runtime shared contracts відсутні.
- HUM-02: `data/README.md`, `data/scripts/download_data.py`, `.ps1`, `data/raw/.gitkeep`, `docs/DATA_SOURCES.md` і ignore rules. Зберігаємо їхню реалізацію, не повторюємо задачу.
- `docs/Lunar_Navigator_Codex_PARALLEL_v2/`: цілий planning/starter package, кілька копій тих самих контрактів і starter-проєктів; це не активний застосунок. Окремі історичні TEAM_SPEC/BACKLOG також дублюють матеріали.
- `LICENSE`: зберігається без змін.

## 3. Порівняння з локальним bootstrap

Локальний bootstrap містить відсутні production-buildable React 19/TS/Vite entrypoint, typed HTTP client і mock transport, contract tests, .NET8 API/Core/health tests, provider interfaces, CI/file guard, Git/team instructions. Він НЕ містить існуючої Horizons реалізації чи HUM-02 acquisition contribution — тому повна заміна GitHub tree bootstrap-ом втратила б корисний код.

Усі 6 contract/fixture/scene файлів в обох версіях byte-identical. PARALLEL_CONTRACT/START_ALL_5/assignments однакові; TEAM_SPEC/issues/prompts відрізняються лише нормалізацією trailing whitespace. Копіювати/винаходити інші DTO не потрібно.

## 4. Технічні та наукові findings

### Високий пріоритет

1. **.NET10 vs .NET8:** net8 app не може reference net10 library. Рішення bootstrap-етапу: перенести Horizons projects у backend, retarget project metadata до net8.0, не змінювати request/parser/science source. Увесь набір існуючих offline tests повторити під .NET8. Замінити .slnx на погоджений .NET8-compatible solution; оновити project references/sample commands.
2. **HUM-02 Python download integrity:** EOF вважається success без остаточного size/checksum validation; існуючі файли перевіряються лише довжиною. `--verify-only --download` може все-таки завантажувати. Підтверджено offline probes із mocked I/O, не real download.
3. **HUM-02 PowerShell:** verify-only path завершується 0 навіть при reported error; `curl.exe` exit code/HTTP failure не перевіряються надійно. Статичний аудит, PowerShell не запускали.
4. **Наукова готовність не доведена:** HUM-02 статус Ready for Review не підтверджує checksum, реальний raster у цьому checkout, повний gdalinfo record, конкретний LROC product, два незалежні downloads, point-specific reference sources. Approximate control heights і твердження про постійну Earth visibility не є незалежним ground truth.

Пункти 2–4 передаються власнику lane 4: не переписуємо вже змерджений HUM-02 downloader і не заявляємо його повторно виконаним.

### Середній пріоритет / межі інтеграції

- Downloader writes non-atomically; Python LUNAR_DEM_PATH трактує неіснуючий filename як directory, пріоритет env між README і scripts різниться. HEAD size/Accept-Ranges не доводять checksum/COG/CRS correctness.
- Horizons повертає local apparent airless angles, НЕ terrain visibility і НЕ Moon-fixed vectors. Позитивна elevation не означає освітлення/зв'язок. Жодного science wiring у bootstrap.
- Horizons library допускає ширший lunar domain (latitude [-90,90], longitude [-180,360]), ніж public API region [-90,-80]/[-180,180]. Це низькорівневий reusable client; API layer повинен окремо enforce frozen limits/normalization. Не звужуємо бібліотеку мовчки.
- Observer altitude — km над stated lunar sphere; API DEM height — m з verified vertical reference. Однаковий радіус не доводить frame/datum alignment. NoData не перетворюється на 0. Exact-pole azimuth convention ще потребує ARC-03.
- Library робить 2 послідовних requests/instant. Немає period orchestration, caching, retry/backoff, maxSamples або end-to-end deadline. Це майбутня робота lane 3, не реалізуємо зараз.
- Strict parser відхиляє невідомі versions/columns і різний timestamp: зберігаємо fail-closed policy. Offline fixture tests не є незалежною астрономічною валідацією.
- Parser допускає azimuth=360 як upstream boundary; frozen API вимагає <360. Нормалізація на adapter boundary — lane 3.
- UTC: library конвертує DateTimeOffset до UTC, обмежує >=1962 і millisecond input; це не обіцянка фізичної millisecond accuracy та не підтримка leap-second literal.
- HUM-02 має file:///d:/... links. Виправити лише переносимість docs links, не самі data claims; додати явне посилання на audit caveats.

## 5. Frozen contracts та scene

Наявні поля залишаються незмінними. `visible:null`, unknown summary/height, lunar coordinates без WGS84/Web Mercator. Scene x=easting−origin, y=height−verticalOrigin, z=−(northing−origin); Moon-fixed vector не можна напряму застосувати до projected scene axes. Metadata verified=false доки немає перевіреного CRS/datum/control points.

Успадковані обмеження schemas: optional AnalysisOptions fields vs required TS fields; Z в описі, але date-time допускає offsets; static assets погоджені текстом/metadata, не окремими OpenAPI paths; incomplete error statuses і semantic constraints. Докладно — `docs/integration/contract-audit.md` після переносу. Несумісних змін не робимо.

## 6. План вибіркового переносу та реорганізації

- Спочатку цей audit, потім окремий logical implementation commit; жодного unrelated-histories merge.
- Єдині активні contracts у root `contracts/`; canonical TEAM_SPEC у `docs/TEAM_SPEC.md`, PARALLEL_CONTRACT у root; issues/people/prompts/tasks перенести з audited team package без зміни задач.
- Redundant starter/contracts/docs видалити лише після reconciliation: історія Git зберігає походження. Корисні package metadata/publisher залишити з актуальними paths; старі bootstrap/worktree scripts не запускати проти командного repo.
- Взяти тільки відсутній frontend/API/Core/CI/integration/docs scaffold із локального bootstrap. Не переносити .git, bin/obj/node_modules/dist, raw NASA assets або root bootstrap history.
- Зберегти всі Horizons .cs/test fixture sources, HUM-02 scripts і LICENSE. Retarget/moves/project references — infrastructure-only; API/Horizons wiring і real terrain analysis pending.
- `data/` залишити backward-compatible acquisition workspace; `data-pipeline/` — зона наступних offline terrain tasks, не друга копія HUM-02.
- Readiness: усі lane мають frozen interfaces, mock client, готові prompts, provider signatures і compile-ready projects без очікування нових модулів.

## 7. Межі перевірок

Не запускали live NASA, багатогігабайтні downloads, GDAL, PowerShell або scientific accuracy checks. Дані й external claims не верифіковано мережею. Baseline .NET10 24 tests пройшли; baseline React/API відсутні. Фінальні результати перенесеної .NET8 основи, frontend, контрактів та HTTP smoke будуть у `docs/integration/bootstrap-validation.md`. GitHub workflow YAML не дорівнює успішному GitHub run.
