-- ============================================================
-- Настройки сайта, которые меняются из админки без выкладки.
-- Сейчас одна: тема оформления (original / newyear).
-- Миграция идемпотентна: entrypoint прогоняет её при каждом старте.
-- ============================================================
CREATE TABLE IF NOT EXISTS site_settings (
    key        varchar(64) PRIMARY KEY,
    value      text        NOT NULL,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO site_settings (key, value) VALUES ('theme', 'original')
ON CONFLICT (key) DO NOTHING;
