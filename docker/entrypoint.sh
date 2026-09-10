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

# 1a. Аватары докладываем и в непустой том.
#
# img/avatars — том, а не часть образа, и наполняется он только пока
# пустой. Из-за этого аватары, добавленные в проект позже (например,
# платные из магазина), на работающий сервер не попадали бы: том давно
# не пуст, и копирование выше пропускается. Флаг -n не перезаписывает
# существующие файлы, поэтому загруженное на сервере не пострадает.
if [ -d "$SEED/avatars" ]; then
    cp -an "$SEED/avatars/." "$APP/img/avatars/" 2>/dev/null || true
fi

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

# 4. Миграции схемы.
#
# Все файлы в db/migrations написаны идемпотентно (IF NOT EXISTS),
# поэтому их можно прогонять при каждом старте — повторный запуск
# ничего не меняет. Иначе после каждого git push пришлось бы помнить
# про psql руками, а новая функция молча не работала бы.
#
# Ошибка миграции не роняет контейнер: сайт должен подняться и без
# новой колонки — код к этому готов и просто прячет новую функцию.
if [ -n "${DB_HOST:-}" ] && [ -d "$APP/db/migrations" ]; then
    for sql in "$APP"/db/migrations/*.sql; do
        [ -f "$sql" ] || continue
        if PGPASSWORD="${DB_PASSWORD:-}" psql \
              -h "$DB_HOST" -p "${DB_PORT:-5432}" \
              -U "${DB_USER:-postgres}" -d "${DB_NAME:-postgres}" \
              -v ON_ERROR_STOP=1 -q -f "$sql" >/dev/null 2>&1; then
            echo "[entrypoint] миграция применена: $(basename "$sql")"
        else
            echo "[entrypoint] ВНИМАНИЕ: миграция не применилась: $(basename "$sql")" >&2
        fi
    done
fi

exec "$@"
