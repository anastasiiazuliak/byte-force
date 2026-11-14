#!/bin/sh
set -eu
# Run from the repository root; keep the process in the foreground for clean shutdown.
if [ ! -f backend/LunarNavigator.Api/LunarNavigator.Api.csproj ]; then
    echo 'Run scripts/dev.sh from the repository root.' >&2
    exit 1
fi
exec dotnet run --project backend/LunarNavigator.Api/LunarNavigator.Api.csproj --urls http://localhost:5080
