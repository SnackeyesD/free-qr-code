-- Migration 003 : analytics par variante de routage (ContextFlow QR, phase 2)
-- `id_variante` reference l'identifiant stable du JSON `qrcodes.regles_routage`.
-- Pas de FK : la configuration vit en JSON ; un id renomme casserait l'historique.

ALTER TABLE scans ADD COLUMN id_variante TEXT;
ALTER TABLE scans ADD COLUMN langue TEXT;

-- Agregation par variante sur une periode (tableau comparatif).
CREATE INDEX IF NOT EXISTS idx_scans_variante
  ON scans (id_qrcode, id_variante);

CREATE INDEX IF NOT EXISTS idx_scans_date_variante
  ON scans (id_qrcode, date_scan, id_variante);
