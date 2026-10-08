PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE utilisateurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    mot_de_passe TEXT NOT NULL,
    nom TEXT NOT NULL CHECK (length(nom) > 0),
    est_verifie INTEGER NOT NULL DEFAULT 0 CHECK (est_verifie IN (0, 1)),
    consentement_marketing INTEGER NOT NULL DEFAULT 0 CHECK (consentement_marketing IN (0, 1)),
    date_consentement_marketing DATETIME,
    date_inscription DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_derniere_connexion DATETIME,
    preferences TEXT NOT NULL DEFAULT '{}',
    est_actif INTEGER NOT NULL DEFAULT 1 CHECK (est_actif IN (0, 1)),
    role TEXT NOT NULL DEFAULT 'utilisateur' CHECK (role IN ('utilisateur', 'admin')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (email LIKE '%_@__%.__%')
);
CREATE TABLE modeles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    id_utilisateur INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
    nom TEXT NOT NULL CHECK (length(nom) > 0),
    description TEXT,
    type_contenu TEXT NOT NULL CHECK (type_contenu IN ('url', 'texte', 'email', 'telephone', 'sms', 'wifi', 'vcard', 'geo', 'pdf')),
    parametres_par_defaut TEXT NOT NULL DEFAULT '{}',
    est_public INTEGER NOT NULL DEFAULT 0 CHECK (est_public IN (0, 1)),
    date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE qrcodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    id_modele INTEGER REFERENCES modeles(id) ON DELETE SET NULL,
    contenu TEXT NOT NULL,
    type_contenu TEXT NOT NULL CHECK (type_contenu IN ('url', 'texte', 'email', 'telephone', 'sms', 'wifi', 'vcard', 'geo', 'pdf')),
    est_dynamique INTEGER NOT NULL DEFAULT 0 CHECK (est_dynamique IN (0, 1)),
    alias_court TEXT UNIQUE,
    parametres TEXT NOT NULL DEFAULT '{}',
    est_actif INTEGER NOT NULL DEFAULT 1 CHECK (est_actif IN (0, 1)),
    date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_expiration DATETIME,
    nombre_scans_total INTEGER NOT NULL DEFAULT 0 CHECK (nombre_scans_total >= 0),
    url_image TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (date_expiration IS NULL OR date_expiration > date_creation)
);
CREATE TABLE scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    id_qrcode INTEGER NOT NULL REFERENCES qrcodes(id) ON DELETE CASCADE,
    adresse_ip TEXT NOT NULL,
    user_agent TEXT,
    pays TEXT,
    ville TEXT,
    referer TEXT,
    date_scan DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    est_unique INTEGER NOT NULL DEFAULT 0 CHECK (est_unique IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE campagnes_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    titre TEXT NOT NULL CHECK (length(titre) > 0),
    contenu TEXT NOT NULL,
    cible TEXT NOT NULL CHECK (cible IN ('tous', 'actifs', 'inactifs', 'non_verifies')),
    statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'programmee', 'envoyee', 'annulee')),
    date_envoi DATETIME,
    nombre_ouvertures INTEGER NOT NULL DEFAULT 0 CHECK (nombre_ouvertures >= 0),
    nombre_clics INTEGER NOT NULL DEFAULT 0 CHECK (nombre_clics >= 0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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
CREATE TABLE statistiques_qrcodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_qrcode INTEGER NOT NULL REFERENCES qrcodes(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    nombre_scans INTEGER NOT NULL DEFAULT 0 CHECK (nombre_scans >= 0),
    nombre_scans_uniques INTEGER NOT NULL DEFAULT 0 CHECK (nombre_scans_uniques >= 0),
    pays_top TEXT NOT NULL DEFAULT '[]',
    appareils_top TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_qrcode, date)
);
CREATE TABLE cles_api (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    nom TEXT NOT NULL CHECK (length(nom) > 0),
    cle TEXT UNIQUE NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',
    date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_expiration DATETIME,
    derniere_utilisation DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (date_expiration IS NULL OR date_expiration > date_creation)
);
CREATE TABLE journaux_qrcodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    id_qrcode INTEGER NOT NULL REFERENCES qrcodes(id) ON DELETE CASCADE,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('modification_cible', 'activation', 'desactivation', 'suppression')),
    ancienne_valeur TEXT,
    nouvelle_valeur TEXT,
    date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE tokens_email (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('verification', 'reinitialisation')),
    date_expiration DATETIME NOT NULL,
    date_utilisation DATETIME,
    est_utilise INTEGER NOT NULL DEFAULT 0 CHECK (est_utilise IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (date_expiration > created_at)
);
CREATE TABLE refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    id_utilisateur INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    access_token_jti_hash TEXT,
    user_agent TEXT,
    adresse_ip TEXT,
    date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_derniere_utilisation DATETIME,
    date_expiration DATETIME NOT NULL,
    date_revocation DATETIME,
    est_revoke INTEGER NOT NULL DEFAULT 0 CHECK (est_revoke IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (date_expiration > date_creation)
);
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
DELETE FROM sqlite_sequence;
CREATE INDEX idx_utilisateurs_email ON utilisateurs(email);
CREATE INDEX idx_utilisateurs_role_actif ON utilisateurs(role, est_actif);
CREATE INDEX idx_utilisateurs_consentement ON utilisateurs(consentement_marketing, est_actif, est_verifie);
CREATE INDEX idx_modeles_public_type ON modeles(est_public, type_contenu);
CREATE INDEX idx_modeles_utilisateur ON modeles(id_utilisateur);
CREATE INDEX idx_qrcodes_utilisateur_date ON qrcodes(id_utilisateur, date_creation);
CREATE INDEX idx_qrcodes_alias ON qrcodes(alias_court) WHERE alias_court IS NOT NULL;
CREATE INDEX idx_qrcodes_dynamique_alias ON qrcodes(est_dynamique, alias_court);
CREATE INDEX idx_qrcodes_public_id ON qrcodes(public_id);
CREATE INDEX idx_scans_qrcode_date ON scans(id_qrcode, date_scan);
CREATE INDEX idx_scans_qrcode_unique_date ON scans(id_qrcode, est_unique, date_scan);
CREATE INDEX idx_scans_date_scan ON scans(date_scan);
CREATE INDEX idx_campagnes_utilisateur_date ON campagnes_emails(id_utilisateur, date_envoi);
CREATE INDEX idx_campagnes_statut_date ON campagnes_emails(statut, date_envoi);
CREATE INDEX idx_campagnes_users_campagne ON campagnes_utilisateurs(id_campagne);
CREATE INDEX idx_campagnes_users_utilisateur_date ON campagnes_utilisateurs(id_utilisateur, date_envoi_utilisateur);
CREATE INDEX idx_stats_qrcode_date ON statistiques_qrcodes(id_qrcode, date);
CREATE INDEX idx_cles_api_utilisateur ON cles_api(id_utilisateur);
CREATE INDEX idx_cles_api_cle ON cles_api(cle);
CREATE INDEX idx_journaux_qrcode_date ON journaux_qrcodes(id_qrcode, date);
CREATE INDEX idx_journaux_utilisateur_date ON journaux_qrcodes(id_utilisateur, date);
CREATE INDEX idx_tokens_email_hash ON tokens_email(token_hash);
CREATE INDEX idx_tokens_email_utilisateur_type ON tokens_email(id_utilisateur, type, est_utilise);
CREATE INDEX idx_tokens_email_expiration ON tokens_email(date_expiration);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_access_jti_hash ON refresh_tokens(access_token_jti_hash);
CREATE INDEX idx_refresh_tokens_utilisateur_creation ON refresh_tokens(id_utilisateur, date_creation);
CREATE INDEX idx_refresh_tokens_expiration ON refresh_tokens(date_expiration);
CREATE INDEX idx_tracking_campagne_type_date ON tracking_emails(id_campagne, type, date_evenement);
CREATE INDEX idx_tracking_utilisateur_date ON tracking_emails(id_utilisateur, date_evenement);
CREATE INDEX idx_tracking_token ON tracking_emails(token_tracking);
CREATE VIEW v_qrcodes_stats AS
SELECT
    q.id,
    q.public_id,
    q.id_utilisateur,
    q.contenu,
    q.type_contenu,
    q.est_actif,
    COUNT(s.id) AS total_scans,
    SUM(CASE WHEN s.est_unique = 1 THEN 1 ELSE 0 END) AS total_scans_uniques
FROM qrcodes q
LEFT JOIN scans s ON s.id_qrcode = q.id
GROUP BY q.id, q.public_id, q.id_utilisateur, q.contenu, q.type_contenu, q.est_actif;
CREATE VIEW v_utilisateurs_marketing AS
SELECT *
FROM utilisateurs
WHERE est_actif = 1
  AND consentement_marketing = 1
  AND est_verifie = 1;
