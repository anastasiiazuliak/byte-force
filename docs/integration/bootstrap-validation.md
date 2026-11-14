# Bootstrap validation — 2026-11-14

Це звіт про перевірений локальний scaffold, не завершений Lunar Navigator.

## Результати

- [x] Погоджена структура, README, .env.example, персональні інструкції, 5 вихідних prompts, backlog.
- [x] Frozen contracts/DTO/scene/fixtures скопійовані без змін (`diff -qr` з пакетом — порожньо).
- [x] `cd frontend && npm ci` — успішно.
- [x] `npm run build` — strict TypeScript та Vite production build успішні.
- [x] `npm test` — 12/12, включно з 5 contract tests.
- [x] `npm run test:contracts` — 5/5 (повторний цільовий запуск).
- [x] `npm audit` — 0 vulnerabilities на дату перевірки.
- [x] `cd backend && dotnet restore LunarNavigator.sln` — успішно.
- [x] `dotnet build LunarNavigator.sln --configuration Release --no-restore` — 0 warnings/errors.
- [x] `dotnet test LunarNavigator.sln --configuration Release --no-build` — 2/2.
- [x] Обмежений у часі HTTP smoke із реальними dev processes: frontend GET /, backend GET /api/v1/health, Vite proxy GET /api/v1/health — 200. Процеси зупинені після перевірки.
- [x] Shell syntax, посилання README/agent/workflow документації, staged diff whitespace checks.
- [x] Tracked-file size/env/raw DEM/key/token-pattern guard; немає виявлених збігів. Це обмежений pattern scan, не гарантія виявлення будь-якого секрету.
- [x] Mock client працює без backend; DEV opt-in перевірено, production ігнорує mock flag. Ephemeris mock чесно повертає 503.
- [ ] GitHub Actions виконано на GitHub — remote відсутній, перевірено лише відповідні локальні команди.
- [ ] Branch protection, доступи 5 учасників, required checks — ручне налаштування після публікації.
- [ ] Browser/WebGL E2E та реальна NASA наукова перевірка — не частина bootstrap, відповідні модулі ще не реалізовані.

## Task status

- **ARC-01:** локальний scaffold реалізовано й перевірено.
- **ARC-02:** аудит/validators реалізовано; відомі розбіжності задокументовано в `contract-audit.md`, не називати схеми повністю еквівалентними до погодження виправлень.
- **INT-01:** клієнт, typed errors, aliases/signals/base URL, cache key, mocks і contract tests реалізовано й перевірено.
- **OPS-01:** workflow та локальні аналоги перевірок готові; remote CI і protection pending.
- **HUM-01:** локальний Git/правила готові; GitHub remote, права й branch protection залишаються людською дією.

.NET interfaces Terrain/Horizon доступні з першого commit. API/Data не повинні чекати один одного. Shared test csproj і frontend package/entrypoint зміни після bootstrap узгоджуються з власником; не створювати нові копії.

## Перед публікацією

Виконати `git diff --check`, `git diff --cached --check`, `python3 scripts/check-repository.py`. Після початкового commit `sh scripts/create-lane-branches.sh` створює refs із одного SHA main. Не обирати GitHub owner/visibility за інших.

Власник створює порожній GitHub repository та додає його точний URL як origin, виконує `git ls-remote origin` і переконується, що remote порожній. Лише тоді `git push -u origin main` без force. Якщо remote непорожній — спочатку review історії, не перезаписувати її. Далі активувати Actions, secret scanning/push protection за доступності, branch protection main з required frontend/backend/repository checks та одним незалежним review. Всі lane стартують із погодженого початкового SHA. Див. `team-workflow.md`.
