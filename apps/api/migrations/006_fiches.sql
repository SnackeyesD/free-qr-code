-- Migration 006 : fiches (documents structurés) rendues par le frontend.
--
-- Une fiche est portée par un QR `url` dont le contenu est
-- `${FRONTEND_URL}/d/<public_id>`. Aucune modification du runtime /q/:alias
-- n'est nécessaire : la redirection existante suffit.
--
-- Les fiches conservent un snapshot de leur schéma afin qu'une modification de
-- modèle ne casse jamais une fiche déjà imprimée.

CREATE TABLE IF NOT EXISTS fiches_modeles (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id         TEXT UNIQUE NOT NULL,
    id_utilisateur    INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    nom               TEXT NOT NULL CHECK (length(nom) > 0),
    description       TEXT,
    schema_json       TEXT NOT NULL DEFAULT '{"version":1,"champs":[]}',
    version           INTEGER NOT NULL DEFAULT 1,
    est_public        INTEGER NOT NULL DEFAULT 0 CHECK (est_public IN (0, 1)),
    date_creation     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fiches_modeles_utilisateur
    ON fiches_modeles(id_utilisateur, date_creation);

CREATE TABLE IF NOT EXISTS fiches (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id         TEXT UNIQUE NOT NULL,
    id_utilisateur    INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    id_modele         INTEGER REFERENCES fiches_modeles(id) ON DELETE SET NULL,
    titre             TEXT NOT NULL CHECK (length(titre) > 0),
    schema_snapshot   TEXT NOT NULL,
    valeurs_json      TEXT NOT NULL DEFAULT '{}',
    version           INTEGER NOT NULL DEFAULT 1,
    est_active        INTEGER NOT NULL DEFAULT 1 CHECK (est_active IN (0, 1)),
    date_creation     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fiches_utilisateur
    ON fiches(id_utilisateur, date_creation);
CREATE INDEX IF NOT EXISTS idx_fiches_publiques
    ON fiches(public_id) WHERE est_active = 1;

-- Lien QR -> fiche. Colonne additive, nullable : aucune reconstruction de
-- `qrcodes` et aucune modification de l'enum `type_contenu`.
ALTER TABLE qrcodes
    ADD COLUMN id_fiche INTEGER REFERENCES fiches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qrcodes_fiche
    ON qrcodes(id_fiche) WHERE id_fiche IS NOT NULL;
