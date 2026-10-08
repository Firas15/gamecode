# ---------- GameCode: PHP 8.2 + Apache ----------
FROM php:8.2-apache

ENV DEBIAN_FRONTEND=noninteractive

# Системные зависимости и PHP-расширения (pgsql + redis)
#
# Расширение redis ставим из PECL, а если pecl.php.net недоступен
# (так уже было: сервер до него не достучался, и автодеплой молча
# остался на старой версии), — собираем те же исходники phpredis
# с GitHub. Версия закреплена, чтобы оба пути давали одно и то же.
ARG PHPREDIS_VERSION=6.1.0
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        libpq-dev \
        postgresql-client \
        curl; \
    docker-php-ext-install pgsql pdo_pgsql; \
    if printf "\n" | timeout 180 pecl install "redis-${PHPREDIS_VERSION}"; then \
        docker-php-ext-enable redis; \
    else \
        echo "PECL недоступен — собираю phpredis ${PHPREDIS_VERSION} из GitHub"; \
        docker-php-source extract; \
        mkdir -p /usr/src/php/ext/redis; \
        curl -fsSL --retry 3 --connect-timeout 20 \
            "https://github.com/phpredis/phpredis/archive/refs/tags/${PHPREDIS_VERSION}.tar.gz" \
            | tar -xz -C /usr/src/php/ext/redis --strip-components=1; \
        docker-php-ext-install redis; \
        docker-php-source delete; \
    fi; \
    php -m | grep -qx redis; \
    a2enmod headers expires rewrite; \
    rm -rf /var/lib/apt/lists/* /tmp/pear

# Конфиги
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-gamecode.ini
COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY docker/entrypoint.sh /usr/local/bin/gamecode-entrypoint
RUN chmod +x /usr/local/bin/gamecode-entrypoint

# Код приложения
COPY . /var/www/html

# Эталонная копия изменяемых каталогов — из неё entrypoint наполняет пустые тома
RUN set -eux; \
    mkdir -p /var/www/html/data /var/www/html/img/news /var/www/html/img/avatars; \
    mkdir -p /opt/gamecode-seed/data /opt/gamecode-seed/news /opt/gamecode-seed/avatars; \
    cp -a /var/www/html/data/.    /opt/gamecode-seed/data/; \
    cp -a /var/www/html/img/news/.    /opt/gamecode-seed/news/; \
    cp -a /var/www/html/img/avatars/. /opt/gamecode-seed/avatars/; \
    chown -R www-data:www-data /var/www/html

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost/api/version.php || exit 1

ENTRYPOINT ["gamecode-entrypoint"]
CMD ["apache2-foreground"]
