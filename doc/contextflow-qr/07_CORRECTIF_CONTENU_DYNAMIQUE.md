# Correctif — contenu dynamique non-URL (`Invalid header value`)

**Date :** 2026-11-12
**Incident :** `GET /q/oz4a205` renvoyait `500 Invalid header value`
**Statut :** corrigé et validé **en local** (`168/168` tests + test `wrangler dev`). **Pas encore déployé** : la production attend la validation explicite.

---

## 1. Symptôme

Un scan du QR dynamique `oz4a205` produisait :

```
TypeError: Headers.append: Invalid header value
```

Le QR contenait une vCard (nom, téléphone, email, organisation, URL du logo). Le runtime faisait `c.redirect(qrCode.contenu, 302)` : les retours à la ligne de la vCard étaient injectés bruts dans le header `Location`. Un header HTTP n'accepte aucun caractère de contrôle → exception → `500`.

## 2. Cause racine

Le code supposait qu'un QR dynamique était **toujours** une redirection. Or un QR dynamique peut contenir une vCard, du texte, un WiFi, un email, etc. Le contenu ne doit pas finir dans un header `Location` : il faut choisir le format de réponse selon `type_contenu`.

La première tentative de correctif (interdire les QR dynamiques non-URL) était **fausse** : elle privait les QR dynamiques de la vCard, du texte et des autres usages. Ce correctif a été annulé.

## 3. Correctif retenu

### 3.1 Runtime — `apps/api/src/routes/redirect.ts`

Le runtime distingue maintenant deux cas :

1. **Une variante de routage valide** (URL `http(s)`) → redirection `302` vers la variante, avec `?cfq=<idVariante>`.
2. **Sinon, le contenu natif du QR** est servi selon `type_contenu` :
   - `vcard` → `200`, `Content-Type: text/vcard; charset=utf-8`, `Content-Disposition: attachment; filename="<Nom>.vcf"`, corps normalisé en CRLF ;
   - `texte` / `wifi` → `200`, `Content-Type: text/plain; charset=utf-8` ;
   - `url` / `pdf` → redirection `302` si l'URL `http(s)` est valide, sinon `404` propre ;
   - `email` / `telephone` / `sms` / `geo` → redirection `302` vers l'URI (`mailto:`, `tel:`, `sms:`, `geo:`), après contrôle de l'absence de caractères de contrôle.

Une variante de routage non `http(s)` est ignorée : on retombe sur le contenu natif (vCard incluse). Aucun contenu brut n'est jamais mis dans `Location`.

Le scan est enregistré (`recordScan`) avant l'envoi de la réponse, y compris pour une vCard ou un texte.

### 3.2 Validation à l'écriture — `apps/api/src/services/contenu-dynamique.ts`

Le service valide le contenu **selon son type**, sans imposer l'URL :

| Type | Règle |
|---|---|
| `url`, `pdf` | URL `http(s)` absolue ; `www.example.com` normalisé en `https://www.example.com` |
| `vcard` | document complet `BEGIN:VCARD` … `END:VCARD` |
| `email` | URI `mailto:` |
| `telephone` | URI `tel:` |
| `sms` | URI `sms:` / `smsto:` |
| `geo` | URI `geo:` |
| `wifi` | configuration `WIFI:` |
| `texte` | contenu non vide |

Les QR **statiques** ne changent pas : leur contenu est encodé en dur dans l'image.

`PATCH /qrcodes/:id` accepte désormais `typeContenu` en option. S'il est absent, le type est déduit du contenu (vCard complète → `vcard`, `WIFI:` → `wifi`, etc.).

### 3.3 Helper de sécurité — `apps/api/src/lib/destination.ts`

- refuse tout caractère de contrôle (`\u0000`–`\u001F`, `\u007F`) — indispensable car `new URL()` supprime silencieusement les retours à la ligne ;
- `estUrlHttpSure` exige `http(s)` + hostname ;
- `estUriSure` vérifie les schémas `mailto:`, `tel:`, `sms:`, `geo:` ;
- `normaliserUrlHttp` ajoute `https://` si le schéma manque puis valide.

## 4. Tests locaux

### Suite automatisée

```
pnpm type-check          ✅
pnpm --filter @free-qr/api test
  Test Files  16 passed (16)
  Tests       168 passed (168)
```

Nouveaux tests :

- `apps/api/tests/contenu-dynamique.test.ts` : normalisation CRLF, nom de fichier `.vcf`, vCard complète, URLs invalides, injection `mailto:` avec `\n`, text/plain, redirections.
- `apps/api/tests/routing-redirect.test.ts` : vCard servie en `.vcf` sans `Location`, texte en `text/plain`, URL invalide → `404`, variante non `http(s)` → fallback sur la vCard native.
- `apps/api/tests/qrcode.test.ts` : création dynamique vCard/texte acceptée, URL invalide refusée, vCard mal formée refusée, mise à jour vCard acceptée.

### Test réel `wrangler dev` (D1 locale)

Base locale seedée avec la vraie vCard `oz4a205`, puis :

```
GET /q/oz4a205
HTTP/1.1 200 OK
Content-Type: text/vcard; charset=utf-8
Content-Disposition: attachment; filename="Gloire-Messia-SAYI.vcf"
```

```
file body-vcard.vcf
body-vcard.vcf: vCard visiting card, version 3.0
```

Les lignes sont bien en CRLF, et l'URL du logo est conservée :

```
BEGIN:VCARD\r
VERSION:3.0\r
N:SAYI;Gloire Messia;;;\r
FN:Gloire Messia SAYI\r
TEL:+24206718028\r
EMAIL:messiasayi@gmail.com\r
ORG:TOPINFO\r
URL:https://momo-calc.getcongo.com/\r
END:VCARD\r
```

Contrôles complémentaires :

```
GET /q/url-local    → 302 Location: https://example.com/local
GET /q/texte-local  → 200 text/plain; charset=utf-8
```

## 5. État de la production (à corriger au déploiement)

Le déploiement prématuré du premier correctif est toujours actif :

- le Worker en production applique encore la validation **URL-only** (à remplacer par ce correctif) ;
- la ligne `oz4a205` contient temporairement `https://momo-calc.getcongo.com/` au lieu de la vCard d'origine ;
- les migrations `001`→`005` ont déjà été appliquées en remote (schéma prêt, additif).

Aucune nouvelle modification de production ne sera faite sans validation.

### Procédure de déploiement prévue

```bash
# 1. Restaurer la vCard d'origine dans D1
npx wrangler d1 execute free-qr-api-db --remote --command "
UPDATE qrcodes
SET contenu = '<vCard d''origine>', type_contenu = 'vcard'
WHERE id = 10 AND alias_court = 'oz4a205';
"

# 2. Déployer le Worker corrigé
pnpm --filter api run deploy

# 3. Vérifier
curl -sSI https://free-qr-api.messiasayi.workers.dev/q/oz4a205
# attendu : 200, text/vcard, Content-Disposition attachment
```

La vCard d'origine à restaurer :

```
BEGIN:VCARD
VERSION:3.0
N:SAYI;Gloire Messia;;;
FN:Gloire Messia SAYI
TEL:+24206718028
EMAIL:messiasayi@gmail.com
ORG:TOPINFO
URL:https://momo-calc.getcongo.com/
END:VCARD
```

## 6. Décisions

- Un QR dynamique n'est **pas** limité aux URL.
- Une vCard dynamique est servie en **fichier `.vcf` téléchargeable**, avec tous ses champs (dont l'URL du logo).
- Le routage contextuel reste une fonctionnalité de **redirection** : ses variantes sont des URL `http(s)`. Sans routage actif, le contenu natif (vCard, texte, etc.) est servi.
- Un contenu invalide produit une erreur applicative maîtrisée (`400` à l'écriture, `404` au scan), jamais une exception de header.
