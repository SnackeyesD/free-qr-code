# UML — Wireframes du Frontend

Ce document présente les maquettes textuelles / ASCII et les descriptions tabulaires des écrans principaux du frontend du SaaS de génération de QR codes. Il s'appuie sur le MCD, le MLD, le MPD, le MCT, le MOT et le MLT.

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Conventions des wireframes](#conventions-des-wireframes)
3. [Ecrans publics](#ecrans-publics)
   - Landing page
   - Inscription
   - Connexion
4. [Ecrans utilisateur](#ecrans-utilisateur)
   - Tableau de bord
   - Création d'un QR code
   - Liste des QR codes
   - Détail / statistiques d'un QR
   - Profil utilisateur
   - Gestion des clés API
5. [Ecrans administrateur](#ecrans-administrateur)
   - Gestion des campagnes email
   - Gestion des modèles

---

## Vue d'ensemble

### Architecture des pages

```text
+-----------------------------------------------------------+
|  HEADER (logo, nav, profil / connexion)                    |
+-----------------------------------------------------------+
|                                                           |
|  CONTENU PRINCIPAL (formulaire, liste, stats, etc.)       |
|                                                           |
+-----------------------------------------------------------+
|  FOOTER (liens, RGPD, contact)                            |
+-----------------------------------------------------------+
```

### Navigation principale par rôle

| Rôle | Pages accessibles |
|------|-------------------|
| Visiteur | Landing page, Inscription, Connexion |
| Utilisateur | Dashboard, Créer QR, Liste QR, Stats QR, Profil, Clés API |
| Administrateur | Toutes les pages utilisateur + Campagnes, Modèles, Admin |

---

## Conventions des wireframes

| Symbole | Signification |
|---------|---------------|
| `[     ]` | Champ de saisie |
| `[ BTN ]` | Bouton cliquable |
| `(o)` / `( )` | Radio bouton sélectionné / non sélectionné |
| `[x]` / `[ ]` | Case à cocher cochée / non cochée |
| `+---+` | Conteneur / carte |
| `|...|` | Contenu d'un bloc |
| `>` | Élément de liste sélectionnable |
| `---` | Séparateur |

---

## Ecrans publics

### Landing page

#### But
Présenter le service gratuit de génération de QR codes et inciter à l'inscription.

#### Wireframe ASCII

```text
+-----------------------------------------------------------+
|  [Logo QR]      Accueil   Fonctionnalités   Tarifs   [Connexion]  [S'inscrire] |
+-----------------------------------------------------------+
|                                                           |
|  +-----------------------------------------------------+  |
|  |                                                     |  |
|  |   Générez des QR codes gratuitement                 |  |
|  |   Dynamiques, statiques, personnalisables             |  |
|  |                                                     |  |
|  |   [ Commencer gratuitement ]                        |  |
|  |                                                     |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  +-------------+  +-------------+  +-------------+        |
|  |  URL        |  |  Wi-Fi      |  |  vCard      |        |
|  |  Texte      |  |  Email      |  |  Téléphone  |        |
|  +-------------+  +-------------+  +-------------+        |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Aperçu QR (générique)    [Télécharger] [Personnaliser] |
|  +-----------------------------------------------------+  |
|                                                           |
+-----------------------------------------------------------+
|  © QR SaaS — Confidentialité — Conditions — Contact         |
+-----------------------------------------------------------+
```

#### Description détaillée

| Zone | Composants | Actions | États | Validations |
|------|------------|---------|-------|-------------|
| Header | Logo, liens de navigation, boutons Connexion / Inscription | Redirection vers `/login`, `/register` | Visiteur non connecté | — |
| Hero | Titre, slogan, CTA principal | Clic → `/register` | Affiché par défaut | — |
| Types de QR | Tuiles de types de contenu | Cliquer met en avant le type | Aucun type sélectionné par défaut | — |
| Aperçu | Image QR générique, boutons Télécharger / Personnaliser | Personnaliser → redirection vers `/register` | Lecture seule | — |
| Footer | Liens légaux | Redirections | — | — |

#### Traitements associés
- T01 — S'inscrire (CTA principal et header)

---

### Inscription

#### But
Créer un compte utilisateur avec consentement marketing explicite.

#### Wireframe ASCII

```text
+-----------------------------------------------------------+
|  [Logo QR]                                [J'ai déjà un compte] |
+-----------------------------------------------------------+
|                                                           |
|  +-----------------------------------------------------+  |
|  |                                                     |  |
|  |   Créer un compte gratuit                           |  |
|  |                                                     |  |
|  |   Nom              [                              ] |  |
|  |   Email            [                              ] |  |
|  |   Mot de passe     [                              ] |  |
|  |   Confirmation     [                              ] |  |
|  |                                                     |  |
|  |   [x] J'accepte de recevoir les emails marketing    |  |
|  |       (obligatoire pour utiliser le service)        |  |
|  |                                                     |  |
|  |        [ S'inscrire ]                               |  |
|  |                                                     |  |
|  +-----------------------------------------------------+  |
|                                                           |
+-----------------------------------------------------------+
```

#### Description détaillée

| Zone | Composants | Actions | États | Validations |
|------|------------|---------|-------|-------------|
| Nom | Input texte | Saisie | Actif / erreur | Obligatoire, ≥ 1 caractère |
| Email | Input email | Saisie | Actif / erreur | Format email valide, unique |
| Mot de passe | Input password | Saisie | Actif / erreur | Politique de force (longueur, complexité) |
| Confirmation | Input password | Saisie | Actif / erreur | Identique au mot de passe |
| Consentement | Checkbox | Clic | Cochée / non cochée | Obligatoire (RG01 / RG08) |
| Bouton inscription | Bouton submit | Soumet le formulaire | Actif / chargement / désactivé | Tous les champs valides |
| Lien connexion | Texte lien | Redirection `/login` | — | — |

#### Messages d'erreur
- Email déjà utilisé → message d'erreur générique ou spécifique selon politique de sécurité.
- Mot de passe trop faible → indicateur de force et exigences affichées.
- Consentement non coché → blocage de la soumission.

#### Traitements associés
- T01 — S'inscrire

---

### Connexion

#### But
Authentifier un utilisateur et établir une session (access + refresh token).

#### Wireframe ASCII

```text
+-----------------------------------------------------------+
|  [Logo QR]                                    [S'inscrire] |
+-----------------------------------------------------------+
|                                                           |
|  +-----------------------------------------------------+  |
|  |                                                     |  |
|  |   Se connecter                                      |  |
|  |                                                     |  |
|  |   Email            [                              ] |  |
|  |   Mot de passe     [                              ] |  |
|  |                                                     |  |
|  |   [ ] Se souvenir de moi                            |  |
|  |                                                     |  |
|  |        [ Connexion ]                                |  |
|  |                                                     |  |
|  |   Mot de passe oublié ?                             |  |
|  |                                                     |  |
|  +-----------------------------------------------------+  |
|                                                           |
+-----------------------------------------------------------+
```

#### Description détaillée

| Zone | Composants | Actions | États | Validations |
|------|------------|---------|-------|-------------|
| Email | Input email | Saisie | Actif / erreur | Format email |
| Mot de passe | Input password | Saisie | Actif / erreur | Non vide |
| Se souvenir de moi | Checkbox | Clic | Cochée / non cochée | Affecte la durée du refresh token |
| Connexion | Bouton submit | Soumet le formulaire | Actif / chargement / désactivé | Tous les champs valides |
| Mot de passe oublié | Lien | Redirection vers `/forgot-password` | — | — |

#### Messages d'erreur
- Identifiants invalides → message générique.
- Compte non vérifié → invitation à renvoyer l'email de confirmation.
- Compte désactivé → message d'erreur spécifique.

#### Traitements associés
- T03 — Se connecter
- T16 — Rafraîchir un access token (silencieux)

---

## Ecrans utilisateur

### Tableau de bord

#### But
Donner une vue synthétique des QR codes, statistiques rapides et actions principales.

#### Wireframe ASCII

```text
+-----------------------------------------------------------+
|  [Logo]  [Dashboard]  [Mes QR]  [Créer]  [⚙]  [Profil ▼] |
+-----------------------------------------------------------+
|                                                           |
|  Bonjour, Jean                                            |
|                                                           |
|  +----------------+  +----------------+  +----------------+ |
|  | QR codes       |  | Scans 7j       |  | Scans uniques  | |
|  | 12             |  | 1 234          |  | 876            | |
|  +----------------+  +----------------+  +----------------+ |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  QR codes récents                                   |  |
|  |                                                     |  |
|  |  > [QR] Site web   https://...   456 scans   [⋯]   |  |
|  |  > [QR] Wi-Fi      WIFI:S:...    89 scans    [⋯]   |  |
|  |  > [QR] Contact    BEGIN:VCARD   23 scans    [⋯]   |  |
|  |                                                     |  |
|  |        [ Voir tous mes QR codes ]                   |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Activité des 7 derniers jours (graphique)          |  |
|  |  ████░░░░░█████░░░░░░░████░░░░░█████░              |  |
|  +-----------------------------------------------------+  |
|                                                           |
+-----------------------------------------------------------+
```

#### Description détaillée

| Zone | Composants | Actions | États | Validations |
|------|------------|---------|-------|-------------|
| Header | Logo, navigation principale, menu profil | Redirections, ouverture menu | Connecté | — |
| Cartes KPI | 3 cartes récapitulatives | Aucune action directe | Données chargées / vide / chargement | — |
| QR récents | Liste des 3 derniers QR codes | Clic → détail, bouton actions [⋯] | Liste vide → CTA création | Appartenance à l'utilisateur |
| Graphique activité | Histogramme des 7 derniers jours | Survol → tooltip | Sans données → message d'incitation | Période fixe 7j |

#### Traitements associés
- T06 — Lister ses QR codes
- T10 — Consulter les statistiques d'un QR code (agrégations)

---

### Création d'un QR code

#### But
Permettre à l'utilisateur de générer un QR code (statique ou dynamique) avec personnalisation.

#### Wireframe ASCII

```text
+-----------------------------------------------------------+
|  [Logo]  [Dashboard]  [Mes QR]  [Créer]  [⚙]  [Profil ▼] |
+-----------------------------------------------------------+
|                                                           |
|  +------------------------+  +------------------------+   |
|  |  Type de contenu       |  |  Aperçu                |   |
|  |                        |  |                        |   |
|  |  (o) URL               |  |  +------------------+  |   |
|  |  ( ) Texte             |  |  |                  |  |   |
|  |  ( ) Email             |  |  |   [QR PREVIEW]   |  |   |
|  |  ( ) Téléphone         |  |  |                  |  |   |
|  |  ( ) SMS               |  |  +------------------+  |   |
|  |  ( ) Wi-Fi             |  |                        |   |
|  |  ( ) vCard             |  |  [ Télécharger PNG ]   |   |
|  |  ( ) Géo               |  |  [ Télécharger SVG ]   |   |
|  |  ( ) PDF               |  |                        |   |
|  +------------------------+  +------------------------+   |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Contenu                                            |  |
|  |  URL [ https://www.exemple.com                    ] |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Options                                            |  |
|  |  [x] QR dynamique (modifiable après impression)     |  |
|  |  Taille [ 300 px  ▼]  Correction [ M  ▼]           |  |
|  |  Couleur principale [ █ #000000 ]                   |  |
|  |  Couleur fond       [ █ #FFFFFF ]                   |  |
|  |  Logo [ Choisir un fichier ]                        |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  [ Générer le QR code ]                                   |
|                                                           |
+-----------------------------------------------------------+
```

#### Description détaillée

| Zone | Composants | Actions | États | Validations |
|------|------------|---------|-------|-------------|
| Type de contenu | Liste de radio boutons | Change le formulaire de contenu | URL sélectionnée par défaut | Un type obligatoire |
| Contenu | Input adapté au type (URL, textarea, formulaire vCard, etc.) | Saisie | Actif / erreur | Validation selon le type (T04 / validerContenuSelonType) |
| QR dynamique | Checkbox | Active / désactive le mode dynamique | Décochée par défaut | — |
| Options graphiques | Select taille, correction, picker couleur, upload logo | Personnalisation | Valeurs par défaut | Logo ≤ taille max, format image |
| Aperçu | Canvas / image QR | Se rafraîchit à chaque changement validé | Génération en cours / erreur | Aperçu uniquement après validation |
| Téléchargements | Boutons PNG / SVG | Téléchargement | Actif après génération | — |
| Générer | Bouton principal | Soumet le formulaire | Actif / chargement / désactivé | Contenu valide |

#### Messages d'erreur
- URL invalide → message sous le champ.
- Téléphone invalide → message sous le champ.
- Alias court déjà existant → rare, message technique générique.

#### Traitements associés
- T04 — Générer un QR code
- T13 — Gérer les modèles de QR (choix d'un modèle optionnel, pourrait être ajouté dans une v2)

---

### Liste des QR codes

#### But
Afficher, rechercher, filtrer et gérer tous les QR codes de l'utilisateur.

#### Wireframe ASCII

```text
+-----------------------------------------------------------+
|  [Logo]  [Dashboard]  [Mes QR]  [Créer]  [⚙]  [Profil ▼] |
+-----------------------------------------------------------+
|                                                           |
|  Mes QR codes                                  [ + Nouveau ] |
|                                                           |
|  Rechercher [                    ]  Type [ Tous ▼]  Actif [ Tous ▼] |
|                                                           |
|  +-----------------------------------------------------+  |
|  | [QR] Site officiel      URL     456 scans  Actif  [⋯] |  |
|  +-----------------------------------------------------+  |
|  +-----------------------------------------------------+  |
|  | [QR] Carte visite       vCard    89 scans  Actif  [⋯] |  |
|  +-----------------------------------------------------+  |
|  +-----------------------------------------------------+  |
|  | [QR] Menu Wi-Fi         Wi-Fi    12 scans  Inactif [⋯] |  |
|  +-----------------------------------------------------+  |
|  +-----------------------------------------------------+  |
|  | [QR] Promo été 2024     URL     0 scan     Actif   [⋯] |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  < 1 2 3 ... 10 >                                       |
|                                                           |
+-----------------------------------------------------------+
```

#### Description détaillée

| Zone | Composants | Actions | États | Validations |
|------|------------|---------|-------|-------------|
| Titre + CTA | Titre, bouton Nouveau | Redirection vers `/qr/create` | — | — |
| Barre de filtres | Input recherche, select type, select statut | Filtrage côté serveur / client | Recherche debounced | — |
| Liste | Cartes de QR | Clic → détail, menu [⋯] → modifier, désactiver, supprimer, dupliquer | Chargement / vide / paginée | Appartenance utilisateur |
| Pagination | Composant de pages | Change de page | Page active | — |
| Menu actions | Options par QR | Modifier (si dynamique), Désactiver/Activer, Supprimer, Voir stats | — | RG03 (statique non modifiable) |

#### États d'un QR dans la liste
- Actif : QR fonctionnel.
- Inactif : QR désactivé par l'utilisateur (RG06).
- Expiré : date d'expiration dépassée.

#### Traitements associés
- T06 — Lister ses QR codes
- T05 — Modifier un QR code dynamique
- T07 — Désactiver / supprimer un QR code
- T10 — Consulter les statistiques

---

### Détail / statistiques d'un QR code

#### But
Afficher les informations d'un QR, son aperçu, ses statistiques et permettre l'export.

#### Wireframe ASCII

```text
+-----------------------------------------------------------+
|  [Logo]  [Dashboard]  [Mes QR]  [Créer]  [⚙]  [Profil ▼] |
+-----------------------------------------------------------+
|                                                           |
|  < Retour à la liste                                      |
|  Site officiel                                [ Modifier ] [ Désactiver ] |
|  Type : URL | Statique | Créé le 12/06/2024            |
|                                                           |
|  +------------------------+  +------------------------+   |
|  |                        |  |  Résumé                |   |
|  |   [QR IMAGE]           |  |                        |   |
|  |                        |  |  Total scans   456     |   |
|  |                        |  |  Uniques       321     |   |
|  |                        |  |  Dernier scan  Aujourd'hui |   |
|  +------------------------+  +------------------------+   |
|  [ Télécharger PNG ] [ Télécharger SVG ] [ Copier lien ]   |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Période : [ 7 jours ▼]  [ Exporter CSV ] [ Exporter XLSX ] |
|  |                                                     |  |
|  |  Évolution des scans                                |  |
|  |  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░      |  |
|  |                                                     |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  +------------------------+  +------------------------+   |
|  |  Top pays              |  |  Top appareils         |   |
|  |  🇫🇷 France  45%       |  |  Mobile  65%           |   |
|  |  🇺🇸 USA  20%          |  |  Desktop 30%           |   |
|  |  🇩🇪 Allemagne  15%    |  |  Tablette 5%           |   |
|  +------------------------+  +------------------------+   |
|                                                           |
+-----------------------------------------------------------+
```

#### Description détaillée

| Zone | Composants | Actions | États | Validations |
|------|------------|---------|-------|-------------|
| En-tête | Nom, type, statut, dates, boutons Modifier / Désactiver | Action selon le type de QR | Statique → bouton Modifier masqué (RG03) | Appartenance utilisateur |
| Aperçu QR | Image, boutons téléchargement et copie lien | Téléchargement, copie | Généré / en chargement | — |
| Résumé | KPI total scans, uniques, dernier scan | — | Chargé / vide | — |
| Période | Select période | 7j, 30j, 1an | 7j par défaut | — |
| Graphique évolution | Ligne / histogramme | Survol tooltip | Sans données | Période choisie |
| Export | Boutons CSV, XLSX, JSON | Téléchargement | Actif | T15 — Exporter les statistiques |
| Top pays | Camembert / tableau | — | Sans données → message | — |
| Top appareils | Camembert / tableau | — | Sans données → message | — |

#### Traitements associés
- T10 — Consulter les statistiques d'un QR code
- T05 — Modifier un QR code dynamique
- T07 — Désactiver / supprimer un QR code
- T15 — Exporter les statistiques

---

### Profil utilisateur

#### But
Permettre à l'utilisateur de gérer ses informations, son consentement marketing et ses sessions.

#### Wireframe ASCII

```text
+-----------------------------------------------------------+
|  [Logo]  [Dashboard]  [Mes QR]  [Créer]  [⚙]  [Profil ▼] |
+-----------------------------------------------------------+
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Informations du compte                             |  |
|  |                                                     |  |
|  |  Nom        [ Jean Dupont                         ] |  |
|  |  Email      [ jean@exemple.com   ]  [Vérifié ✓]     |  |
|  |                                                     |  |
|  |  [ Enregistrer les modifications ]                  |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Préférences                                        |  |
|  |  Langue [ Français ▼]                               |  |
|  |  Thème  [ Clair ▼]                                  |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Marketing et confidentialité                       |  |
|  |                                                     |  |
|  |  [x] J'accepte de recevoir les emails marketing     |  |
|  |      (modifié le 15/06/2024)                        |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Sécurité                                           |  |
|  |  [ Modifier le mot de passe ]                       |  |
|  |  [ Gérer mes clés API ]                             |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Sessions actives                                   |  |
|  |  Chrome — Windows — 12/06/2024  [Révoquer]          |  |
|  |  Safari — iOS — 10/06/2024        [Révoquer]        |  |
|  +-----------------------------------------------------+  |
|                                                           |
+-----------------------------------------------------------+
```

#### Description détaillée

| Zone | Composants | Actions | États | Validations |
|------|------------|---------|-------|-------------|
| Informations | Inputs nom, email, badge vérification | Enregistrer les modifications | Lecture / édition | Email unique, format valide |
| Préférences | Select langue, thème | Changement immédiat | Sauvegardé | — |
| Marketing | Checkbox consentement | Clic → mise à jour | Cochée / non cochée avec date de consentement | RG08 / RGPD |
| Sécurité | Liens / boutons | Redirection vers changement de mot de passe, clés API | — | — |
| Sessions | Liste des refresh tokens actifs | Révoquer une session | Active / révoquée | Appartenance à l'utilisateur |

#### Traitements associés
- T17 — Révoquer une session
- T14 — Gérer les clés API (lien vers écran dédié)
- Mise à jour profil (non détaillé dans MCT, lié à `preferences`)

---

### Gestion des clés API

#### But
Permettre à l'utilisateur de créer et révoquer des clés API pour l'intégration externe.

#### Wireframe ASCII

```text
+-----------------------------------------------------------+
|  [Logo]  [Dashboard]  [Mes QR]  [Créer]  [⚙]  [Profil ▼] |
+-----------------------------------------------------------+
|                                                           |
|  Mes clés API                                   [ + Nouvelle clé ] |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Intégration site web                               |  |
|  |  Permissions : qrcodes:read, qrcodes:create         |  |
|  |  Créée le 01/06/2024 — Dernière utilisation : hier  |  |
|  |  [ Révoquer ]                                       |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Application mobile                                 |  |
|  |  Permissions : qrcodes:read                         |  |
|  |  Créée le 15/05/2024 — Expire le 15/05/2025         |  |
|  |  [ Révoquer ]                                       |  |
|  +-----------------------------------------------------+  |
|                                                           |
+-----------------------------------------------------------+
```

#### Modale de création de clé

```text
+-----------------------------------------------------+
|  Nouvelle clé API                                   |
|                                                     |
|  Nom            [                                 ] |
|  Expiration     [ Aucune ▼]                         |
|  Permissions :                                      |
|  [x] qrcodes:read                                   |
|  [x] qrcodes:create                                 |
|  [ ] qrcodes:update                                 |
|  [ ] qrcodes:delete                                 |
|  [ ] stats:read                                     |
|                                                     |
|  [ Créer ]                                          |
+-----------------------------------------------------+
```

#### Description détaillée

| Zone | Composants | Actions | États | Validations |
|------|------------|---------|-------|-------------|
| Liste des clés | Cartes avec nom, permissions, dates, bouton révoquer | Révoquer | Active / expirée | Appartenance utilisateur |
| Nouvelle clé | Bouton ouvrant une modale | Ouvrir le formulaire | — | — |
| Formulaire | Nom, expiration, checkboxes permissions | Créer | Nom requis, au moins une permission | T14 |
| Affichage clé brute | Modale d'affichage unique | Copier la clé | Affichée une seule fois | Clé stockée hashée côté backend |

#### Traitements associés
- T14 — Gérer les clés API

---

## Ecrans administrateur

### Gestion des campagnes email

#### But
Permettre aux administrateurs de créer, programmer et suivre les campagnes email marketing.

#### Wireframe ASCII

```text
+-----------------------------------------------------------+
|  [Logo]  [Admin]  [Campagnes]  [Modèles]  [Profil ▼]      |
+-----------------------------------------------------------+
|                                                           |
|  Campagnes email                                [ + Nouvelle ] |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  Newsletter juin 2024                               |  |
|  |  Statut : Envoyée | Cible : Tous | 12/06/2024       |  |
|  |  Ouvertures : 45% | Clics : 12%                     |  |
|  |  [ Dupliquer ] [ Annuler ] [ Stats ]                |  |
|  +-----------------------------------------------------+  |
|  +-----------------------------------------------------+  |
|  |  Relance inscription                                  |  |
|  |  Statut : Programmée | Cible : Non vérifiés         |  |
|  |  Envoi prévu : 15/06/2024 09:00                     |  |
|  |  [ Modifier ] [ Envoyer maintenant ] [ Annuler ]    |  |
|  +-----------------------------------------------------+  |
|                                                           |
+-----------------------------------------------------------+
```

#### Formulaire de création de campagne

```text
+-----------------------------------------------------+
|  Nouvelle campagne email                            |
|                                                     |
|  Titre (objet)  [                                 ] |
|  Cible          [ Tous ▼]                           |
|  Programmation  (o) Envoi immédiat                |
|                   ( ) Programmée : [Date] [Heure]   |
|                                                     |
|  Contenu HTML [Éditeur riche]                       |
|                                                     |
|  [x] Inclure le lien de désinscription obligatoire  |
|                                                     |
|  [ Enregistrer brouillon ] [ Programmer / Envoyer ] |
+-----------------------------------------------------+
```

#### Description détaillée

| Zone | Composants | Actions | États | Validations |
|------|------------|---------|-------|-------------|
| Liste campagnes | Cartes avec statut, cible, métriques, actions | Dupliquer, annuler, envoyer, stats | Brouillon / Programmée / Envoyée / Annulée | Rôle admin |
| Formulaire | Titre, cible, programmation, éditeur HTML | Enregistrer ou envoyer | — | Lien de désinscription obligatoire (T11) |
| Programmation | Radio envoi immédiat ou programmé | Affichage date/heure si programmé | — | dateEnvoi > maintenant |
| Stats campagne | Ouvertures, clics, taux | — | Mise à jour par T18 | — |

#### Traitements associés
- T11 — Créer une campagne email
- T12 — Programmer / envoyer une campagne email
- T18 — Enregistrer un événement de tracking email

---

### Gestion des modèles de QR

#### But
Permettre aux administrateurs de créer et gérer les modèles publics ou privés de QR codes.

#### Wireframe ASCII

```text
+-----------------------------------------------------------+
|  [Logo]  [Admin]  [Campagnes]  [Modèles]  [Profil ▼]      |
|-----------------------------------------------------------|
|                                                           |
|  Modèles de QR codes                            [ + Nouveau ] |
|                                                           |
|  +-----------------------------------------------------+  |
|  |  🌐 Site web standard                             |  |
|  |  Type : URL | Public : Oui                         |  |
|  |  [ Modifier ] [ Supprimer ] [ Aperçu ]              |  |
|  +-----------------------------------------------------+  |
|  +-----------------------------------------------------+  |
|  |  📶 Wi-Fi restaurant                                |  |
|  |  Type : Wi-Fi | Public : Oui                        |  |
|  |  [ Modifier ] [ Supprimer ] [ Aperçu ]              |  |
|  +-----------------------------------------------------+  |
|  +-----------------------------------------------------+  |
|  |  📇 Carte de visite pro                             |  |
|  |  Type : vCard | Public : Non                        |  |
|  |  [ Modifier ] [ Supprimer ] [ Aperçu ]              |  |
|  +-----------------------------------------------------+  |
|                                                           |
+-----------------------------------------------------------+
```

#### Formulaire de modèle

```text
+-----------------------------------------------------+
|  Modèle de QR code                                  |
|                                                     |
|  Nom            [                                 ] |
|  Description    [                                 ] |
|  Type de contenu [ URL ▼]                           |
|  Public         [x] Visible par tous les utilisateurs |
|                                                     |
|  Paramètres par défaut :                            |
|  Taille [ 300 ▼]  Correction [ M ▼]                 |
|  Couleurs...                                        |
|                                                     |
|  [ Enregistrer ]                                    |
+-----------------------------------------------------+
```

#### Description détaillée

| Zone | Composants | Actions | États | Validations |
|------|------------|---------|-------|-------------|
| Liste modèles | Cartes avec nom, type, visibilité, actions | Modifier, supprimer, aperçu | Public / Privé | Rôle admin |
| Formulaire | Nom, description, type, visibilité, paramètres par défaut | Enregistrer | Création / édition | Nom requis, type valide, paramètres JSON valides |
| Aperçu | Image QR générée à partir des paramètres par défaut | Rafraîchissement | Aperçu en direct | — |

#### Traitements associés
- T13 — Gérer les modèles de QR

---

## Matrice des écrans et traitements MCT

| Écran | Traitements MCT associés | Acteur principal |
|-------|--------------------------|------------------|
| Landing page | T01 | Visiteur |
| Inscription | T01 | Visiteur |
| Connexion | T03, T16 | Utilisateur |
| Tableau de bord | T06, T10 | Utilisateur |
| Création de QR code | T04 | Utilisateur |
| Liste des QR codes | T06, T05, T07, T10 | Utilisateur |
| Détail / statistiques d'un QR | T10, T05, T07, T15 | Utilisateur |
| Profil utilisateur | T17 (sessions) | Utilisateur |
| Clés API | T14 | Utilisateur |
| Campagnes email (admin) | T11, T12, T18 | Administrateur |
| Modèles de QR (admin) | T13 | Administrateur |

---

## Règles de gestion UI/UX dérivées des RG

| Code | Règle de gestion | Impact UI/UX |
|------|------------------|--------------|
| RG01 | Inscription obligatoire pour générer un QR | Les CTAs de génération redirigent vers l'inscription quand l'utilisateur n'est pas connecté. |
| RG03 | QR statique immuable | Le bouton "Modifier" est masqué sur la page de détail d'un QR statique. |
| RG04 | QR dynamique modifiable | La page de détail affiche un bouton "Modifier la cible" pour les QR dynamiques. |
| RG06 | Activation/désactivation par l'utilisateur | Chaque carte de QR dispose d'une action "Activer / Désactiver". |
| RG07 | Modèle public réutilisable | Les modèles publics apparaissent dans la galerie de création (v2). |
| RG08 | Consentement marketing explicite | Checkbox obligatoire et traçable à l'inscription et dans le profil. |
| RG09 | Statistiques agrégées quotidiennement | Le graphique par défaut affiche les agrégats journaliers. |
| RG10 | Clé API expirable | Affichage de la date d'expiration et badge "Expirée" dans la liste. |

---

## Notes d'implémentation frontend

- **Stack** : React + Vite, cohérent avec le MOT et le MCD.
- **Authentification** : Access token JWT stocké en mémoire, refresh token en cookie `httpOnly` ou via `localStorage` selon choix de sécurité.
- **Rafraîchissement token** : T16 déclenché silencieusement avant expiration ou sur erreur 401.
- **Génération de QR** : L'aperçu est calculé côté client si possible, ou via un appel API `/qr/preview`.
- **Export** : Les boutons d'export déclenchent T15 et ouvrent un téléchargement de fichier.
- **Tracking** : T18 est invisible pour l'utilisateur ; les pixels et liens trackés sont injectés dans les emails par le backend.
- **Responsive** : Tous les wireframes doivent s'adapter en colonne unique sur mobile.

---

## Wireframe responsive mobile (exemple : tableau de bord)

```text
+----------------+
| ≡  [Logo]  [👤] |
+----------------+
|                |
| Bonjour, Jean  |
|                |
| +------------+ |
| | QR codes   | |
| | 12         | |
| +------------+ |
| +------------+ |
| | Scans 7j   | |
| | 1 234      | |
| +------------+ |
| +------------+ |
| | Uniques    | |
| | 876        | |
| +------------+ |
|                |
| QR récents     |
| > Site web...  |
| > Wi-Fi...     |
| > Contact...   |
|                |
| [ + Nouveau ]  |
|                |
+----------------+
```

