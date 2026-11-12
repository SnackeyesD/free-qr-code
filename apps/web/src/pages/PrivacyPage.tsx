export default function PrivacyPage() {
  const apiBaseUrl = (
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
  ).replace(/\/$/, '');

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-gray-900">
      <h1 className="text-3xl font-bold">Politique de confidentialité</h1>
      <p className="mt-4 text-gray-600">
        Cette page détaille la collecte, l'utilisation et la protection de vos données personnelles lorsque vous utilisez Free QR Code.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">1. Responsable du traitement</h2>
        <p className="mt-3 text-gray-600">
          Le responsable du traitement des données est l'éditeur de Free QR Code. Pour toute question relative à vos données, vous pouvez nous contacter via les moyens disponibles sur le site.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">2. Données collectées</h2>
        <p className="mt-3 text-gray-600">Nous collectons les données suivantes :</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-gray-600">
          <li>
            <strong>Données de compte :</strong> adresse e-mail, mot de passe (chiffré), nom ou raison sociale, et préférences de profil lors de votre inscription.
          </li>
          <li>
            <strong>Contenu des QR codes :</strong> les URLs, textes, coordonnées ou tout autre contenu que vous choisissez d'encoder dans vos QR codes.
          </li>
          <li>
            <strong>Données d'usage et statistiques :</strong> nombre de scans, localisation approximative, type d'appareil, navigateur, date et heure des consultations, dans le respect des paramètres de confidentialité de chaque QR code.
          </li>
          <li>
            <strong>Données techniques :</strong> adresse IP, logs de connexion, cookies et identifiants de session, nécessaires à la sécurité et au fonctionnement du service.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">3. Finalités du traitement</h2>
        <p className="mt-3 text-gray-600">Vos données sont utilisées pour :</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-gray-600">
          <li>Créer, stocker et gérer vos QR codes et modèles ;</li>
          <li>Vous fournir des statistiques d'analyse et de performance ;</li>
          <li>Garantir la sécurité de votre compte et du service ;</li>
          <li>Vous envoyer des notifications techniques ou des informations relatives à votre compte ;</li>
          <li>Améliorer l'expérience utilisateur et résoudre d'éventuels problèmes.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">4. Cookies et technologies similaires</h2>
        <p className="mt-3 text-gray-600">
          Free QR Code utilise des cookies et des technologies similaires pour assurer le fonctionnement du service, sécuriser votre authentification, mémoriser vos préférences et analyser l'usage de la plateforme. Vous pouvez configurer votre navigateur pour refuser certains cookies, mais cela peut affecter certaines fonctionnalités.
        </p>
        <p className="mt-3 text-gray-600">
          Aucun cookie publicitaire ou de pistage tiers n'est utilisé. Les cookies de comptage
          par appareil décrits ci-dessous ne sont posés qu'après un accord explicite du
          visiteur, sur les QR codes qui en ont besoin.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">5. Comptage des scans par appareil</h2>
        <p className="mt-3 text-gray-600">
          Certains QR codes adaptent leur contenu après plusieurs visites du même appareil
          (par exemple, afficher une prise de contact après le troisième scan). Ce mécanisme
          repose sur un consentement explicite, donné sur une page intermédiaire avant tout
          dépôt de cookie.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-gray-600">
          <li>
            <strong>Finalité :</strong> compter les scans de cet appareil pour adapter le
            contenu du QR code. Aucune autre utilisation.
          </li>
          <li>
            <strong>Base légale :</strong> votre consentement. Vous pouvez le retirer à tout
            moment.
          </li>
          <li>
            <strong>Cookie <code>cfq_did</code> :</strong> un identifiant aléatoire (UUID),
            sans information personnelle, conservé 13 mois. Il est inaccessible au JavaScript
            de la page (<code>HttpOnly</code>), transmis uniquement en HTTPS
            (<code>Secure</code>) et limité au site (<code>SameSite=Lax</code>).
          </li>
          <li>
            <strong>Cookie <code>cfq_c</code> :</strong> le nombre de scans par QR code pour
            cet appareil, conservé 13 mois.
          </li>
          <li>
            <strong>Cookie <code>cfq_refus</code> :</strong> mémorise votre refus pendant 6
            mois afin de ne pas vous réafficher le bandeau. Cookie strictement nécessaire,
            sans consentement requis.
          </li>
          <li>
            <strong>Minimisation :</strong> la base ne stocke qu'une empreinte
            cryptographique (SHA-256) de cet identifiant, jamais l'identifiant lui-même. Une
            fuite de la base ne permet donc pas de reconstituer un cookie.
          </li>
          <li>
            <strong>Aucun fingerprinting :</strong> nous n'utilisons ni la résolution d'écran,
            ni les polices, ni d'autres signaux pour reconnaître un appareil sans cookie.
          </li>
          <li>
            <strong>Refus :</strong> le QR code fonctionne normalement ; les règles fondées
            sur le nombre de scans de l'appareil sont simplement ignorées.
          </li>
          <li>
            <strong>Retrait :</strong> vous pouvez retirer votre consentement à tout moment
            depuis{' '}
            <a
              className="text-indigo-600 underline"
              href={`${apiBaseUrl}/consentement`}
              rel="noopener"
            >
              la page de gestion du consentement
            </a>
            . Le compteur et le lien avec vos scans sont alors supprimés.
          </li>
        </ul>
        <p className="mt-3 text-gray-600">
          Les scans effectués sans consentement restent comptés dans les statistiques
          agrégées du propriétaire du QR code, mais ne sont jamais attribués à un appareil.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">6. Hébergement et conservation</h2>
        <p className="mt-3 text-gray-600">
          Les données sont hébergées par des prestataires techniques sélectionnés pour leurs garanties de sécurité. Vos informations sont conservées pendant la durée nécessaire aux finalités décrites, puis supprimées ou anonymisées, sous réserve des obligations légales de conservation.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">7. Partage des données</h2>
        <p className="mt-3 text-gray-600">
          Nous ne vendons ni ne louons vos données personnelles. Elles peuvent être transmises à des sous-traitants strictement nécessaires au fonctionnement du service (hébergement, envoi d'e-mails, analyse) et liés par des obligations contractuelles de confidentialité et de sécurité.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">8. Sécurité</h2>
        <p className="mt-3 text-gray-600">
          Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, altération, perte ou divulgation. Cependant, aucun système n'est infaillible et nous ne pouvons garantir une sécurité absolue.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">9. Vos droits</h2>
        <p className="mt-3 text-gray-600">
          Conformément à la réglementation applicable, vous disposez d'un droit d'accès, de rectification, de suppression, de limitation du traitement et de portabilité de vos données. Vous pouvez exercer ces droits depuis les paramètres de votre compte ou en nous contactant directement.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">10. Modifications de la politique</h2>
        <p className="mt-3 text-gray-600">
          Nous pouvons mettre à jour cette politique de confidentialité à tout moment. La date de dernière mise à jour est indiquée ci-dessous. Nous vous invitons à la consulter régulièrement.
        </p>
      </section>

      <p className="mt-10 text-sm text-gray-500">
        Dernière mise à jour : 12 novembre 2026
      </p>
    </div>
  );
}
