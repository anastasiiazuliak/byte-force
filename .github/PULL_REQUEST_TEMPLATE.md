## Результат і задачі

- Lane / гілка `feature/lane-N`:
- Architecture PR merged та спільний погоджений повний `origin/main` SHA (для lane PR):
- Пов’язані готові Issue / task ID:
- Що зроблено (bootstrap / demo / реальна реалізація):
- Що залишається integration pending:

## Межі змін

- Власні змінені файли / каталоги:
- Погоджені винятки ownership і reviewer-власник:
- [ ] Чужі модулі не перезаписано; зміни вкладаються в ownership lane.
- [ ] Frozen `contracts/` не змінено; за потреби додано посилання на contract-change-request.
- [ ] Сумісні aliases `health/config/landingSites/mapMetadata` збережені; convenience API та signal не змінюють frozen інтерфейс (або не стосується PR).

## Дані й безпека

- Режим: real / dev mocks (`VITE_USE_MOCKS=true`) / не стосується:
- [ ] Synthetic/DEMO явно позначено; production mocks вимкнено.
- [ ] `visible:null`, partial, `terrainApplied=false` не перетворено на перевірену доступність чи нульові summaries.
- [ ] Графічні тіні не видаються за наукові обчислення; CRS/datum не вигадані.
- [ ] Немає secrets або великих DEM/GLB у Git.
- [ ] Існуючі Horizons scientific `.cs` / 24 offline cases та HUM-02 PR #4 не переписано під виглядом bootstrap; source preservation перевірено або зміни явно погоджені.
- [ ] HUM-02 audit caveats не названо виправленими без фактичних integrity/provenance перевірок.

## Валідація — тільки фактичні результати

Для кожної команди вкажіть каталог, результат і короткий лог/посилання. Якщо не запускали — напишіть причину, не позначайте passed.

| Каталог | Команда / перевірка | Фактичний результат або «не запускалось» |
|---|---|---|
| `frontend` | `npm run build` | |
| `frontend` | `npm test` | |
| `frontend` | `npm run test:contracts` | |
| `backend` | `dotnet restore LunarNavigator.sln` | |
| `backend` | `dotnet build LunarNavigator.sln --configuration Release --no-restore` | |
| `backend` | `dotnet test LunarNavigator.sln --configuration Release --no-build` | |
| власна зона | targeted tests / manual checks | |

Скриншоти, пристрої/браузери, perf-виміри (якщо стосується):

## Передача та review

- Інтеграційні експорти / props / providers / manifest і кроки wiring:
- Ризики, обмеження, людські дії (`HUM-*`), deploy/science pending:
- [ ] Гілку оновлено через `git fetch origin` + `git merge origin/main`; конфлікти погоджено з власниками, force push не застосовано.
- [ ] Запрошено щонайменше одного незалежного reviewer.
- [ ] Перед merge перевірити required CI `frontend`, `backend` та `repository` (назви звірено з фактичним workflow) і branch protection; цей checklist не замінює GitHub checks.

Не називайте локальний bootstrap завершеним застосунком. Остаточна інтеграційна та наукова валідація потребує окремих фактичних результатів після merge.
