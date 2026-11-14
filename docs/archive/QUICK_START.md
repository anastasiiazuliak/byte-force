> **ARCHIVE:** Historical planning guide. Start only after the architecture PR is merged, using the [current workflow](../integration/team-workflow.md). Do not follow the old repository/bootstrap instructions below. HUM-02 was already merged in PR #4; outstanding verification is recorded in the [data audit caveat](../DATA_SOURCES.md#audit-caveat). The retired publisher now lives at repository root.

**V2 OVERRIDE:** Use `START_ALL_5.md` to begin all five lanes immediately. This file is retained only for historical context; any instruction to wait for ARC-01/02/03 is superseded.

# Як запустити паралельну розробку за 5 людей

## Твоя персональна сторінка

**Спершу відкрий [`TEAM_ASSIGNMENTS.md`](../../TEAM_ASSIGNMENTS.md).** Для кожного учасника підготовлено окремий `people/PERSON-01.md` … `PERSON-05.md` з ID, залежностями та посиланнями на Codex-промти. У `issues.csv` є `assignee_number`.

## Хто що бере на старті

| Людина | Основна спеціалізація | Перша таска | Далі |
|---|---|---|---|
| 1 | 3D Frontend | FE3D-01 після ARC-01 | FE3D-03 → FE3D-02 → FE3D-04 |
| 2 | UI Frontend | FEUI-01 після ARC-01 | FEUI-02 → FEUI-03 → FEUI-04 → FEUI-05/06 |
| 3 | C# / Horizons | BE-02 після ARC-02 | BE-01 → BE-03 → BE-04 → BE-05 |
| 4 | LOLA / Data | HUM-02; ARC-03 вести №4 з review №1/№5 | DATA-01 → DATA-02; DATA-03 → DATA-04/05 |
| 5 | Integrator | HUM-01 → ARC-01 → ARC-02 | INT-01 → OPS-01 → INT-02 → OPS-02/QA-01 |

**Примітка:** `HUM-03/04` координує №5 (з підтримкою команди), `BE-06` веде №3 (з review №4). №1 бере `QA-02`. №2 — `P2-02`. №4 — `P2-01` і `P2-03`. Жоден із цих пунктів не лишився без основного виконавця.

## Інструкція координатору

1. Створити GitHub репозиторій та надати доступ 5 учасникам (HUM-01).
2. Скопіювати `TEAM_SPEC.md` як `docs/TEAM_SPEC.md`; `issues/*.md` — опис GitHub Issues.
3. Почати з ARC-01 і ARC-02; одразу узгодити схему тайлів та координат в ARC-03.
4. Ніхто не повинен редагувати `contracts/openapi.yaml` без review від інтегратора і API-розробника.
5. Кожному task виділити одну гілку `feature/TASK-ID-short-name` та окремий Pull Request.
6. Зливати маленькі PR часто, перевіряти CI, не тримати тиждень несумісні локальні гілки.
7. Для запуску Codex дати агенту **один** `issues/TASK-ID.md` і доступ до репозиторію (де є `docs/TEAM_SPEC.md`).

## Коли у вас уже все «готове»

Контрольний демонстраційний сценарій не повинен залежати від P1/P2: **3D точка → вибір UTC часу → `analyze` з перевірених Horizons + LOLA → картки/графіки/горизонт → друга точка або інша дата → `compare` → публічний URL**. Умовне світло можна показувати як ілюстрацію; не видавати його за точне наукове затінення поверхні.

## Як перенести issues в GitHub

Найбезпечніше — створити вручну по одному з `issues/*.md`, щоб зразу призначити реального GitHub assignee за `assignee_number`. Якщо є `gh` CLI, у пакеті є опціональний `publish_github_issues.py`. Він **за замовчуванням тільки показує команди**. Для реального створення треба явно запустити його з `--apply` і мати права GitHub; команда створить багато issues. Спочатку перевірте `gh auth status` та потрібний репозиторій.
