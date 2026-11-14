#!/bin/sh
# Capture main once; never move existing refs or change the working tree.
set -eu

if ! git rev-parse --git-dir >/dev/null 2>&1; then
    printf '%s\n' 'Помилка: запустіть скрипт усередині Git clone.' >&2
    exit 1
fi
if ! base=$(git rev-parse --verify 'refs/heads/main^{commit}' 2>/dev/null); then
    printf '%s\n' 'Помилка: локальної main немає. Спочатку підготуйте погоджений стартовий commit.' >&2
    exit 1
fi
printf 'Спільна база main: %s\n' "$base"
for lane in 1 2 3 4 5; do
    branch="feature/lane-$lane"
    if git show-ref --verify --quiet "refs/heads/$branch"; then
        existing=$(git rev-parse --verify "refs/heads/$branch")
        printf 'Залишено наявну %s (%s)\n' "$branch" "$existing"
        if [ "$existing" != "$base" ]; then
            printf 'Увага: %s відрізняється від стартової main; не перезаписано.\n' "$branch" >&2
        fi
    else
        git branch "$branch" "$base"
        printf 'Створено %s (%s)\n' "$branch" "$base"
    fi
done
printf '%s\n' 'Checkout не змінено. Fetch, push і commit не виконувались.'
