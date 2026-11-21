-- Migration 007 : galerie de modèles QR publics.
--
-- Modèles de design proposés à tous les utilisateurs connectés. Ils ne
-- contiennent aucun contenu utilisateur : seule la palette, la taille et le
-- niveau de correction sont préremplis dans le formulaire de création.
-- `id_utilisateur` reste NULL : ce sont des presets de la plateforme.

INSERT OR IGNORE INTO modeles (
  public_id,
  id_utilisateur,
  nom,
  description,
  type_contenu,
  parametres_par_defaut,
  est_public,
  date_creation
) VALUES
  (
    'f0000000-0000-4000-8000-000000000001',
    NULL,
    'Classique',
    'Noir sur blanc, lisible partout. Idéal pour un premier QR code.',
    'url',
    '{"couleur":"#000000","background":"#FFFFFF","taille":400,"correction":"M","cadre":false}',
    1,
    '2026-11-08 10:00:00'
  ),
  (
    'f0000000-0000-4000-8000-000000000002',
    NULL,
    'Corporate bleu',
    'Bleu sobre pour supports professionnels, signatures et présentations.',
    'url',
    '{"couleur":"#1A73E8","background":"#FFFFFF","taille":400,"correction":"H","cadre":false}',
    1,
    '2026-11-07 10:00:00'
  ),
  (
    'f0000000-0000-4000-8000-000000000003',
    NULL,
    'Événement',
    'Rose vif pour badges, affiches et programmes d''événement.',
    'url',
    '{"couleur":"#DB2777","background":"#FFF1F2","taille":400,"correction":"Q","cadre":true}',
    1,
    '2026-11-06 10:00:00'
  ),
  (
    'f0000000-0000-4000-8000-000000000004',
    NULL,
    'Wi-Fi maison',
    'Vert apaisant pour partager un réseau Wi-Fi avec ses invités.',
    'wifi',
    '{"couleur":"#0F766E","background":"#F0FDFA","taille":400,"correction":"M","cadre":false}',
    1,
    '2026-11-05 10:00:00'
  ),
  (
    'f0000000-0000-4000-8000-000000000005',
    NULL,
    'Carte de visite',
    'Indigo élégant pour un QR de contact professionnel.',
    'vcard',
    '{"couleur":"#4F46E5","background":"#EEF2FF","taille":400,"correction":"H","cadre":true}',
    1,
    '2026-11-04 10:00:00'
  ),
  (
    'f0000000-0000-4000-8000-000000000006',
    NULL,
    'Menu restaurant',
    'Ambre chaleureux pour menus, cartes de plats et documents PDF.',
    'pdf',
    '{"couleur":"#B45309","background":"#FFFBEB","taille":400,"correction":"M","cadre":false}',
    1,
    '2026-11-03 10:00:00'
  ),
  (
    'f0000000-0000-4000-8000-000000000007',
    NULL,
    'Point de rendez-vous',
    'Bleu carte pour itinéraires et coordonnées géographiques.',
    'geo',
    '{"couleur":"#2563EB","background":"#EFF6FF","taille":400,"correction":"M","cadre":false}',
    1,
    '2026-11-02 10:00:00'
  ),
  (
    'f0000000-0000-4000-8000-000000000008',
    NULL,
    'Note sobre',
    'Contraste doux pour notes, consignes et messages courts.',
    'texte',
    '{"couleur":"#111827","background":"#F9FAFB","taille":400,"correction":"Q","cadre":false}',
    1,
    '2026-11-01 10:00:00'
  );
