#!/bin/bash
# ============================================================
#  Очистка журналов контейнеров GameCode — раз в месяц (cron).
#
#  В журналах nginx и web лежат IP-адреса посетителей. В политике
#  обработки персональных данных (pages/privacy.html) обещано, что
#  журналы хранятся не дольше одного месяца, — этот скрипт и
#  выполняет обещание: обнуляет текущий файл журнала каждого
#  контейнера проекта и удаляет уже повёрнутые (*.log.1, *.log.2).
#
#  Установка на сервере (один раз):
#     install -m 755 /opt/gamecode/scripts/clear-logs.sh /root/gamecode-clear-logs.sh
#     ( crontab -l; echo '20 3 1 * * /root/gamecode-clear-logs.sh >> /var/log/gamecode-clear-logs.log 2>&1' ) | crontab -
# ============================================================
set -u
for id in $(docker ps -aq --filter label=com.docker.compose.project=gamecode); do
    path=$(docker inspect --format '{{.LogPath}}' "$id" 2>/dev/null)
    [ -n "$path" ] && [ -f "$path" ] || continue
    truncate -s 0 "$path"
    rm -f "$path".*
done
echo "$(date '+%F %T') журналы контейнеров gamecode очищены"
