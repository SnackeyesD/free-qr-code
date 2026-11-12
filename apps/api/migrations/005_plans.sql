-- Migration 005 : plans et instrumentation de la monétisation (ContextFlow QR, phase 5)
-- Objectif : poser les coutures, pas un paywall. Tant que `ROUTING_PRO_ONLY`
-- vaut "false", tout le monde garde un comportement strictement gratuit.
--
-- Le runtime de redirection ne lit JAMAIS le plan : une bascule commerciale ne
-- doit pas pouvoir casser un QR deja imprime.

ALTER TABLE utilisateurs
  ADD COLUMN plan TEXT NOT NULL DEFAULT 'gratuit' CHECK (plan IN ('gratuit', 'pro'));

ALTER TABLE utilisateurs ADD COLUMN date_passage_pro TEXT;

-- Instrumentation de l'interet pour l'analytics par variante. Pas de donnee
-- personnelle : uniquement quel compte a consulte l'ecran de stats.
CREATE TABLE IF NOT EXISTS routage_consultations_stats (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  id_utilisateur    INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  date_consultation TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_routage_consultations_utilisateur
  ON routage_consultations_stats (id_utilisateur, date_consultation);
