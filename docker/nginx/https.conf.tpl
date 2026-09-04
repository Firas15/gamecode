# Этап 2: HTTP редиректит на HTTPS, весь трафик идёт через TLS.
# Генерируется scripts/setup-https.sh после выпуска сертификата.
server {
    listen 80;
    server_name __DOMAIN__ www.__DOMAIN__;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name __DOMAIN__ www.__DOMAIN__;

    ssl_certificate     /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;

    ssl_protocols             TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache         shared:SSL:10m;
    ssl_session_timeout       1d;
    ssl_stapling              on;
    ssl_stapling_verify       on;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header X-Frame-Options           "SAMEORIGIN" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;

    client_max_body_size 16m;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    if ($host = www.__DOMAIN__) {
        return 301 https://__DOMAIN__$request_uri;
    }

    location / {
        include /etc/nginx/proxy.inc;
    }
}
