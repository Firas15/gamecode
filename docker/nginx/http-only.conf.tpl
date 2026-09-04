# Этап 1: только HTTP. Отдаём ACME-челлендж и проксируем сайт,
# пока сертификата ещё нет. Генерируется scripts/setup-https.sh.
server {
    listen 80;
    server_name __DOMAIN__ www.__DOMAIN__;

    client_max_body_size 16m;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        include /etc/nginx/proxy.inc;
    }
}
