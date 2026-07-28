# GameCode

Образовательная игровая платформа для изучения программирования. Четыре мини-игры, система аккаунтов, таблица лидеров и чат-бот с FAQ.

---

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | Vanilla JS, CSS (без фреймворков) |
| Backend | PHP 8+ |
| База данных | PostgreSQL |
| Кэш | Redis |
| Веб-сервер | Apache (mod_rewrite, mod_headers) |

---

## Структура проекта

```
├── index.html                  # Главная страница (карусель игр, новости)
├── config.php                  # Локальный конфиг БД (не в git)
├── .htaccess                   # Заголовки кэша, no-store для всех ресурсов
│
├── api/                        # REST-эндпоинты (все принимают JSON, POST)
│   ├── login-submit.php        # Авторизация
│   ├── register-submit.php     # Регистрация
│   ├── logout.php              # Выход
│   ├── reset-password.php      # Сброс пароля по секретному вопросу
│   ├── check-auth.php          # Проверка сессии
│   ├── score.php               # Приём и валидация очков (античит)
│   ├── ping-game.php           # Генерация run_id/run_token перед игрой
│   ├── leaderboard.php         # Таблица лидеров
│   ├── games.php               # Список игр
│   ├── news.php                # Новости
│   ├── stats.php               # Статистика пользователя
│   ├── ai-chat.php             # Чат-бот (FAQ-поиск)
│   ├── chat-faq-admin.php      # Управление FAQ (только админ)
│   ├── get-question.php        # Вопросы для игр
│   ├── pixelgame-level.php     # Данные уровня Pixelgame из БД
│   ├── pixelgame-questions.php # Вопросы монстров Pixelgame из БД
│   ├── assets.php              # Версионирование статики
│   └── version.php             # Текущая версия деплоя
│
├── includes/
│   ├── auth.php                # Хелперы сессий и авторизации
│   ├── db.php                  # Подключение к PG, все CRUD-функции
│   ├── redis.php               # Cache-aside поверх PG (TTL: 5–60 мин)
│   └── game_security.php       # HMAC-подпись run_token, верификация
│
├── css/                        # Глобальные стили сайта
├── js/
│   ├── app.js                  # Инициализация главной страницы
│   ├── carousel.js             # Карусель игровых карточек
│   ├── leaderboard.js          # Виджет лидерборда + pingGame/submitScore
│   ├── auth.js / auth-forms.js # Формы входа/регистрации
│   ├── ai-chat.js              # Чат-бот UI
│   ├── news-carousel.js        # Карусель новостей
│   ├── pixels-bg.js            # Анимированный фон главной
│   ├── data.js                 # Статические данные (теория и пр.)
│   └── wip-guard.js            # Блокировка WIP-игр
│
├── pages/                      # Статические страницы сайта
│   ├── theory/                 # 20 страниц теории по Go и CS
│   ├── leaderboard.html
│   ├── about.html
│   └── ...
│
├── games/
│   ├── sorter/                 # Игра «Сортировщик» (алгоритмы)
│   ├── network/                # Игра «Сетевой маршрут» (IP/маски)
│   ├── millionaire/            # «Кто хочет стать программистом?»
│   └── pixelgame/              # «CodeQuest — Внутри компьютера»
│       ├── index.html
│       ├── css/style.css
│       ├── js/
│       │   ├── game.js         # Весь игровой движок
│       │   └── codequest-bg.js # Анимированный фон меню
│       ├── assets/player/      # Спрайты персонажа (4 направления)
│       └── data/levels/        # Fallback JSON (если PG недоступен)
│
├── admin/                      # Панель администратора
│   ├── dashboard.php           # Главная админки
│   ├── users.php               # Управление пользователями
│   ├── games.php               # Управление играми
│   ├── news.php                # Управление новостями
│   ├── pixelgame_editor.php    # Редактор уровней Pixelgame
│   ├── log.php                 # Лог действий
│   └── settings.php           # Настройки сайта
│
└── data/                       # Fallback JSON (если PG недоступен)
    ├── games.json
    ├── chat_faq.json
    └── ...
```

---

## Игры

| Игра | Описание | Уровень |
|------|----------|---------|
| **Сортировщик** | Сортируй блоки по корзинам, изучая алгоритмы | Средний |
| **Сетевой маршрут** | Маршрутизируй пакеты, решая задачи по IP и маскам | Средний |
| **Кто хочет стать программистом?** | Викторина по CS в формате телешоу | Лёгкий |
| **CodeQuest — Внутри компьютера** | Пиксельный лабиринт: собирай код, бейся с вирусами | Эксперт |

---

## Защита очков (античит)

1. Перед стартом игры фронтенд вызывает `api/ping-game.php` — сервер генерирует `run_id` и `run_token` (HMAC-SHA256, ключ хранится в `data/app_secret.key`)
2. При отправке результата клиент передаёт `run_id + run_token` — сервер проверяет подпись и то, что ран не был использован раньше
3. Для каждой игры своя логика валидации: диапазоны значений, согласованность метрик, минимальное время прохождения (считается по серверному времени)

---

## Запуск через Docker

### 1. Создай `docker-compose.yml` в корне проекта

```yaml
version: "3.9"

services:
  web:
    image: php:8.2-apache
    ports:
      - "8080:80"
    volumes:
      - .:/var/www/html
    depends_on:
      - db
      - redis
    environment:
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: gamecode
      DB_USER: gamecode_user
      DB_PASSWORD: your_password
      REDIS_HOST: redis
      REDIS_PORT: 6379

  db:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_DB: gamecode
      POSTGRES_USER: gamecode_user
      POSTGRES_PASSWORD: your_password
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: always

volumes:
  pg_data:
```

### 2. Добавь PHP-расширения

Создай `Dockerfile` рядом:

```dockerfile
FROM php:8.2-apache

RUN apt-get update && apt-get install -y libpq-dev \
    && docker-php-ext-install pgsql \
    && pecl install redis && docker-php-ext-enable redis \
    && a2enmod headers expires rewrite

COPY . /var/www/html
```

И замени в `docker-compose.yml` строку `image: php:8.2-apache` на:
```yaml
build: .
```

### 3. Создай `config.php`

```php
<?php
define('DB_HOST', 'db');
define('DB_PORT', '5432');
define('DB_NAME', 'gamecode');
define('DB_USER', 'gamecode_user');
define('DB_PASSWORD', 'your_password');
define('REDIS_HOST', 'redis');
define('REDIS_PORT', 6379);
```

### 4. Восстанови базу данных

```bash
# Скопируй дамп в контейнер и восстанови
docker cp gamecode_dump.sql <container_db>:/dump.sql
docker exec -it <container_db> psql -U gamecode_user -d gamecode -f /dump.sql
```

### 5. Запусти

```bash
docker compose up --build
```

Сайт будет доступен на `http://localhost:8080`

---

## Переменные окружения

Приложение читает конфигурацию в следующем порядке:

1. Константы из `config.php` (локальная разработка)
2. Переменные окружения (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `REDIS_HOST`, `REDIS_PORT`)
3. Стандартные PG-переменные (`PGHOST`, `PGUSER` и т.д.)

| Переменная | Описание | По умолчанию |
|-----------|----------|--------------|
| `DB_HOST` | Хост PostgreSQL | `localhost` |
| `DB_PORT` | Порт PostgreSQL | `5432` |
| `DB_NAME` | Имя базы данных | — |
| `DB_USER` | Пользователь БД | — |
| `DB_PASSWORD` | Пароль БД | — |
| `REDIS_HOST` | Хост Redis | `localhost` |
| `REDIS_PORT` | Порт Redis | `6379` |

---

## Авторы

Проект разработан в рамках учебного курса.
