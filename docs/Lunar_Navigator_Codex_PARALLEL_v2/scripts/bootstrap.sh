#!/usr/bin/env bash
set -euo pipefail
PKG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-$PWD/lunar-navigator}"
if [ -e "$TARGET" ]; then echo "Target already exists: $TARGET"; exit 1; fi
mkdir -p "$TARGET"
cp -a "$PKG_DIR/starter-repo/." "$TARGET/"
cd "$TARGET"
git init
git add .
git -c user.name="Lunar Team" -c user.email="lunar-team@localhost" commit -m "chore: freeze parallel-start contracts"
echo "Ready at $TARGET"
