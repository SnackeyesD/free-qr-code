-- Migration 003 : campagnes_emails — ajoute `nom` + `corps_texte`, étend le
-- CHECK `cible` à 'consentants' (accepté par les validators mais rejeté par
-- le CHECK 001 -> 500). SQLite ne permet pas de modifier un CHECK via
-- ALTER TABLE : rebuild de la table avec recopie (nom backfillé depuis titre).
PRAGMA foreign_keys = OFF;

ALTER TABLE campagnes_emails RENAME TO campagnes_emails_legacy;

CREATE TABLE campagnes_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    nom TEXT,
    titre TEXT NOT NULL CHECK (length(titre) > 0),
    contenu TEXT NOT NULL,
    corps_texte TEXT,
    cible TEXT NOT NULL CHECK (cible IN ('tous', 'actifs', 'inactifs', 'non_verifies', 'consentants')),
    statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'programmee', 'envoyee', 'annulee')),
    date_envoi DATETIME,
    date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nombre_ouvertures INTEGER NOT NULL DEFAULT 0 CHECK (nombre_ouvertures >= 0),
    nombre_clics INTEGER NOT NULL DEFAULT 0 CHECK (nombre_clics >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO campagnes_emails
  (id, public_id, id_utilisateur, nom, titre, contenu, corps_texte, cible, statut, date_envoi, date_creation, nombre_ouvertures, nombre_clics, created_at, updated_at)
SELECT id, public_id, id_utilisateur, titre, titre, contenu, NULL, cible, statut, date_envoi, date_creation, nombre_ouvertures, nombre_clics, created_at, updated_at
FROM campagnes_emails_legacy;

DROP TABLE campagnes_emails_legacy;

-- Le RENAME ci-dessus a réécrit les FK des tables enfants vers
-- campagnes_emails_legacy (supprimée). Rebuild pour repointer vers
-- campagnes_emails, avec recopie des données.
ALTER TABLE campagnes_utilisateurs RENAME TO campagnes_utilisateurs_legacy;

CREATE TABLE campagnes_utilisateurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_campagne INTEGER NOT NULL REFERENCES campagnes_emails(id) ON DELETE CASCADE,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    date_envoi_utilisateur DATETIME,
    est_ouvert INTEGER NOT NULL DEFAULT 0 CHECK (est_ouvert IN (0, 1)),
    est_clique INTEGER NOT NULL DEFAULT 0 CHECK (est_clique IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_campagne, id_utilisateur)
);

INSERT INTO campagnes_utilisateurs
  (id, id_campagne, id_utilisateur, date_envoi_utilisateur, est_ouvert, est_clique, created_at, updated_at)
SELECT id, id_campagne, id_utilisateur, date_envoi_utilisateur, est_ouvert, est_clique, created_at, updated_at
FROM campagnes_utilisateurs_legacy;

DROP TABLE campagnes_utilisateurs_legacy;

CREATE INDEX IF NOT EXISTS idx_campagnes_users_campagne ON campagnes_utilisateurs(id_campagne);
CREATE INDEX IF NOT EXISTS idx_campagnes_users_utilisateur_date ON campagnes_utilisateurs(id_utilisateur, date_envoi_utilisateur);

ALTER TABLE tracking_emails RENAME TO tracking_emails_legacy;

CREATE TABLE tracking_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    id_campagne INTEGER NOT NULL REFERENCES campagnes_emails(id) ON DELETE CASCADE,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('ouverture', 'clic')),
    token_tracking TEXT NOT NULL,
    url_cible TEXT,
    user_agent TEXT,
    adresse_ip TEXT,
    date_evenement DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tracking_emails
  (id, public_id, id_campagne, id_utilisateur, type, token_tracking, url_cible, user_agent, adresse_ip, date_evenement, created_at, updated_at)
SELECT id, public_id, id_campagne, id_utilisateur, type, token_tracking, url_cible, user_agent, adresse_ip, date_evenement, created_at, updated_at
FROM tracking_emails_legacy;

DROP TABLE tracking_emails_legacy;

CREATE INDEX IF NOT EXISTS idx_tracking_campagne_type_date ON tracking_emails(id_campagne, type, date_evenement);
CREATE INDEX IF NOT EXISTS idx_tracking_utilisateur_date ON tracking_emails(id_utilisateur, date_evenement);
CREATE INDEX IF NOT EXISTS idx_tracking_token ON tracking_emails(token_tracking);

CREATE INDEX IF NOT EXISTS idx_campagnes_utilisateur_date ON campagnes_emails(id_utilisateur, date_envoi);
CREATE INDEX IF NOT EXISTS idx_campagnes_statut_date ON campagnes_emails(statut, date_envoi);

PRAGMA foreign_keys = ON;
