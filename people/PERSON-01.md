# Людина №1 — 3D Frontend

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  See [current workflow](../docs/integration/team-workflow.md) and [data caveat](../docs/DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

**Твій старт:** Старт після ARC-01: FE3D-01. Спочатку можна робити тимчасовий dev-only mesh, але production потребує DATA-03.

**З ким узгоджувати:** ARC-03 (трансформації й координати), DATA-03/04 (GLB та LOD), FEUI-04 (час), BE-05 (напрямки світла).

## Твій персональний беклог

| Порядок | ID | Пріоритет | Назва | Блокується до виконання |
|---:|---|---|---|---|
| 1 | [FE3D-01](../issues/FE3D-01.md) | **P0** | Створити преміальний 3D Lunar Terrain Viewer із плавним orbit/pan/zoom | ARC-01 |
| 2 | [FE3D-03](../issues/FE3D-03.md) | **P0** | Реалізувати вибір точок A/B із raycast і коректними місячними координатами | FE3D-01, ARC-03, ARC-02 |
| 3 | [FE3D-02](../issues/FE3D-02.md) | **P1** | Додати 3D tile loader, LOD, текстури й плавне підвантаження | FE3D-01, ARC-03 |
| 4 | [FE3D-04](../issues/FE3D-04.md) | **P1** | Синхронізувати 3D-освітлення, Сонце й часовий scrub | FE3D-01, BE-05, FEUI-04 |
| 5 | [QA-02](../issues/QA-02.md) | **P1** | Оптимізувати мобільний 3D, FPS, LOD та memory cleanup | FE3D-02, FEUI-01, OPS-02 |

## Як виконувати

1. Обери першу доступну P0-таску зі списку, відкрий Markdown за посиланням та перевір «Залежності».
2. Працюй у своїй гілці `feature/TASK-ID-short-name` і передавай Codex **одне** чітке завдання за раз.
3. Не змінюй чужі каталоги й спільні контракти без погодженого PR; використовуй тимчасові fixtures лише як DEMO.
4. У Pull Request прикріпи результати тестів та короткий звіт, у GitHub Issue постав свій акаунт в `Assignees`.
5. Коли задача Done — бери наступну доступну P0. До P1/P2 переходьте після робочого основного сценарію.
