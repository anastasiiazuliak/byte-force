# HUM-04 · Pitch і демонстрація

Це підготовлений сценарій, **не запис успішного public deployment/submission**. Пов’язані документи: [стан інтеграції](FINAL_INTEGRATION_REPORT.md), [фінальне тестування](FINAL_TEST_REPORT.md), [запуск](DEPLOYMENT.md), [HUM-04](../../issues/HUM-04.md).

## Pitch (20–30 секунд)

«Біля південного полюса Місяця низьке Сонце та місцевий рельєф ускладнюють оцінювання освітлення і зв’язку із Землею. Lunar Navigator поєднує місце й UTC-період в одному інтерфейсі, щоб порівнювати два сценарії посадки. Ми використовуємо React/TypeScript, Three.js/R3F, .NET 8 і NASA JPL Horizons. Зараз реальний шлях дає астрономічні samples та чесно повідомляє про відсутній перевірений terrain analysis; повні панелі окремо демонструємо лише на явно synthetic даних».

## Підготовка

1. Виконайте `npm ci --prefix frontend`, `dotnet restore backend/LunarNavigator.sln`, потім `python3 scripts/run-local.py` з кореня checkout (Linux/WSL). Відкрийте http://127.0.0.1:5173. Сервер після попередніх тестів не залишений запущеним.
2. Для першої частини `frontend/.env.local` не повинен вмикати mocks (`VITE_USE_MOCKS=false`). Перезапустіть Vite після зміни env. Перевірте позначення real, а не synthetic.
3. Перевірте доступ до NASA JPL. Live Analyze робить зовнішні мережеві запити, не потребує API key; NASA uptime/latency не гарантовані. Не запускайте довгий інтервал для короткого виступу.
4. Перевірте [FINAL_TEST_REPORT](FINAL_TEST_REPORT.md): фінальний Chromium/SwiftShader rerun **4 passed за 20.6 s, exit 0**, включно з четвертим live test **без mocks**: local API → NASA analyze 200 partial, два JPL samples, actual compare 200 для різних довгот A=25°E / B=26°E (A cached, B live), null terrain metrics. Screenshot: `.validation/real-nasa-analysis.png`. Перевірено також WebGL2/GLB, camera buttons/negative picking та synthetic graphs/Play/Pause/scrub/compare/errors. Backend truncated-DEM fix усунув 500, а Playwright SIGTERM graceful shutdown — окремий teardown timeout. Це не доказ scientific terrain visibility. Повторіть live walkthrough на машині запису.

## Безперервний walkthrough (90–180 секунд)

| Час | Дія | Що чесно сказати |
|---|---|---|
| 0–25 s | Pitch, показати сторінку й режим | Це інтегрований прототип, не flight planning certification |
| 25–45 s | Оглянути 3D terrain | GLB реально завантажується; provenance/metadata незалежно не перевірені. Pick disabled — свідомий safety gate, не клікайте mesh як географічну точку |
| 45–75 s | Ввести A: latitude `-89.5`, longitude `25`, start `2026-11-14T00:00`, end `2026-11-14T01:00`, step `60`; Analyze site | Усі дати UTC. Два samples включають start і end; visibility intervals — `[start,end)`; реальні JPL Sun/Earth airless apparent кути, не terrain visibility |
| 75–100 s | Показати partial, samples та повідомлення про metadata/ephemeris | DEM incomplete, horizon/visibility/summaries можуть бути unknown; unknown не означає нуль. Не обіцяти повний horizon chart у real mode |
| 100–125 s | Показати timeline/scrub на отриманих samples | Час перемикає результати; художнє світло не є перевіреною анімацією Сонця/Землі, Moon-fixed provider 503 |
| 125–155 s | Compare: Copy A to B, змінити Longitude B на `26`, Compare scenarios | Перевірено дві різні довготи: HTTP 200, відмінні JPL азимути, terrain metrics null. Додаткові періоди/місця залежать від upstream; він може відповісти error. Пояснити B − A; не називати unknown difference перевагою одного місця |
| 155–180 s | Limitations + наступний крок | Потрібні повний LOLA, frame/datum review, реальні LROC assets, production validation. Залишити джерела й репозиторій на екрані |

Це координати для відтворення workflow, **не рекомендовані місця посадки і не scientific baseline**. Для другого виду compare скопіюйте A до B та змініть лише UTC-період; не заявляйте, що обидва live compare випадки пройшли, без записаного evidence. При NASA failure покажіть error/retry і поясніть, що система не підміняє результат моками.

## Окрема повнопанельна демонстрація: SYNTHETIC / DEMO

Покажіть її окремим розділом або окремим записом, не прихованим продовженням real mode:

1. Зупиніть launcher. У `frontend/.env.local` увімкніть `VITE_USE_MOCKS=true`, перезапустіть його.
2. Перед першою дією явно покажіть **SYNTHETIC / DEMO** й скажіть: «Наступні графіки, horizon, visibility, summaries та differences — синтетичні UI fixtures, не вимірювання NASA».
3. Уведіть ті самі A/B, натисніть Analyze/Compare; покажіть full panels, Play/Pause, scrub і знак B − A. Це ілюструє майбутній повний workflow, не реальну terrain blockage подію.
4. Не приписуйте demo Moon-fixed синхронізацію: raw vectors до сцени не застосовано, освітлення художнє. Не приховуйте unavailable статус.
5. Після демонстрації поверніть `VITE_USE_MOCKS=false` і перезапустіть Vite. Production build не активує dev mocks.

## Джерела, кредити й обмеження на слайді

- [NASA Space Apps challenge](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/): люди перевіряють актуальні правила/дедлайн, не вважають це підтвердженням прийнятої заявки.
- [NASA JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [наш guide](../horizons.md): реальна астрономія центрів тіл; не локальний рельєфний горизонт.
- NASA LRO/LOLA/PGDA: заплановане terrain джерело; офіційний DEM download incomplete (7340032 із 189158392 bytes), немає science verification. Поточний адаптер завжди повертає `DatumAlignmentVerified=false`, навіть після повного download; це не налаштування/env switch, потрібен майбутній reviewed adapter.
- LROC: джерело запланованої imagery, **текстури не підготовлено**. MIME WebP не доводить наявність asset.
- UI: **Khrystyna**, authored source `a75d443`, вибірково збережений shell/design без `demoSlots` у головному застосунку. Попередній Horizons внесок і HUM-02 acquisition contribution збережені; [командні ролі](../../TEAM_ASSIGNMENTS.md), [README credits](../../README.md#авторство-дані-та-ліцензування), [data sources/caveat](../DATA_SOURCES.md#audit-caveat).
- Код [MIT](../../LICENSE), © 2026 anastasiiazuliak; умови datasets/imagery та сторонніх assets перевіряються окремо. Не заявляти NASA endorsement або independently reviewed GLB provenance.

## Людський checklist перед поданням

- [x] Підготовлено pitch, сценарій, джерела й явне розділення real/partial та synthetic.
- [ ] Звірити фінальні tests і виконати live walkthrough на машині запису.
- [ ] Перевірити авторські кредити всіх учасників, ліцензії конкретних datasets/mesh/imagery та вимоги submission.
- [ ] Отримати дозвіл на hosting; побудувати/перевірити production, HTTPS і доступ з іншого пристрою/мережі. Наразі публічного перевіреного URL немає.
- [ ] Записати екран із правдивими mode labels, UTC subtitles і limitations; не видавати локальний/synthetic запис за deployed real science demo.
- [ ] Додати repository URL, дозволений demo URL і перевірені матеріали. Repository reference: `https://github.com/anastasiiazuliak/byte-force` (зовнішній доступ команда перевіряє окремо).
- [ ] Людина перевіряє права, актуальні правила/дедлайн, заповнює та надсилає заявку, підтверджує receipt. Жодної submission/deployment дії тут не виконано.
