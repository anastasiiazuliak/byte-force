# Людина №3 — Backend / Horizons

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  Existing Horizons code and 24 offline cases are preserved under `backend/`; reuse them, do not rewrite the scientific client.  See [current workflow](../docs/integration/team-workflow.md) and [data caveat](../docs/DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

**Твій старт:** Після ARC-02: BE-01 і BE-02 можна розробляти паралельно; BE-03 чекає DATA-02, BE-06 — DATA-03.

**З ким узгоджувати:** ARC-02 (OpenAPI), DATA-02 (горизонт), DATA-03 (metadata тайлів), BE-05 узгодити з 3D.

## Твій персональний беклог

| Порядок | ID | Пріоритет | Назва | Блокується до виконання |
|---:|---|---|---|---|
| 1 | [BE-01](../issues/BE-01.md) | **P0** | Реалізувати .NET API foundation, config та каталог місць | ARC-01, ARC-02 |
| 2 | [BE-02](../issues/BE-02.md) | **P0** | Підключити JPL Horizons: локальні азимут/висота Сонця та Землі | ARC-02 |
| 3 | [BE-06](../issues/BE-06.md) | **P0** | Реалізувати GET /map/metadata для синхронізації 3D mesh, CRS та static URLs | ARC-02, ARC-03, DATA-03 |
| 4 | [BE-03](../issues/BE-03.md) | **P0** | Реалізувати POST /analyze: горизонти, видимість, інтервали, summaries | BE-02, DATA-02, ARC-02 |
| 5 | [BE-04](../issues/BE-04.md) | **P0** | Реалізувати POST /compare та узгоджені метрики A/B | BE-03, ARC-02 |
| 6 | [BE-05](../issues/BE-05.md) | **P1** | POST /ephemeris: перевірені Moon-fixed напрями для освітлення 3D | BE-02, ARC-03 |

## Як виконувати

1. Обери першу доступну P0-таску зі списку, відкрий Markdown за посиланням та перевір «Залежності».
2. Працюй у своїй гілці `feature/TASK-ID-short-name` і передавай Codex **одне** чітке завдання за раз.
3. Не змінюй чужі каталоги й спільні контракти без погодженого PR; використовуй тимчасові fixtures лише як DEMO.
4. У Pull Request прикріпи результати тестів та короткий звіт, у GitHub Issue постав свій акаунт в `Assignees`.
5. Коли задача Done — бери наступну доступну P0. До P1/P2 переходьте після робочого основного сценарію.
