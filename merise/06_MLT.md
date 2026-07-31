# MLT — Modèle Logique de Traitements

## Contexte

Ce document fournit le pseudocode ou les séquences détaillées des traitements principaux identifiés dans le MCT. L'objectif est de préciser l'algorithme interne sans dépendre d'un langage ou framework spécifique.

---

## Conventions de pseudocode

- `DB.collection(nom)` : accès à une collection MongoDB.
- `R2.upload(chemin, contenu)` : stockage d'un fichier sur Cloudflare R2.
- `SMTP.send(destinataire, sujet, corps)` : envoi d'email via Nodemailer + SMTP maison.
- `JWT.sign(payload, duree)` / `JWT.verify(token)` : génération/vérification de token.
- `bcrypt.hash(texte)` / `bcrypt.compare(texte, hash)` : hash et vérification de mot de passe.
- `sha256(texte)` : hash SHA256.
- `GeoIP.lookup(ip)` : récupération pays/ville depuis une IP.
- `genererJetonUnique()` : génère un token aléatoire cryptographique.
- `erreur(code, message)` : lève une erreur métier.
- `retourner` : renvoie le résultat au client.

---

## T01 — S'inscrire

```text
FONCTION inscrire(email, motDePasse, nom, consentementMarketing)

  SI email invalide ALORS
    erreur(400, "Format d'email invalide")
  FIN SI

  SI motDePasse ne respecte pas la politique ALORS
    erreur(400, "Mot de passe trop faible")
  FIN SI

  SI DB.utilisateurs.existe(email) ALORS
    erreur(409, "Un compte existe déjà avec cet email")
  FIN SI

  hash = bcrypt.hash(motDePasse)
  dateActuelle = now()

  utilisateur = DB.utilisateurs.inserer({
    email: email,
    motDePasse: hash,
    nom: nom,
    estVerifie: false,
    consentementMarketing: consentementMarketing,
    dateConsentementMarketing: consentementMarketing ? dateActuelle : null,
    dateInscription: dateActuelle,
    estActif: true,
    role: "utilisateur"
  })

  tokenBrut = genererJetonUnique()
  tokenHash = sha256(tokenBrut)

  DB.tokens_email.inserer({
    idUtilisateur: utilisateur._id,
    tokenHash: tokenHash,
    type: "verification",
    dateExpiration: dateActuelle + 24h,
    estUtilise: false
  })

  SMTP.send(
    destinataire: email,
    sujet: "Confirmez votre compte QR SaaS",
    corps: genererEmailConfirmation(tokenBrut)
  )

  RETOURNER { message: "Inscription réussie, vérifiez votre email" }

FIN FONCTION
```

---

## T02 — Confirmer son email

```text
FONCTION confirmerEmail(tokenBrut)

  tokenHash = sha256(tokenBrut)
  token = DB.tokens_email.trouverParTokenHash(tokenHash)

  SI token inexistant OU token.type != "verification" ALORS
    erreur(400, "Token invalide")
  FIN SI

  SI token.estUtilise ALORS
    erreur(400, "Lien déjà utilisé")
  FIN SI

  SI token.dateExpiration < now() ALORS
    erreur(400, "Lien expiré")
  FIN SI

  utilisateur = DB.utilisateurs.trouverParId(token.idUtilisateur)

  SI utilisateur inexistant OU utilisateur.estVerifie ALORS
    erreur(400, "Compte inexistant ou déjà vérifié")
  FIN SI

  DB.utilisateurs.mettreAJour(utilisateur._id, {
    estVerifie: true
  })

  DB.tokens_email.mettreAJour(token._id, {
    estUtilise: true,
    dateUtilisation: now()
  })

  RETOURNER { message: "Email confirmé" }

FIN FONCTION
```

---

## T03 — Se connecter

```text
FONCTION connecter(email, motDePasse, headers)

  utilisateur = DB.utilisateurs.trouverParEmail(email)

  SI utilisateur inexistant ALORS
    erreur(401, "Identifiants invalides")
  FIN SI

  SI !utilisateur.estActif ALORS
    erreur(403, "Compte désactivé")
  FIN SI

  SI !bcrypt.compare(motDePasse, utilisateur.motDePasse) ALORS
    erreur(401, "Identifiants invalides")
  FIN SI

  accessToken = JWT.sign({ idUtilisateur: utilisateur._id, role: utilisateur.role }, "15m")

  refreshTokenBrut = genererJetonUnique()
  refreshTokenHash = sha256(refreshTokenBrut)

  DB.refresh_tokens.inserer({
    idUtilisateur: utilisateur._id,
    tokenHash: refreshTokenHash,
    userAgent: headers.userAgent,
    adresseIP: headers.ip,
    dateCreation: now(),
    dateExpiration: now() + 7j,
    estRevoke: false
  })

  DB.utilisateurs.mettreAJour(utilisateur._id, {
    dateDerniereConnexion: now()
  })

  RETOURNER { accessToken, refreshToken: refreshTokenBrut, utilisateur: masquerChampsSensibles(utilisateur) }

FIN FONCTION
```

---

## T04 — Générer un QR code

```text
FONCTION genererQRCode(idUtilisateur, contenu, typeContenu, parametres, estDynamique)

  SI !typeContenu est supporté ALORS
    erreur(400, "Type de contenu non supporté")
  FIN SI

  SI !validerContenuSelonType(contenu, typeContenu) ALORS
    erreur(400, "Contenu invalide pour le type sélectionné")
  FIN SI

  aliasCourt = null
  contenuFinal = contenu

  SI estDynamique ALORS
    aliasCourt = genererAliasUnique()
    contenuFinal = construireURLRedirection(aliasCourt)
  FIN SI

  imageBuffer = QRGenerator.render(contenuFinal, parametres)
  cheminImage = "users/" + idUtilisateur + "/qrcodes/" + UUID() + ".png"
  urlImage = R2.upload(cheminImage, imageBuffer)

  qrCode = DB.qrcodes.inserer({
    idUtilisateur: idUtilisateur,
    contenu: contenu,
    typeContenu: typeContenu,
    estDynamique: estDynamique,
    aliasCourt: aliasCourt,
    parametres: parametres,
    estActif: true,
    dateCreation: now(),
    dateExpiration: parametres.dateExpiration,
    nombreScansTotal: 0,
    urlImage: urlImage
  })

  RETOURNER { qrCode }

FIN FONCTION
```

---

## T05 — Modifier un QR code dynamique

```text
FONCTION modifierQRCodeDynamique(idUtilisateur, idQRCode, nouveauContenu)

  qrCode = DB.qrcodes.trouverParId(idQRCode)

  SI qrCode inexistant ALORS
    erreur(404, "QR code introuvable")
  FIN SI

  SI qrCode.idUtilisateur != idUtilisateur ALORS
    erreur(403, "Accès refusé")
  FIN SI

  SI !qrCode.estDynamique ALORS
    erreur(400, "Impossible de modifier un QR code statique")
  FIN SI

  SI !validerContenuSelonType(nouveauContenu, qrCode.typeContenu) ALORS
    erreur(400, "Nouveau contenu invalide")
  FIN SI

  DB.qrcodes.mettreAJour(idQRCode, {
    contenu: nouveauContenu,
    dateDerniereModification: now()
  })

  DB.journal.inserer({
    idQRCode: idQRCode,
    idUtilisateur: idUtilisateur,
    action: "modification_cible",
    date: now()
  })

  RETOURNER { message: "QR code dynamique mis à jour" }

FIN FONCTION
```

---

## T06 — Lister ses QR codes

```text
FONCTION listerQRCodes(idUtilisateur, page, taillePage, filtres)

  requete = { idUtilisateur: idUtilisateur }

  SI filtres.typeContenu ALORS
    requete.typeContenu = filtres.typeContenu
  FIN SI

  SI filtres.estActif != null ALORS
    requete.estActif = filtres.estActif
  FIN SI

  SI filtres.recherche ALORS
    requete.$or = [
      { contenu: { $regex: filtres.recherche, $options: "i" } },
      { aliasCourt: { $regex: filtres.recherche, $options: "i" } }
    ]
  FIN SI

  total = DB.qrcodes.compter(requete)
  resultats = DB.qrcodes.trouver(requete)
    .trier({ dateCreation: -1 })
    .paginer(page, taillePage)

  RETOURNER { total, page, taillePage, resultats }

FIN FONCTION
```

---

## T07 — Désactiver / supprimer un QR code

```text
FONCTION desactiverQRCode(idUtilisateur, idQRCode, supprimer = false)

  qrCode = DB.qrcodes.trouverParId(idQRCode)

  SI qrCode inexistant ALORS
    erreur(404, "QR code introuvable")
  FIN SI

  SI qrCode.idUtilisateur != idUtilisateur ALORS
    erreur(403, "Accès refusé")
  FIN SI

  SI supprimer ALORS
    R2.supprimer(qrCode.urlImage)
    DB.qrcodes.supprimer(idQRCode)
  SINON
    DB.qrcodes.mettreAJour(idQRCode, { estActif: false })
  FIN SI

  RETOURNER { message: "Opération réalisée avec succès" }

FIN FONCTION
```

---

## T08 — Rediriger un QR code dynamique

```text
FONCTION redirigerQRCode(aliasCourt, headers)

  qrCode = DB.qrcodes.trouverParAliasCourt(aliasCourt)

  SI qrCode inexistant OU !qrCode.estActif ALORS
    RETOURNER HTTP 404(page QR introuvable)
  FIN SI

  SI qrCode.dateExpiration < now() ALORS
    RETOURNER HTTP 410(QR expiré)
  FIN SI

  PUBLIER_EVENEMENT("scan.received", {
    idQRCode: qrCode._id,
    aliasCourt: aliasCourt,
    ip: headers.ip,
    userAgent: headers.userAgent,
    referer: headers.referer
  })

  RETOURNER HTTP 302(Location: qrCode.contenu)

FIN FONCTION
```

---

## T09 — Enregistrer un scan

```text
FONCTION enregistrerScan(idQRCode, ipBrute, userAgent, referer)

  qrCode = DB.qrcodes.trouverParId(idQRCode)

  SI qrCode inexistant ALORS
    RETOURNER // événement orphelin, ignoré
  FIN SI

  ipAnonymise = masquerDernierOctet(ipBrute)
  geo = GeoIP.lookup(ipAnonymise)

  debutJour = debutDuJour(now())
  scanExistantAujourdhui = DB.scans.existe({
    idQRCode: idQRCode,
    adresseIP: ipAnonymise,
    dateScan: { $gte: debutJour }
  })

  estUnique = !scanExistantAujourdhui

  DB.scans.inserer({
    idQRCode: idQRCode,
    adresseIP: ipAnonymise,
    userAgent: userAgent,
    pays: geo.pays,
    ville: geo.ville,
    referer: referer,
    dateScan: now(),
    estUnique: estUnique
  })

  DB.statistiques_qrcodes.upsert(
    { idQRCode: idQRCode, date: debutJour },
    {
      $inc: {
        nombreScans: 1,
        nombreScansUniques: estUnique ? 1 : 0
      },
      $addToSet: {
        paysTop: geo.pays,
        appareilsTop: extraireFamilleAppareil(userAgent)
      }
    }
  )

  DB.qrcodes.mettreAJour(idQRCode, {
    $inc: { nombreScansTotal: 1 }
  })

FIN FONCTION
```

---

## T10 — Consulter les statistiques d'un QR code

```text
FONCTION consulterStatistiques(idUtilisateur, idQRCode, periodeJours)

  qrCode = DB.qrcodes.trouverParId(idQRCode)

  SI qrCode inexistant OU qrCode.idUtilisateur != idUtilisateur ALORS
    erreur(404, "QR code introuvable")
  FIN SI

  dateDebut = now() - periodeJours jours

  stats = DB.statistiques_qrcodes.agreger([
    { $match: { idQRCode: ObjectId(idQRCode), date: { $gte: dateDebut } } },
    {
      $group: {
        _id: null,
        totalScans: { $sum: "$nombreScans" },
        totalScansUniques: { $sum: "$nombreScansUniques" },
        evolution: { $push: { date: "$date", scans: "$nombreScans" } }
      }
    }
  ])

  topPays = extraireTopPays(stats)
  topAppareils = extraireTopAppareils(stats)

  RETOURNER {
    totalScans: stats.totalScans,
    totalScansUniques: stats.totalScansUniques,
    evolution: stats.evolution,
    topPays: topPays,
    topAppareils: topAppareils
  }

FIN FONCTION
```

---

## T11 — Créer une campagne email

```text
FONCTION creerCampagne(idAdministrateur, titre, contenuHTML, cible)

  administrateur = DB.utilisateurs.trouverParId(idAdministrateur)

  SI administrateur.role != "admin" ALORS
    erreur(403, "Action réservée aux administrateurs")
  FIN SI

  SI !contenuHTML contient lienDesinscription ALORS
    erreur(400, "Le contenu doit contenir un lien de désinscription")
  FIN SI

  campagne = DB.campagnes_emails.inserer({
    idUtilisateur: idAdministrateur,
    titre: titre,
    contenu: contenuHTML,
    cible: cible,
    statut: "brouillon",
    dateEnvoi: null,
    nombreOuvertures: 0,
    nombreClics: 0
  })

  RETOURNER { campagne }

FIN FONCTION
```

---

## T12 — Envoyer une campagne email

```text
FONCTION envoyerCampagne(idCampagne, mode = "immediat")

  campagne = DB.campagnes_emails.trouverParId(idCampagne)

  SI campagne.statut != "programmee" ET campagne.statut != "brouillon" ALORS
    erreur(400, "Statut de campagne invalide")
  FIN SI

  criteres = { consentementMarketing: true, estActif: true, estVerifie: true }

  SI campagne.cible == "actifs" ALORS
    criteres.dateDerniereConnexion = { $gte: now() - 30 jours }
  SINON SI campagne.cible == "inactifs" ALORS
    criteres.dateDerniereConnexion = { $lt: now() - 30 jours }
  SINON SI campagne.cible == "non_verifies" ALORS
    criteres.estVerifie = false
  FIN SI

  destinataires = DB.utilisateurs.trouver(criteres)

  POUR CHAQUE destinataire DANS destinataires
    tokenTracking = genererTokenTracking(idCampagne, destinataire._id)
    corpsPersonnalise = injecterPixelOuverture(campagne.contenu, tokenTracking)
    corpsPersonnalise = injecterLiensTrackes(corpsPersonnalise, tokenTracking)

    DB.campagnes_utilisateurs.upsert(
      { idCampagne: idCampagne, idUtilisateur: destinataire._id },
      { dateEnvoiUtilisateur: now(), estOuvert: false, estClique: false }
    )

    SMTP.envoyerAvecRateLimit(destinataire.email, campagne.titre, corpsPersonnalise)
  FIN POUR

  DB.campagnes_emails.mettreAJour(idCampagne, {
    statut: "envoyee",
    dateEnvoi: now()
  })

  RETOURNER { nombreDestinataires: longueur(destinataires) }

FIN FONCTION
```

---

## T14 — Gérer les clés API

```text
FONCTION creerCleAPI(idUtilisateur, nom, permissions, dateExpiration)

  SI permissions est vide ALORS
    erreur(400, "Au moins une permission est requise")
  FIN SI

  cleBrute = genererChaineAleatoire(64)
  hashCle = SHA256(cleBrute)

  DB.cles_api.inserer({
    idUtilisateur: idUtilisateur,
    nom: nom,
    cle: hashCle,
    permissions: permissions,
    dateCreation: now(),
    dateExpiration: dateExpiration,
    derniereUtilisation: null
  })

  RETOURNER { cleBrute: cleBrute } // affichée une seule fois

FIN FONCTION

FONCTION verifierCleAPI(cleBrute, permissionRequise)

  hashCle = SHA256(cleBrute)
  cle = DB.cles_api.trouverParCle(hashCle)

  SI cle inexistante ALORS
    erreur(401, "Clé API invalide")
  FIN SI

  SI cle.dateExpiration ET cle.dateExpiration < now() ALORS
    erreur(401, "Clé API expirée")
  FIN SI

  SI permissionRequise NON DANS cle.permissions ALORS
    erreur(403, "Permission insuffisante")
  FIN SI

  DB.cles_api.mettreAJour(cle._id, { derniereUtilisation: now() })

  RETOURNER { idUtilisateur: cle.idUtilisateur, permissions: cle.permissions }

FIN FONCTION
```

---

## T15 — Exporter les statistiques

```text
FONCTION exporterStatistiques(idUtilisateur, idQRCode, format)

  qrCode = DB.qrcodes.trouverParId(idQRCode)

  SI qrCode.idUtilisateur != idUtilisateur ALORS
    erreur(403, "Accès refusé")
  FIN SI

  stats = DB.statistiques_qrcodes.trouver({ idQRCode: idQRCode })

  SI format == "json" ALORS
    RETOURNER genererJSON(stats)
  SINON SI format == "csv" ALORS
    RETOURNER genererCSV(stats)
  SINON SI format == "xlsx" ALORS
    RETOURNER genererXLSX(stats)
  SINON
    erreur(400, "Format non supporté")
  FIN SI

FIN FONCTION
```

---

## T16 — Rafraîchir un access token

```text
FONCTION rafraichirAccessToken(refreshTokenBrut)

  refreshTokenHash = sha256(refreshTokenBrut)
  token = DB.refresh_tokens.trouverParTokenHash(refreshTokenHash)

  SI token inexistant OU token.estRevoke OU token.dateExpiration < now() ALORS
    erreur(401, "Refresh token invalide ou expiré")
  FIN SI

  utilisateur = DB.utilisateurs.trouverParId(token.idUtilisateur)

  SI utilisateur inexistant OU !utilisateur.estActif ALORS
    erreur(401, "Session invalide")
  FIN SI

  accessToken = JWT.sign({ idUtilisateur: utilisateur._id, role: utilisateur.role }, "15m")

  RETOURNER { accessToken }

FIN FONCTION
```

---

## T17 — Révoquer une session

```text
FONCTION revoquerSession(idUtilisateur, refreshTokenBrut)

  refreshTokenHash = sha256(refreshTokenBrut)
  token = DB.refresh_tokens.trouverParTokenHash(refreshTokenHash)

  SI token inexistant OU token.idUtilisateur != idUtilisateur ALORS
    erreur(404, "Session introuvable")
  FIN SI

  SI token.estRevoke ALORS
    RETOURNER { message: "Session déjà révoquée" }
  FIN SI

  DB.refresh_tokens.mettreAJour(token._id, {
    estRevoke: true,
    dateRevocation: now()
  })

  RETOURNER { message: "Session révoquée" }

FIN FONCTION
```

---

## T18 — Enregistrer un événement de tracking email

```text
FONCTION enregistrerTrackingEmail(tokenTracking, type, headers, urlCible = null)

  SI type != "ouverture" ET type != "clic" ALORS
    erreur(400, "Type de tracking invalide")
  FIN SI

  meta = decoderTokenTracking(tokenTracking)

  SI meta.existant == faux ALORS
    RETOURNER // pixel silencieux, ne pas renvoyer d'erreur
  FIN SI

  DB.tracking_emails.inserer({
    idCampagne: meta.idCampagne,
    idUtilisateur: meta.idUtilisateur,
    type: type,
    tokenTracking: tokenTracking,
    urlCible: urlCible,
    userAgent: headers.userAgent,
    adresseIP: headers.ip,
    dateEvenement: now()
  })

  champ = (type == "ouverture") ? "nombreOuvertures" : "nombreClics"
  champDestinataire = (type == "ouverture") ? "estOuvert" : "estClique"

  DB.campagnes_emails.mettreAJour(meta.idCampagne, {
    $inc: { [champ]: 1 }
  })

  DB.campagnes_utilisateurs.mettreAJour(
    { idCampagne: meta.idCampagne, idUtilisateur: meta.idUtilisateur },
    { [champDestinataire]: true }
  )

  SI type == "ouverture" ALORS
    RETOURNER pixelTransparent1x1()
  SINON
    RETOURNER HTTP 302(Location: urlCible)
  FIN SI

FIN FONCTION
```

---

## Traitement commun — Validation du contenu selon le type de QR

```text
FONCTION validerContenuSelonType(contenu, typeContenu)

  SELON typeContenu FAIRE
    CAS "url":
      RETOURNER estURLValide(contenu)
    CAS "email":
      RETOURNER estEmailValide(contenu)
    CAS "telephone":
      RETOURNER correspond(contenu, "^\\+?[0-9\\s\\-]{7,20}$")
    CAS "sms":
      RETOURNER estSMSValide(contenu) // téléphone + message optionnel
    CAS "wifi":
      RETOURNER estFormatWifiValide(contenu)
    CAS "vcard":
      RETOURNER estFormatVCardValide(contenu)
    CAS "geo":
      RETOURNER estFormatGeoValide(contenu)
    CAS "pdf":
      RETOURNER estURLValide(contenu) // pointe vers un PDF
    CAS "texte":
      RETOURNER longueur(contenu) > 0 ET longueur(contenu) <= 4000
    DEFAUT:
      RETOURNER faux
  FIN SELON

FIN FONCTION
```

---

## Traitement commun — Génération d'un alias court unique

```text
FONCTION genererAliasUnique()

  POUR tentative DE 1 A 10 FAIRE
    alias = base62encode(randomBytes(6)) // ex: abc123
    SI !DB.qrcodes.existe({ aliasCourt: alias }) ALORS
      RETOURNER alias
    FIN SI
  FIN POUR

  erreur(500, "Impossible de générer un alias unique")

FIN FONCTION
```

---

## Correspondance MCT → MLT

| Traitement MCT | Pseudocode MLT |
|----------------|----------------|
| T01 S'inscrire | Pseudocode T01 |
| T02 Confirmer email | Pseudocode T02 |
| T03 Se connecter | Pseudocode T03 |
| T04 Générer QR | Pseudocode T04 |
| T05 Modifier QR dynamique | Pseudocode T05 |
| T06 Lister QR | Pseudocode T06 |
| T07 Désactiver/supprimer QR | Pseudocode T07 |
| T08 Rediriger QR dynamique | Pseudocode T08 |
| T09 Enregistrer scan | Pseudocode T09 |
| T10 Consulter statistiques | Pseudocode T10 |
| T11 Créer campagne | Pseudocode T11 |
| T12 Envoyer campagne | Pseudocode T12 |
| T16 Rafraîchir access token | Pseudocode T16 |
| T17 Révoquer session | Pseudocode T17 |
| T18 Tracking email | Pseudocode T18 |
| T13 Gérer modèles | À implémenter selon spécification UX future |
| T14 Gérer clés API | Pseudocode T14 |
| T15 Exporter statistiques | Pseudocode T15 |

---

## Hypothèses techniques du MLT

- Le hashing des clés API utilise SHA256 pour permettre la vérification sans stocker la clé brute.
- Les mots de passe utilisent bcrypt avec un coût adapté (≥ 12).
- Le service GeoIP est appelé de manière asynchrone ; une indisponibilité ne bloque pas l'enregistrement du scan.
- Les campagnes emails sont envoyées avec un rate limit pour préserver la réputation du SMTP maison.
- L'upsert sur `statistiques_qrcodes` utilise un index unique composite `(idQRCode, date)`.
