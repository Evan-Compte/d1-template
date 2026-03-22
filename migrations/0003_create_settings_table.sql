-- Paramètres de l'application
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
    ('currency', 'EUR'),
    ('app_name', 'Mon Budget Personnel');
