-- Migration 002 : la table campagnes_emails utilisait date_creation dans le
-- code (INSERT / SELECT / ORDER BY) mais la colonne n'existait pas
-- (seuls created_at / updated_at étaient créés en 001) -> 500 systématique.
ALTER TABLE campagnes_emails ADD COLUMN date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
