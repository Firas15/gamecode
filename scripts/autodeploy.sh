#!/bin/bash
# ============================================================
#  Автодеплой GameCode: раз в 2 минуты (cron) проверяет origin/main
#  и пересобирает web, если есть невыложенный коммит.
#
#  Работает КОПИЯ этого файла — /root/gamecode-autodeploy.sh, вне
#  /opt/gamecode: иначе git reset подменил бы скрипт во время работы.
#  Обновить копию после правок здесь:
#     install -m 755 /opt/gamecode/scripts/autodeploy.sh /root/gamecode-autodeploy.sh
#
#  Чем отличается от первой версии: выложенным считается коммит,
#  который УСПЕШНО собрался (/var/lib/gamecode-deploy/deployed),
#  а не тот, что просто скачан. Если сборка упала, через 30 минут
#  скрипт попробует снова сам — раньше он ждал следующего пуша.
# ============================================================
set -u

exec 9>/var/lock/gamecode-deploy.lock
flock -n 9 || exit 0

STATE=/var/lib/gamecode-deploy
RETRY_MIN=30
mkdir -p "$STATE"
log() { echo "$(date '+%F %T') $*"; }

cd /opt/gamecode || exit 1
git fetch --quiet origin main || { log "git fetch не удался"; exit 1; }

REMOTE=$(git rev-parse origin/main)
DEPLOYED=$(cat "$STATE/deployed" 2>/dev/null || true)
[ "$REMOTE" = "$DEPLOYED" ] && exit 0

# Этот коммит недавно уже не собрался — ждём, не долбим сборку каждые 2 минуты
if [ "$(cat "$STATE/failed" 2>/dev/null || true)" = "$REMOTE" ] \
   && [ -n "$(find "$STATE/failed" -mmin -"$RETRY_MIN" 2>/dev/null)" ]; then
    exit 0
fi

log "--- коммит ${REMOTE:0:8}"
git log --oneline -1 origin/main
git reset --hard --quiet origin/main
chmod +x scripts/*.sh docker/entrypoint.sh 2>/dev/null || true

if docker compose --profile https up -d --build web; then
    echo "$REMOTE" > "$STATE/deployed"
    rm -f "$STATE/failed"
    docker image prune -f >/dev/null 2>&1 || true   # старые безымянные образы, место на диске
    log "выложено"
else
    echo "$REMOTE" > "$STATE/failed"
    log "ОШИБКА сборки — сайт работает на предыдущей версии, повтор через $RETRY_MIN мин"
fi
