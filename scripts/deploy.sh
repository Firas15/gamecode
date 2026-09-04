#!/usr/bin/env bash
# То же самое для запуска НА СЕРВЕРЕ, если код обновляется через git:
#   cd /opt/gamecode && ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull
docker compose --profile https up -d --build web
docker compose ps
