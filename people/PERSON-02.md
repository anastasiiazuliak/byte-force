# Людина №2 — UI Frontend

> **Current start rule:** Start lane implementation only AFTER the architecture PR is merged into `main`, from the same coordinator-recorded full `origin/main` SHA in all five clones. Repository: `git@github.com:anastasiiazuliak/byte-force.git`. Do not use `57f0aee` or rerun historical bootstrap instructions. After that gate, lane dependencies do not block independent work.  See [current workflow](../docs/integration/team-workflow.md) and [data caveat](../docs/DATA_SOURCES.md#audit-caveat); this notice supersedes historical instructions below.

**Твій старт:** Старт після ARC-01: FEUI-01. До реального API використовуйте fixtures з ARC-02.

**З ким узгоджувати:** ARC-02 (DTO), FE3D-03 (site selection), INT-01/02 (API і інтеграція).

## Твій персональний беклог

| Порядок | ID | Пріоритет | Назва | Блокується до виконання |
|---:|---|---|---|---|
| 1 | [FEUI-01](../issues/FEUI-01.md) | **P0** | Створити Lunar Mission Control UI shell та адаптивний дизайн | ARC-01 |
| 2 | [FEUI-02](../issues/FEUI-02.md) | **P0** | Створити site picker та форму дати/часу з валідацією | FEUI-01, ARC-02 |
| 3 | [FEUI-03](../issues/FEUI-03.md) | **P0** | Зробити Analysis Panel: картки, графіки, 360° horizon view | FEUI-01, ARC-02 |
| 4 | [FEUI-04](../issues/FEUI-04.md) | **P0** | Створити Mission Timeline зі scrub, Play/Pause та синхронізацією часу | FEUI-03, ARC-02 |
| 5 | [FEUI-05](../issues/FEUI-05.md) | **P0** | Створити Compare Mode для двох місць або різних дат | FEUI-03, FEUI-04, ARC-02 |
| 6 | [FEUI-06](../issues/FEUI-06.md) | **P1** | Додати зрозумілі стани завантаження, пояснення точності та доступність | FEUI-02, FEUI-03, FEUI-05 |
| 7 | [P2-02](../issues/P2-02.md) | **P2** | Додати експорт CSV і короткий звіт без підміни наукових даних | FEUI-05, DATA-05 |

## Як виконувати

1. Обери першу доступну P0-таску зі списку, відкрий Markdown за посиланням та перевір «Залежності».
2. Працюй у своїй гілці `feature/TASK-ID-short-name` і передавай Codex **одне** чітке завдання за раз.
3. Не змінюй чужі каталоги й спільні контракти без погодженого PR; використовуй тимчасові fixtures лише як DEMO.
4. У Pull Request прикріпи результати тестів та короткий звіт, у GitHub Issue постав свій акаунт в `Assignees`.
5. Коли задача Done — бери наступну доступну P0. До P1/P2 переходьте після робочого основного сценарію.
