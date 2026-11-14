# START ALL FIVE AGENTS IMMEDIATELY — Lunar Navigator v2

**Виправлення до старого пакета.** Раніше `ARC-01 → ARC-02 → ...` помилково ставилися як блокери для старту всіх Codex. У v2 `contracts/openapi.yaml`, `contracts/api-types.ts` і правила 3D/координат **уже містяться у пакеті**, а робочий scaffold можна створити **без допомоги іншої людини**. Кожен агент отримує промт свого lane і незалежну гілку. Попередні `Залежності` в Issues — позначки **для фінального з'єднання**, а не сигнал чекати.

## 5 одночасних запусків

| Агент | Вставити в Codex | Пише лише до |
|---|---|---|
| №1 — 3D | `prompts/PERSON-01-PASTE-INTO-CODEX.md` | `frontend/src/features/explorer/` |
| №2 — UI | `prompts/PERSON-02-PASTE-INTO-CODEX.md` | UI feature dirs, `frontend/src/app/`, `frontend/src/styles/` |
| №3 — API | `prompts/PERSON-03-PASTE-INTO-CODEX.md` | .NET API and non-terrain Core |
| №4 — Data | `prompts/PERSON-04-PASTE-INTO-CODEX.md` | pipeline, Terrain/Horizon Core, assets |
| №5 — Integration | `prompts/PERSON-05-PASTE-INTO-CODEX.md` | frontend API/integration, CI, infra, QA harness |

**Кожен prompt включає повні детальні таски.** Не потрібно самому вибирати 37 файлів. Запускайте **5 агентів/робочих гілок**, а не 37 агентів в одній директорії: 37 одночасних записів у ті самі компоненти створять конфлікти.

## Один підготовчий крок без очікування людини №5

1. **Будь-хто з правом доступу до GitHub** (людська задача): створіть порожній репозиторій, викладіть в нього вміст `starter-repo/` + `contracts/` + `TEAM_SPEC.md` + `PARALLEL_CONTRACT.md`, зробіть ОДИН початковий коміт `chore: freeze parallel-start contracts`.
2. Або **навіть без GitHub**: розпакуйте `starter-repo/`, доповніть контрактами, локально `git init && git add . && git commit -m 'chore: bootstrap parallel work'`. Це можна зробити в одну команду через `scripts/bootstrap.sh` у цьому архіві. Так не потрібно чекати ні №5, ні доступу до віддаленого репозиторію.
3. П'ять учасників роблять окремі worktree/branches від однакового commit (готові команди в `scripts/start-worktrees.sh`) або окремі Git clones.
4. Кожен передає **свій один prompt** у Codex із доступом до відповідної гілки. Моки дозволяють повну локальну розробку без реального NASA DEM / Horizons / іншого lane.
5. Лише **після незалежних результатів**: code review, merge по одному lane, короткий integration wiring, E2E, наукові перевірки, деплой. Це реальна фізична залежність і її не можна прибрати одним промтом.

## Що не чекатиме, а що чекатиме

- **Можна одразу:** frontend сцена на DEM-test mesh, UI на JSON fixtures, backend на mock terrain provider, data pipeline на маленькому synthetic GeoTIFF, CI/tests на mocks.
- **Не можна чесно фіналізувати до merge/даних:** реальна видимість за LOLA, строго перевірене raycast→lat/lon, продакшн тіні з астрономічним світлом, справжній end-to-end аналіз, деплой з ключами, NASA submission.
- **Людська робота:** `HUM-01` GitHub permissions; `HUM-02` downloads + license/source verification; `HUM-03` hosting/secrets; `HUM-04` demo, credits, actual submission.

## Явно не робити

- Не створювати 5 варіантів DTO. Не переписувати `openapi.yaml` без team review.
- Не створювати незалежно 5 entrypoints (`App.tsx`, `Program.cs`) і не merge-ити конфлікти силою.
- Не видавати synthetic scientific fixtures за NASA.
- Не називати `moon_fixed` три числами без перевіреної системи відліку. Не підставляти земні геодезичні проєкції до місячного DEM.
- Не залишати інтегратора без роботи: в першій хвилі він робить інфраструктуру/моки/контрактні тести, наприкінці з'єднує всі реалізації.
