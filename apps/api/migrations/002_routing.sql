-- Migration 002 : routage contextuel (ContextFlow QR)
-- La configuration vit en JSON sur la ligne `qrcodes` : aucun aller-retour
-- supplementaire sur le chemin chaud de la redirection.

ALTER TABLE qrcodes ADD COLUMN regles_routage TEXT;

-- Fuseau de reference des regles horaires (celui du QR, jamais celui du visiteur).
ALTER TABLE qrcodes ADD COLUMN fuseau TEXT NOT NULL DEFAULT 'Africa/Brazzaville';
