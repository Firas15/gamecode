#!/usr/bin/env bash
set -e

APP=/var/www/html
SEED=/opt/gamecode-seed

# 1. Первичное наполнение примонтированных volume'ов
for pair in "data:$APP/data" "news:$APP/img/news" "avatars:$APP/img/avatars"; do
    src="$SEED/${pair%%:*}"
    dst="${pair#*:}"
    mkdir -p "$dst"
    if [ -d "$src" ] && [ -z "$(ls -A "$dst" 2>/dev/null)" ]; then
        cp -a "$src/." "$dst/" 2>/dev/null || true
    fi
done

# 2. HMAC-ключ античита: генерируем один раз, дальше живёт в volume
if [ ! -s "$APP/data/app_secret.key" ]; then
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$APP/data/app_secret.key"
    echo "[entrypoint] сгенерирован новый data/app_secret.key"
fi

chown -R www-data:www-data "$APP/data" "$APP/img/news" "$APP/img/avatars"
chmod 640 "$APP/data/app_secret.key" || true

# 3. Ждём Postgres (не обязательно, но убирает гонку при старте)
if [ -n "${DB_HOST:-}" ]; then
    for i in $(seq 1 30); do
        if pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

exec "$@"
