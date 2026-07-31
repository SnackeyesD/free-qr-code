# 12 — Sécurité et conformité RGPD

## 1. Contexte et objectifs

Ce document présente le plan de sécurité et la stratégie de conformité au RGPD du SaaS **Free QR Code**. Il s’appuie sur les modèles MERISE et UML existants : MCD, MLD, MPD, MCT, MOT, MLT, wireframes, séquences, navigation, architecture et spécification OpenAPI.

**Objectifs :**

- Identifier les principales menaces sécuritaires.
- Définir les mesures techniques et organisationnelles de protection.
- Formaliser la politique d’authentification, de mots de passe et de gestion des sessions.
- Protéger contre les attaques courantes (XSS, CSRF, injection, open redirect, etc.).
- Établir les fondements RGPD : consentement, droits des personnes, durées de conservation, sous-traitants et registre des traitements.
- Fournir des fiches de sécurité par traitement critique.

---

## 2. Menaces identifiées

| Code | Menace | Description | Impact potentiel | Source principale |
|------|--------|-------------|------------------|-------------------|
| M01 | Vol de compte | Brute-force, phishing ou vol de credentials | Fuite de données, modification/suppression de QR, envoi de campagnes | Authentification |
| M02 | Fuite de données personnelles | Extraction non autorisée de profils, emails, scans | Atteinte à la vie privée, sanction RGPD | Base de données, API |
| M03 | Accès non autorisé à un QR ou ses statistiques | IDOR (manipulation d’ID) | Divulgation d’URLs, métriques privées, modification cible | Routes `/qrcodes/{id}` |
| M04 | Injection NoSQL / MongoDB | Requêtes malformées exploitant les opérateurs MongoDB | Fuite ou modification de données | Validation entrées |
| M05 | XSS | Injection de scripts dans le contenu QR, modèles ou campagnes | Vol de session, redirection malveillante | Contenu utilisateur, emails |
| M06 | CSRF | Action non désirée sur l’API via la session d’un utilisateur | Modification de compte, suppression de QR | Formulaires / API |
| M07 | Open redirect | Redirection vers un domaine externe malveillant | Phishing via les QR dynamiques | Redirection `/q/{aliasCourt}` |
| M08 | Abus d’API / déni de service | Surconsommation, spam, brute-force | Indisponibilité, coûts excessifs | Tous les endpoints |
| M09 | Fuite de secrets | Exposition de JWT secrets, clés API, credentials SMTP | Compromission totale de l’infrastructure | Configuration, CI/CD |
| M10 | Interception réseau | Sniffing non chiffré | Vol de tokens ou de données | Réseau |
| M11 | Traçage non consenti | Tracking email ou scan sans consentement | Violation RGPD, spam | Campagnes, scans |
| M12 | Élévation de privilèges | Auto-promotion ou manipulation du rôle `admin` | Accès admin non autorisé | Contrôle d’accès |

---

## 3. Mesures techniques de sécurité

### 3.1 Authentification et autorisation

| Mesure | Implémentation | Référence documents |
|--------|---------------|---------------------|
| JWT access token | Signé HS256 ou RS256, durée **15 minutes**, payload minimal `{idUtilisateur, role, jti}` | MLT T03, MLT T16, Architecture |
| Refresh token | Opaque, durée **7 jours**, stocké hashé (SHA256) dans `refresh_tokens`, révocable | MLT T03, MLT T16, MLT T17 |
| Rôle `admin` | Attribué manuellement en base ; aucun endpoint ne permet l’auto-promotion | MOT CO07, MLT T11 |
| Propriété des ressources | Vérification systématique de `idUtilisateur` pour les QR, stats, clés API, sessions | MLT T05, T06, T07, T10, T14 |
| MFA (évolution) | Recommandé pour les comptes administrateurs via OTP | — |

### 3.2 Chiffrement

| Donnée | Chiffrement / protection |
|--------|--------------------------|
| Mots de passe | `bcrypt` avec coût ≥ 12 |
| Tokens email, refresh tokens, clés API | Hash SHA256 en base ; le secret brut n’est jamais stocké |
| Communications | HTTPS uniquement (TLS 1.2+) ; HSTS activé |
| Données en transit MongoDB | TLS activé sur MongoDB Atlas |
| Images QR | Stockées sur R2 ; pas de chiffrement au repos requis pour des images publiques, URLs signées si usage privé |
| Secrets applicatifs | Gérés via `wrangler secret` et variables GitHub chiffrées |

### 3.3 Validation des entrées

- Toutes les entrées API sont validées avec **Zod** (ou équivalent) avant tout traitement.
- Les types de contenu QR (`url`, `email`, `telephone`, `sms`, `wifi`, `vcard`, `geo`, `pdf`, `texte`) sont validés par la fonction `validerContenuSelonType` (MLT).
- Les identifiants MongoDB sont castés en `ObjectId` et jamais injectés dans des requêtes sous forme de chaîne brute.
- Les requêtes `find`, `update`, `delete` utilisent des filtres explicitement typés (pas de `eval` ni de concaténation dynamique).
- Les URLs de redirection (`contenu` d’un QR dynamique) sont validées contre une liste de protocoles autorisés (`http:`, `https:`).

### 3.4 CORS

- Les en-têtes CORS sont restreints aux domaines autorisés :
  - `https://*.free-qrcode.app`
  - `https://free-qrcode.app`
  - `http://localhost:5173` (développement uniquement)
- Les credentials (`cookies`) ne sont acceptés que sur les origines autorisées.
- Les routes publiques (`/q/{aliasCourt}`, `/tracking/*`) sont en `access-control-allow-origin: *` sans credentials.

### 3.5 Rate limiting

| Ressource | Limite | Mécanisme |
|-----------|--------|-----------|
| Inscription, login | 5 requêtes / minute / IP | KV Cloudflare avec TTL 60 s |
| Génération de QR | 20 requêtes / minute / compte | KV + middleware |
| Redirection `/q/*` | 100 requêtes / minute / IP | KV |
| API authentifiée | 1000 requêtes / minute / compte | KV |
| Envoi de campagnes | Limité par le rate du SMTP maison | Nodemailer avec file d’attente |
| API publique clés API | 100 requêtes / minute / clé | KV |

### 3.6 Anonymisation

- Les adresses IP des scans et des sessions sont anonymisées avant stockage : masquage du dernier octet IPv4 (ex : `192.168.x.x`) et du dernier hextet IPv6.
- Les tokens de tracking email sont dissociés de l’identifiant direct ; seuls les événements agrégés sont exposés aux administrateurs.
- Les données de `campagnes_utilisateurs` sont consultées à des fins statistiques uniquement, sans profilage individuel.

### 3.7 Sécurité des cookies

- `httpOnly` : empêche l’accès JavaScript au refresh token.
- `Secure` : transmission HTTPS uniquement.
- `SameSite=Lax` pour le refresh token, `SameSite=Strict` si compatible UX.
- Durée limitée à la durée du refresh token (7 jours).
- Révocation côté serveur à la déconnexion.

---

## 4. Politique des mots de passe et tokens

### 4.1 Mots de passe

| Règle | Valeur |
|-------|--------|
| Longueur minimale | 12 caractères |
| Complexité | Au moins une majuscule, une minuscule, un chiffre, un caractère spécial |
| Hachage | `bcrypt` coût 12 minimum |
| Rotation forcée | Non recommandée (NIST) ; modification en cas de suspicion de compromission |
| Réinitialisation | Token unique à usage unique, valable 1 heure, hashé en base |
| Stockage | Aucun mot de passe en clair, ni en base ni dans les logs |

### 4.2 Tokens

| Token | Durée | Stockage | Révocation |
|-------|-------|----------|------------|
| Access token JWT | 15 minutes | Mémoire frontend / header Authorization | Nécessite une nouvelle connexion |
| Refresh token | 7 jours | Cookie httpOnly + base hashée | Révocation via `/auth/sessions/{tokenHash}` |
| Token email vérification | 24 heures | Hash SHA256 en `tokens_email` | Usage unique |
| Token réinitialisation mot de passe | 1 heure | Hash SHA256 en `tokens_email` | Usage unique |
| Clé API | 1 an max (configurable) | Hash SHA256 en `cles_api` | Suppression / révocation via interface |
| Token de tracking email | Durée de vie de la campagne | En clair dans les liens/pixels (non sensible seul) | Expiration liée à la campagne |

### 4.3 Gestion des sessions

- Une session = un refresh token dans `refresh_tokens` avec `userAgent`, IP anonymisée, dates de création/expiration.
- L’utilisateur peut lister ses sessions actives et révoquer n’importe laquelle.
- La déconnexion révoque le refresh token courant côté serveur.
- Les tokens expirés sont automatiquement purgés via index TTL MongoDB (`expireAfterSeconds: 0` sur `dateExpiration`).

---

## 5. Protection contre les attaques courantes

### 5.1 XSS (Cross-Site Scripting)

- Échappement systématique des données utilisateur affichées dans le frontend (React le fait par défaut via JSX).
- Interdiction des balises `<script>` et des événements `on*` dans le contenu des campagnes emails et des modèles.
- Sanitisation du HTML des campagnes avec une bibliothèque comme DOMPurify côté serveur.
- En-tête `Content-Security-Policy` (CSP) strict :

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';
```

### 5.2 CSRF (Cross-Site Request Forgery)

- Utilisation de tokens JWT dans le header `Authorization` plutôt que de cookies pour les mutations sensibles.
- Cookies `SameSite=Lax` ou `Strict`.
- Vérification de l’en-tête `Origin` sur les endpoints sensibles.
- Pas de mutation significative via `GET`.

### 5.3 Injection NoSQL / SQL

- Validation Zod de toutes les entrées.
- Utilisation du driver MongoDB natif avec requêtes paramétrées (pas de chaîne de requête dynamique).
- Interdiction des opérateurs MongoDB dans les entrées utilisateurs (ex : `$where`, `$ne`, `$gt`).
- Cast explicite en `ObjectId` pour les identifiants.

### 5.4 Open redirect

- Validation stricte des URLs de redirection pour les QR dynamiques (`contenu` doit être une URL absolue `http` ou `https`).
- Interdiction des protocoles `javascript:`, `data:`, `file:`.
- Les redirections internes (post-login, post-logout) utilisent une liste blanche de routes.

### 5.5 Brute-force et credential stuffing

- Rate limiting sur `/auth/login`, `/auth/register`, `/auth/reset-password`.
- Message d’erreur générique pour les identifiants invalides (ne pas distinguer email inexistant / mot de passe incorrect).
- Possibilité de verrouiller temporairement un compte après 5 échecs consécutifs (évolution).

### 5.6 Dénis de service (DoS)

- Rate limiting par IP et par compte.
- Limitation de la taille des payloads (ex : 1 Mo max pour les requêtes API).
- Cache Cloudflare sur les assets statiques et les images R2.
- Génération d’image QR limitée en taille (ex : 2000 px max) pour éviter les abus mémoire.

### 5.7 Fuite d’informations

- Les réponses API ne renvoient jamais les hashes de mot de passe, les secrets JWT ni les clés API brutes (sauf à la création).
- Les messages d’erreur ne divulguent pas la structure interne de la base.
- Les logs ne contiennent pas de tokens, mots de passe, ni emails en clair si possible (anonymisation partielle).

---

## 6. Conformité RGPD

### 6.1 Base légale et finalités

| Traitement | Finalité | Base légale |
|------------|----------|-------------|
| Inscription et authentification | Créer et sécuriser le compte | Exécution du contrat (art. 6.1.b) |
| Génération et gestion des QR codes | Fournir le service de QR codes | Exécution du contrat (art. 6.1.b) |
| Redirection et enregistrement des scans | Fonctionnement des QR dynamiques et statistiques | Intérêt légitime (art. 6.1.f) avec anonymisation |
| Envoi d’emails transactionnels | Confirmer l’email, réinitialiser le mot de passe | Exécution du contrat (art. 6.1.b) |
| Campagnes marketing | Envoyer des newsletters / communications | Consentement explicite (art. 6.1.a) |
| Tracking emails | Mesurer l’efficacité des campagnes | Consentement (art. 6.1.a) |
| Statistiques agrégées | Améliorer le service | Intérêt légitime (art. 6.1.f) |

### 6.2 Consentement

- Le consentement marketing est recueilli de manière **explicite, libre et spécifique** lors de l’inscription via une case à cocher décochée par défaut.
- La date du consentement est horodatée (`dateConsentementMarketing`).
- L’utilisateur peut modifier son consentement à tout moment dans `/dashboard/settings`.
- Une campagne email ne peut être envoyée qu’aux utilisateurs avec `consentementMarketing = true`.
- Chaque email marketing contient un lien de désinscription clair.

### 6.3 Droits des personnes

| Droit | Implémentation |
|-------|----------------|
| **Droit d’accès** | L’utilisateur consulte son profil via `/dashboard/settings`. Export possible de l’ensemble des données personnelles (évolution). |
| **Droit de rectification** | Modification du nom, de l’email, des préférences dans l’interface. L’email modifié nécessite une nouvelle vérification. |
| **Droit à l’effacement** | Suppression du compte sur demande. Suppression en cascade des QR, scans, clés API, sessions, tokens, campagnes associées. Les logs anonymisés peuvent être conservés. |
| **Droit à la portabilité** | Export des données personnelles en JSON/CSV. |
| **Droit d’opposition** | Désinscription des campagnes marketing via le lien dans chaque email ou via les paramètres. |
| **Droit à la limitation** | Désactivation temporaire du compte ou d’un QR. |

### 6.4 Registre des traitements

| Traitement | Données collectées | Durée de conservation | Destinataires |
|------------|-------------------|----------------------|---------------|
| Compte utilisateur | Email, nom, hash mot de passe, rôle, préférences, dates | **Durée de vie du compte + 1 an**, puis suppression ou anonymisation | Équipe technique, hébergeurs |
| QR codes | Contenu, type, paramètres, alias, image | **Durée de vie du compte + 1 an**, ou suppression à la demande | Hébergeurs |
| Scans | IP anonymisée, userAgent, pays, ville, referer, date | **1 an** (TTL MongoDB), puis suppression automatique | Hébergeurs, service GeoIP |
| Statistiques QR | Agrégats quotidiens | **2 ans** | Équipe produit |
| Campagnes marketing | Contenu, cible, métriques | **3 ans** | Équipe marketing |
| Tracking emails | Événements ouverture/clic | **1 an** | Équipe marketing |
| Tokens et sessions | Hash de tokens, userAgent, IP anonymisée | **7 jours** pour refresh tokens, **24 h** pour tokens email, purge TTL | Hébergeurs |
| Clés API | Hash, nom, permissions, dates | **Jusqu’à révocation ou expiration** | Utilisateur |
| Journaux QR | Actions sur QR, snapshots | **2 ans** | Équipe technique |

---

## 7. Sous-traitants et responsabilités

| Sous-traitant | Rôle | Mesures de sécurité |
|---------------|------|---------------------|
| **Cloudflare** | Hébergement edge (Workers, Pages, R2, KV), protection DDoS, WAF | HTTPS, DDoS protection, certificats TLS, politique d’accès R2 |
| **MongoDB Atlas** | Base de données hébergée | Chiffrement au repos (M10+) et en transit (TLS), authentification, backups automatisés, réseau privé (VPC) |
| **SMTP maison** | Envoi d’emails transactionnels et marketing | Authentification SMTP, SPF/DKIM/DMARC, rate limiting, logs limités |
| Service GeoIP (optionnel : ipapi.co ou auto-hébergé) | Résolution pays/ville depuis IP anonymisée | Données IP anonymisées avant envoi, accord DPA si service tiers |

> **Note :** Le service GeoIP est considéré comme un sous-traitant si des données IP brutes y transitent. L’anonymisation préalable réduit le risque, mais un DPA reste recommandé.

---

## 8. Fiches de sécurité par traitement critique

### 8.1 T01 — S’inscrire

| Élément | Mesure |
|---------|--------|
| Menaces principales | Brute-force, email déjà existant, injection, XSS via nom |
| Validation | Email, mot de passe, nom avec Zod ; case consentement obligatoire |
| Sécurité | Hash bcrypt du mot de passe ; token de vérification hashé ; email disponible message générique |
| RGPD | Consentement marketing explicite et horodaté |
| Logs | Aucun mot de passe en clair ; email masqué partiellement dans les logs |

### 8.2 T03 — Se connecter

| Élément | Mesure |
|---------|--------|
| Menaces principales | Brute-force, credential stuffing, vol de session |
| Validation | Rate limit 5/min/IP ; message d’erreur générique |
| Sécurité | JWT 15 min, refresh token 7 jours hashé, cookie httpOnly Secure SameSite |
| RGPD | Accès au compte contractuel ; dernière connexion enregistrée |
| Logs | IP anonymisée, userAgent limité |

### 8.3 T04 / T05 — Générer / Modifier un QR code

| Élément | Mesure |
|---------|--------|
| Menaces principales | XSS via contenu, open redirect, élévation de privilèges, IDOR |
| Validation | `validerContenuSelonType` ; URL `http`/`https` uniquement ; propriété vérifiée |
| Sécurité | Génération côté serveur ; stockage R2 avec chemins isolés par utilisateur ; journal des modifications |
| RGPD | Les QR dynamiques redirigent vers une cible ; la responsabilité du contenu final revient à l’utilisateur, mais le service vérifie le protocole. |
| Logs | Contenu potentiellement sensible non loggé en clair |

### 8.4 T08 / T09 — Redirection et enregistrement d’un scan

| Élément | Mesure |
|---------|--------|
| Menaces principales | Open redirect, tracking non consenti, DoS, fuite d’IP |
| Validation | Protocole URL contrôlé ; QR actif et non expiré ; rate limit |
| Sécurité | IP anonymisée avant stockage ; userAgent limité ; pas de données personnelles directes ; traitement asynchrone |
| RGPD | Anonymisation ; base légale : intérêt légitime ; durée de conservation 1 an |
| Logs | Événements de scan agrégés, pas de données brutes |

### 8.5 T11 / T12 / T18 — Campagnes et tracking emails

| Élément | Mesure |
|---------|--------|
| Menaces principales | Spam, phishing, XSS dans les emails, envoi aux non-consentants |
| Validation | Rôle admin obligatoire ; lien de désinscription obligatoire ; consentement filtré ; HTML sanitizé |
| Sécurité | Rate limit SMTP ; pixels 1x1 et liens trackés avec tokens uniques ; envoi uniquement aux utilisateurs `consentementMarketing = true` |
| RGPD | Consentement explicite ; droit d’opposition via désinscription ; durée de conservation limitée |
| Logs | Métriques agrégées uniquement ; pas d’adresse IP brute dans les rapports |

### 8.6 T14 — Gérer les clés API

| Élément | Mesure |
|---------|--------|
| Menaces principales | Fuite de clé, élévation de privilèges, accès non autorisé |
| Validation | Permissions limitées et explicites (scopes) ; date d’expiration optionnelle |
| Sécurité | Clé affichée une seule fois à la création ; hash SHA256 stocké ; vérification des scopes à chaque appel ; révocation possible |
| RGPD | Traitement lié au compte utilisateur ; suppression avec le compte |
| Logs | Dernière utilisation enregistrée, pas de clé brute |

---

## 9. Incidents et réponse aux incidents

| Type d’incident | Actions |
|-----------------|---------|
| Compromission d’un compte | Révocation de toutes les sessions, reset forcé du mot de passe, notification utilisateur, audit des QR modifiés. |
| Fuite de données | Notification à la CNIL dans les 72 heures si risque élevé ; notification aux personnes concernées si nécessaire. |
| Fuite de clé API | Révocation immédiate de la clé, audit des appels, rotation des secrets si nécessaire. |
| Abus de campagnes email | Suspension de l’envoi, révocation du rôle admin concerné, audit des destinataires. |
| DDoS / abus d’API | Activation des règles Cloudflare, blocage IP temporaire, ajustement des rate limits. |

---

## 10. Checklist de mise en œuvre

- [ ] Configurer `bcrypt` avec coût ≥ 12.
- [ ] Mettre en place les JWT access (15 min) et refresh (7 jours) avec cookies httpOnly Secure SameSite.
- [ ] Déployer Zod sur tous les endpoints.
- [ ] Activer le rate limiting via Cloudflare KV.
- [ ] Configurer CORS restrictif.
- [ ] Déployer les en-têtes CSP, HSTS, X-Frame-Options, X-Content-Type-Options.
- [ ] Anonymiser les IPs avant stockage dans `scans`, `refresh_tokens`, `tracking_emails`.
- [ ] Filtrer systématiquement les campagnes par `consentementMarketing = true`.
- [ ] Inclure un lien de désinscription dans chaque email marketing.
- [ ] Implémenter la révocation de sessions et la déconnexion sécurisée.
- [ ] Sanitiser le HTML des campagnes emails.
- [ ] Valider les URLs de redirection (pas de `javascript:`, `data:`).
- [ ] Stocker les hashes des tokens email, refresh tokens et clés API.
- [ ] Mettre en place les index TTL pour les tokens et scans.
- [ ] Configurer les backups MongoDB Atlas et la politique R2.
- [ ] Documenter les DPA avec Cloudflare, MongoDB Atlas et le fournisseur GeoIP.
- [ ] Prévoir un mécanisme d’export et de suppression des données personnelles.

---

## 11. Références

- `01_MCD.md` — Entités, attributs, règles de gestion, RGPD et consentement.
- `02_MLD.md` — Collections MongoDB, index, schémas logiques, tokens et sessions.
- `03_MPD.md` — Scripts physiques, index TTL, validation JSON Schema, accès Workers.
- `04_MCT.md` — Traitements métier, authentification, campagnes, scans.
- `05_MOT.md` — Acteurs, matrice RACI, contraintes organisationnelles.
- `06_MLT.md` — Pseudocodes détaillés de sécurité (hash, tokens, validation, rate limit).
- `07_UML_FRONTEND_WIREFRAMES.md` — Formulaires d’inscription, consentement, profil.
- `08_UML_FRONTEND_SEQUENCES.md` — Flux JWT, sessions, clés API, redirections.
- `09_UML_FRONTEND_NAVIGATION.md` — Routes protégées, garde, gestion des erreurs.
- `10_ARCHITECTURE.md` — Stack, sécurité, CORS, rate limiting, secrets.
- `11_API_OPENAPI.yaml` — Spécification des endpoints et payloads sécurisés.

---

*Document : 12_SECURITE_RGPD.md*  
*Version : 1.0*  
*Date : 2026-07-29*
