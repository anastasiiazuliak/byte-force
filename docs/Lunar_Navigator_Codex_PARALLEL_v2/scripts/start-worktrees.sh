#!/usr/bin/env bash
set -euo pipefail
REPO="${1:-$PWD/lunar-navigator}"
cd "$REPO"
ROOT="$(pwd)"
for N in 1 2 3 4 5; do
  BRANCH="feature/lane-$N"
  TARGET="${ROOT}-lane-$N"
  git worktree add -b "$BRANCH" "$TARGET" HEAD
  echo "Agent #$N: $TARGET ($BRANCH)"
done
