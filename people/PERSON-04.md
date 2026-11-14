# Людина №4 — LOLA / Data

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  HUM-02 is already merged in PR #4 (`c960326`, merge `92de0e8`); preserve legacy `data/**`, do not redo it. Integrity/provenance review remains outstanding.  See [current workflow](../docs/integration/team-workflow.md) and [data caveat](../docs/DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

**Твій старт:** Старт відразу: HUM-02. ARC-03 фіналізувати разом із №1 і №5 після ARC-02. Потім DATA-01 і DATA-03 можна паралелити за можливості.

**З ким узгоджувати:** ARC-02 (API і система координат), FE3D-01 (меш), BE-03 (горизонт), BE-06 (metadata).

## Твій персональний беклог

| Порядок | ID | Пріоритет | Назва | Блокується до виконання |
|---:|---|---|---|---|
| 1 | [HUM-02](../issues/HUM-02.md) | **P0** | Отримати й перевірити офіційні NASA-дані для DEM та зображень | немає |
| 2 | [ARC-03](../issues/ARC-03.md) | **P0** | Затвердити місячні координати, висотну базу, scene-transform і tile grid | ARC-02, HUM-02 |
| 3 | [DATA-01](../issues/DATA-01.md) | **P0** | Підключити NASA LOLA GeoTIFF через GDAL і читати висоту за координатами | HUM-02, ARC-03 |
| 4 | [DATA-03](../issues/DATA-03.md) | **P0** | Зробити offline DEM → один реальний 3D mesh GLB для demo-ділянки | HUM-02, ARC-03 |
| 5 | [DATA-02](../issues/DATA-02.md) | **P0** | Обчислити 360° локальний горизонт із LOLA та кривизною Місяця | DATA-01, ARC-03 |
| 6 | [DATA-05](../issues/DATA-05.md) | **P0** | Перевірити геометрію, горизонти та вихідні дані NASA на контрольних точках | DATA-02, BE-02 |
| 7 | [DATA-04](../issues/DATA-04.md) | **P1** | Побудувати LOD GLB/WebP тайли і заповнити map metadata | DATA-03, ARC-03 |
| 8 | [P2-01](../issues/P2-01.md) | **P2** | Додати наукову raster-маску освітленості цілої ділянки | BE-05, DATA-04, DATA-05 |
| 9 | [P2-03](../issues/P2-03.md) | **P2** | Додати 5 м/піксель DEM для вибраної високодетальної зони | DATA-04, DATA-05 |

## Як виконувати

1. Обери першу доступну P0-таску зі списку, відкрий Markdown за посиланням та перевір «Залежності».
2. Працюй у своїй гілці `feature/TASK-ID-short-name` і передавай Codex **одне** чітке завдання за раз.
3. Не змінюй чужі каталоги й спільні контракти без погодженого PR; використовуй тимчасові fixtures лише як DEMO.
4. У Pull Request прикріпи результати тестів та короткий звіт, у GitHub Issue постав свій акаунт в `Assignees`.
5. Коли задача Done — бери наступну доступну P0. До P1/P2 переходьте після робочого основного сценарію.
