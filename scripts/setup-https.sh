#!/usr/bin/env bash
# Выпуск сертификата Let's Encrypt и перевод сайта на HTTPS.
# Запускать из корня проекта на сервере:  ./scripts/setup-https.sh example.ru you@mail.ru
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
STAGING="${STAGING:-0}"   # STAGING=1 — тестовый сертификат, лимиты не тратятся

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Использование: $0 <домен> <email> [STAGING=1]"
    exit 1
fi

cd "$(dirname "$0")/.."
ROOT="$PWD"
CONF="$ROOT/docker/nginx/conf.d/default.conf"

echo "==> 1/6 Проверяю, что домен смотрит на этот сервер"
SERVER_IP="$(curl -fsS --max-time 10 https://api.ipify.org || echo '')"
DOMAIN_IP="$(getent hosts "$DOMAIN" | awk '{print $1; exit}' || echo '')"
WWW_IP="$(getent hosts "www.$DOMAIN" | awk '{print $1; exit}' || echo '')"
echo "    www: ${WWW_IP:-не резолвится}"
echo "    сервер: ${SERVER_IP:-неизвестно}   домен: ${DOMAIN_IP:-не резолвится}"
if [ -n "$SERVER_IP" ] && [ -n "$DOMAIN_IP" ] && [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    echo "    ВНИМАНИЕ: адреса не совпадают. Let's Encrypt не выдаст сертификат."
    read -rp "    Продолжить всё равно? [y/N] " a
    [ "$a" = "y" ] || exit 1
fi

echo "==> 2/6 Прячу web за localhost, поднимаю nginx на 80"
if grep -q '^WEB_BIND=' .env; then
    sed -i 's|^WEB_BIND=.*|WEB_BIND=127.0.0.1|' .env
else
    printf '\nWEB_BIND=127.0.0.1\n' >> .env
fi
sed -i 's|^WEB_PORT=.*|WEB_PORT=8080|' .env

sed "s|__DOMAIN__|$DOMAIN|g" docker/nginx/http-only.conf.tpl > "$CONF"
docker compose --profile https up -d
sleep 5

echo "==> 3/6 Проверяю, что ACME-путь отдаётся"
docker compose exec -T nginx sh -c 'mkdir -p /var/www/certbot/.well-known/acme-challenge && echo pong > /var/www/certbot/.well-known/acme-challenge/ping'
if curl -fsS --max-time 15 "http://$DOMAIN/.well-known/acme-challenge/ping" | grep -q pong; then
    echo "    ok"
else
    echo "    НЕ отдаётся. Проверьте DNS и что порт 80 открыт снаружи."
    exit 1
fi

echo "==> 4/6 Запрашиваю сертификат"
STAGING_FLAG=""
[ "$STAGING" = "1" ] && STAGING_FLAG="--staging"
docker compose run --rm --entrypoint certbot certbot certonly \
    --webroot -w /var/www/certbot \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos --no-eff-email --non-interactive \
    $STAGING_FLAG

echo "==> 5/6 Включаю HTTPS в nginx"
sed "s|__DOMAIN__|$DOMAIN|g" docker/nginx/https.conf.tpl > "$CONF"
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload

echo "==> 6/6 Включаю secure-cookie для сессий и пересобираю web"
if grep -q '^session.cookie_secure' docker/php.ini; then
    sed -i 's|^session.cookie_secure.*|session.cookie_secure = 1|' docker/php.ini
else
    sed -i 's|^session.cookie_httponly = 1|session.cookie_httponly = 1\nsession.cookie_secure = 1|' docker/php.ini
fi
docker compose --profile https up -d --build web

echo
echo "Готово: https://$DOMAIN"
echo "Проверка обновления сертификата: docker compose exec certbot certbot renew --dry-run"
