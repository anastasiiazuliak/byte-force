# FEUI-04 — Створити Mission Timeline зі scrub, Play/Pause та синхронізацією часу

> **PARALLEL START v2 — ДЛЯ CODEX:** цей task можна почати прямо зараз, у власній гілці/worktree. Поле «Залежності» нижче — це **залежності для повної інтеграції**, а не привід чекати іншого учасника. Заморожені контракти вже лежать у `contracts/openapi.yaml`, `contracts/api-types.ts`, `contracts/scene/*`, а демонстраційні fixtures — у `contracts/fixtures/`. Якщо потрібного модуля ще немає, реалізуй власний адаптер/інтерфейс і тестовий stub у **своїй зоні**, але не створюй вигадані NASA-вимірювання у production. Звільнені від очікування роботи запускай відразу. Твоя зона: `frontend/src/features/{scenario-form,analysis,timeline,compare,methodology,export}/, frontend/src/components/, frontend/src/styles/, frontend/src/app/`. Не чіпай чужу зону; потребу спільної зміни запиши як proposal у своєму docs. Людські задачі, що вимагають облікового запису/секретів/подання, готуй як інструкцію і не виконуй без дозволу.

**Основний відповідальний:** Людина №2 — UI Frontend
**Співпраця/review:** залучайте інших учасників для shared контрактів; власник PR — №2
**Пріоритет:** P0
**Залежності:** FEUI-03, ARC-02
**Область файлів:** `frontend/src/features/timeline/`

## Мета

Зробити час центральним керованим параметром візуалізації, а не кнопкою, що створює тисячі API-запитів.

## Готовий промт / покрокова реалізація

**Контекст продукту:** NASA Space Apps 2026, Lunar Landing Site Navigator. Регіон — південний полюс Місяця, переважно 80°S–90°S. Головна мета — порівняти 2 сценарії посадки (місце + UTC період), аналізувати Сонце/Землю щодо локального рельєфного горизонту. Стек: React + TS + R3F/Three.js; .NET 8 Web API; NASA JPL Horizons; NASA LOLA GeoTIFF; LROC imagery. Повне ТЗ: `docs/TEAM_SPEC.md` (у пакеті також `TEAM_SPEC.md`), контракти: `contracts/openapi.yaml`.

**Загальні правила для Codex:** перед змінами прочитай TEAM_SPEC і чинну структуру репозиторію; працюй лише у зоні файлів цієї задачі, не переписуй суміжні модулі, не змінюй OpenAPI мовчки. Інтегруй через наявні типи/інтерфейси; відсутню реалізацію суміжного модуля закрий мок-адаптером у власній зоні й задокументуй як integration pending (не зупиняй роботу). Пиши компільований код, unit tests, update README за потреби, не додавай секретів/великих сирих DEM у Git. У production **жодних вигаданих даних NASA**. Візуальні 3D-тіні не замінюють науковий аналіз. Наприкінці повідом: що реалізовано, які файли змінено, команди тестування, що ще заблоковано. Не роби push/merge/deploy без дозволу.

**Зроби наступне:**

1. Створи один canonical selectedTime UTC state в application-level store/context, з callbacks, які можуть читати 3D Scene, HorizonView та Charts.
2. Намалюй часову шкалу sunVisible/earthVisible на основі `intervals`; різні кольори + текстові статуси, коректно враховувати `[start,end)`.
3. Реалізуй scrub slider keyboard/touch, Play/Pause, speed x1/x4/x16, jump-to-next-event; не прив’язуй Playback до реального wall-clock.
4. Для вибраного часу інтерполюй numeric `azimuthDeg` із коректним shortest-angle wrap та elevation; boolean visible не вигадуй між samples без позначення наближення/точності.
5. Синхронізуй видимі цифри, вертикальний cursor на графіку, 360° horizon та event status; FE3D підключиться до `selectedTime` без зміни цього модуля.
6. Не викликай `/analyze` або `/ephemeris` на кожному кадрі; fetch лише коли міняється location/period/step або користувач запускає analyze.
7. При новому dataset clamping time у нові межі, stop/cleanup animation frame, reduced-motion або autoplay off.
8. Тести: midnight UTC, межа endUtc, wrap 359→1, pause/resume, зміну period, відсутні intervals.

## Критерії приймання (Definition of Done)

- [ ] Playback змінює всі візуалізації через одне джерело часу.
- [ ] Запити не множаться при scrub/playback.
- [ ] Управління доступне через клавіатуру/тач.
- [ ] Тести clock/interval boundary проходять.

## Обмеження

Не реалізовувати непов’язані модулі, не змінювати чужі директорії та не додавати вигадані наукові результати.

## Формат звіту виконавця

У PR/відповіді коротко наведи: **результат**, **змінені файли**, **виконані тести/команди**, **демо (за потреби)**, **ризики/блокери**, **посилання на пов’язані task ID**.
