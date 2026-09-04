# ---------- GameCode: PHP 8.2 + Apache ----------
FROM php:8.2-apache

ENV DEBIAN_FRONTEND=noninteractive

# Системные зависимости и PHP-расширения (pgsql + redis)
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        libpq-dev \
        postgresql-client \
        curl; \
    docker-php-ext-install pgsql pdo_pgsql; \
    printf "\n" | pecl install redis; \
    docker-php-ext-enable redis; \
    a2enmod headers expires rewrite; \
    rm -rf /var/lib/apt/lists/*

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
