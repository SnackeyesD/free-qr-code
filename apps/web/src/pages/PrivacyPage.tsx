export default function PrivacyPage() {
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
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">5. Hébergement et conservation</h2>
        <p className="mt-3 text-gray-600">
          Les données sont hébergées par des prestataires techniques sélectionnés pour leurs garanties de sécurité. Vos informations sont conservées pendant la durée nécessaire aux finalités décrites, puis supprimées ou anonymisées, sous réserve des obligations légales de conservation.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">6. Partage des données</h2>
        <p className="mt-3 text-gray-600">
          Nous ne vendons ni ne louons vos données personnelles. Elles peuvent être transmises à des sous-traitants strictement nécessaires au fonctionnement du service (hébergement, envoi d'e-mails, analyse) et liés par des obligations contractuelles de confidentialité et de sécurité.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">7. Sécurité</h2>
        <p className="mt-3 text-gray-600">
          Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, altération, perte ou divulgation. Cependant, aucun système n'est infaillible et nous ne pouvons garantir une sécurité absolue.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">8. Vos droits</h2>
        <p className="mt-3 text-gray-600">
          Conformément à la réglementation applicable, vous disposez d'un droit d'accès, de rectification, de suppression, de limitation du traitement et de portabilité de vos données. Vous pouvez exercer ces droits depuis les paramètres de votre compte ou en nous contactant directement.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">9. Modifications de la politique</h2>
        <p className="mt-3 text-gray-600">
          Nous pouvons mettre à jour cette politique de confidentialité à tout moment. La date de dernière mise à jour est indiquée ci-dessous. Nous vous invitons à la consulter régulièrement.
        </p>
      </section>

      <p className="mt-10 text-sm text-gray-500">
        Dernière mise à jour : 2 août 2026
      </p>
    </div>
  );
}
