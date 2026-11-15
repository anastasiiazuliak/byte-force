# HUM-04 · поточний release demo

PR15 OPEN, локальний reviewed runtime; не public deployment/submission. [Запуск](DEPLOYMENT.md), [readiness/resources](RELEASE_READINESS.md), [остаточні результати координатора](RELEASE_TEST_REPORT.md).

## Pitch · 25 секунд

«Для південного полюса Місяця важливо порівнювати не лише місця, а й час: низьке Сонце та рельєф впливають на освітлення й можливість зв’язку. Lunar Navigator поєднує NASA JPL Horizons, повний LOLA DEM та три дослідницькі 3D-ділянки. Ми вже показуємо реальний регіональний горизонт і clearance, вибір точки на mesh та зміну локального сонячного світла в часі. Це регіональна оцінка: далекі перешкоди поза 20 km не доведені, тому глобальна видимість і підсумки навмисно Unknown».

## Підготовка

З основного ByteForce root:

```sh
cd .audit/final-integration
npm ci --prefix frontend
dotnet restore backend/LunarNavigator.sln
python3 scripts/asset-setup.py --capture-docs --acquire-nac --prepare-runtime --write-launch-env
python3 scripts/run-local.py
```

Stable .NET 10, Node 22, Python; для Windows рекомендовано WSL. Якщо worktree вже відкрита, пропустіть `cd`. Для повторного offline asset build: `python3 scripts/asset-setup.py --offline --prepare-runtime --write-launch-env`. NASA Analyze все одно потребує мережі. Ручний dataset download не потрібний.

Відкрийте http://127.0.0.1:5173, залиште `VITE_USE_MOCKS=false`, переконайтеся в reviewed source/catalog, а не fallback preview. При NASA timeout покажіть error/cancel/retry, не підміняйте відповідь mock success. Після виступу `Ctrl+C` завершує три сервіси.

## Walkthrough · 90–180 секунд

| Час | Дія | Пояснення |
|---|---|---|
| 0–25 s | Pitch; показати regional status | Реальна інтеграція, не certified landing recommendation |
| 25–50 s | Exploratory patch: Connecting Ridge; camera controls, клік actual GLB triangle для A | Reviewed coordinate/height mapping; marker стоїть на реальній triangle surface, не нульовій площині. Перемкнути patch, показати новий mesh; три patches не є затвердженими landing sites |
| 50–85 s | Повернути Connecting Ridge, UTC за замовчуванням 15 листопада 2026, одногодинний інтервал; Analyze site | Дати UTC. NASA azimuth/elevation + LOLA observer height і regional profile; очікується 360 azimuth points, не глобальна visibility |
| 85–110 s | Regional horizon/clearance, Unknown summaries | Model range 20 km, azimuth 1°, radial step 80 m. `terrainApplied=false` тут означає відсутність complete visibility solution, не відсутність DEM |
| 110–135 s | Play/Pause, scrub UTC | Світло бере cached topocentric Sun angles і local Jacobian; без нового API запиту при scrub/на кожен кадр. Graphic shadows — estimates, не verified illumination |
| 135–165 s | **Quick compare**: явна дія короткого порівняння, два samples на site; A/B patches і markers | Це actual submit, не лише Prepare. Для довільних scenarios є Prepare patch comparison + Compare scenarios. Differences — B − A; null не нуль і не доказ переваги |
| 165–180 s | Learn / sources / limitations | Повний regional DEM, reviewed radial datum, але не повна far-field visibility; texture відсутня чесно |

Для ручного reproduction: Connecting Ridge `-89.45,-137.31`, Near Shackleton `-89.9,0`, Near de Gerlache `-88.7,-68`. Дати дозволені **1962-01-01 ≤ UTC < 2650-01-01**, не exact pole azimuth science. Це workflow coordinates, не рекомендації посадки. Для короткого control request у science review використано `-89,+25`, `2026-11-14T00:00Z`—`00:10Z`, step 10; не плутати з повним UX demo.

Два reviewed opt-in browser cases вже passed: actual picking/A/B marker heights/patch switch, NASA/DEM regional profile та cached local sunlight при зміні UTC. Це не автоматичне твердження про проходження майбутнього 9-case matrix; фінальний результат — у RELEASE_TEST_REPORT.

## Що сказати про науку й зображення

- LOLA: повний official 189158392-byte DEM, MOON_ME/DE421, sphere R=1737400 m. Barker/NTRS/PDS generating chain закрила datum definition; exact identity/geotags/epoch gate автоматичний, без arbitrary approval flag.
- 47,628 mesh vertices зіставлено з native source у межах **1 mm numerical tolerance**, не «місячна поверхня відома з точністю 1 mm». Triangle height і backend bilinear height можуть відрізнятися всередині cell.
- Regional clearance доступний; усі `visible=null`, summaries null, `partial`, global `quality.terrainApplied=false`. Sampling/далекі хребти не дають права заявляти повну видимість навіть за негативного clearance.
- LROC NAC завантажений і georeferenced, але не перекриває patches; texture/photos не застосовано, hillshade не називаємо фото.
- Local topocentric lighting — не global Moon-fixed synchronization; `/api/v1/ephemeris` залишається 503. Немає thermal/power/solar-disc/radio-link model.

## Окреме synthetic demo — лише за потреби

DEV-only `VITE_USE_MOCKS=true` потребує перезапуску Vite та явного **SYNTHETIC / DEMO** на екрані. Synthetic graphs/visibility/complete panels — UI fixtures, не NASA measurements; не потрібні для поточного real regional workflow. Не монтувати їх непомітно у live запис. Production dev mocks не активує. Поверніть false після демонстрації.

## Credits / submission

Зберегти всі п’ять командних внесків: 3D, UI, Backend/Horizons, LOLA/Data, Integration/CI/QA ([ролі](../../TEAM_ASSIGNMENTS.md)). Authored UI **Khrystyna**, source `a75d443`, збережений design/shell без `demoSlots`; попередній [Horizons внесок](../horizons.md), HUM-02 scripts/data attribution і [README credits](../../README.md#автори-джерела-й-ліцензії) збережені. NASA/JPL Horizons, LRO/LOLA/PGDA, Barker et al. 2023, PDS і LROC — [resource/source table](RELEASE_READINESS.md#ресурси). Код [MIT](../../LICENSE), © 2026 anastasiiazuliak; dataset/imagery licensing review окремий.

Люди мають: звірити final test report/SHA/CI, перевірити правила NASA Space Apps, авторство/ліцензії, записати правдивий UTC/mode-labelled walkthrough, перевірити repository і дозволений demo URL з іншого пристрою, отримати hosting permission та виконати submission/receipt. Наразі Docker runtime blocked, public URL не verified, PR15 не merged. Deadline **15 листопада 23:55 Europe/Kyiv**; переданий planning checkpoint **12:10** — не live clock і не підтвердження подання.
