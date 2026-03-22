-- Migration: Tables pour l'application de gestion de budget personnel

-- Catégories (Alimentation, Transport, Loisirs, etc.)
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT '💰'
);

-- Transactions (revenus et dépenses)
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Budgets mensuels par catégorie (optionnel)
CREATE TABLE IF NOT EXISTS monthly_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    budget_limit REAL NOT NULL,
    UNIQUE(category_id, month),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

-- Données initiales : catégories par défaut
INSERT INTO categories (name, type, color, icon) VALUES
    ('Salaire', 'income', '#22c55e', '💼'),
    ('Freelance', 'income', '#22c55e', '💻'),
    ('Investissements', 'income', '#22c55e', '📈'),
    ('Autre revenu', 'income', '#22c55e', '💰'),
    ('Alimentation', 'expense', '#ef4444', '🛒'),
    ('Transport', 'expense', '#f97316', '🚗'),
    ('Logement', 'expense', '#8b5cf6', '🏠'),
    ('Loisirs', 'expense', '#ec4899', '🎬'),
    ('Santé', 'expense', '#06b6d4', '⚕️'),
    ('Épargne', 'expense', '#14b8a6', '🏦'),
    ('Autres dépenses', 'expense', '#64748b', '📦');
