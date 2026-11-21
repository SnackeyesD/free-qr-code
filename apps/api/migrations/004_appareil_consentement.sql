-- Migration 004 : compteur par appareil et consentement (ContextFlow QR, phase 4)
-- L'identifiant stocke est toujours un hash : le cookie `cfq_did` n'est jamais
-- ecrit en base. Une fuite de la base ne permet donc pas de rejouer un cookie.
--
-- Le compteur de redirection vit dans le cookie `cfq_c` (chemin chaud, zero
-- requete D1). `appareils_qr` sert d'agregat d'audit et de source de verite
-- pour les statistiques, jamais de dependance bloquante pour la redirection.

CREATE TABLE IF NOT EXISTS appareils_qr (
  id_appareil  TEXT NOT NULL,
  id_qrcode    INTEGER NOT NULL REFERENCES qrcodes(id) ON DELETE CASCADE,
  nombre_scans INTEGER NOT NULL DEFAULT 0 CHECK (nombre_scans >= 0),
  premier_scan TEXT NOT NULL,
  dernier_scan TEXT NOT NULL,
  PRIMARY KEY (id_appareil, id_qrcode)
);

CREATE INDEX IF NOT EXISTS idx_appareils_qr_date
  ON appareils_qr (id_qrcode, dernier_scan);

-- Preuve de consentement (minimisation : uniquement ce qui est necessaire).
CREATE TABLE IF NOT EXISTS consentements (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  id_appareil       TEXT NOT NULL,
  finalite          TEXT NOT NULL,
  version_texte     TEXT NOT NULL,
  date_consentement TEXT NOT NULL,
  date_retrait      TEXT
);

CREATE INDEX IF NOT EXISTS idx_consentements_appareil
  ON consentements (id_appareil, finalite);

-- Traçabilite du scan. NULL = scan non attribue a un appareil (pas de
-- consentement ou QR sans regle appareil).
ALTER TABLE scans ADD COLUMN id_appareil TEXT;

CREATE INDEX IF NOT EXISTS idx_scans_appareil
  ON scans (id_qrcode, id_appareil);
