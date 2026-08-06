export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-gray-900">
      <h1 className="text-3xl font-bold">Conditions d'utilisation</h1>
      <p className="mt-4 text-gray-600">
        En utilisant Free QR Code, vous acceptez les présentes conditions d'utilisation. Veuillez les lire attentivement.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">1. Description du service</h2>
        <p className="mt-3 text-gray-600">
          Free QR Code est un service en ligne de génération, personnalisation, gestion et analyse de QR codes. Il permet de créer des QR codes statiques ou dynamiques, de les partager et de consulter des statistiques d'utilisation.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">2. Inscription et compte utilisateur</h2>
        <p className="mt-3 text-gray-600">
          L'utilisation de certaines fonctionnalités nécessite la création d'un compte. Vous vous engagez à fournir des informations exactes, à maintenir la confidentialité de vos identifiants et à informer immédiatement l'éditeur en cas de compromission de votre compte.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">3. Utilisation acceptable</h2>
        <p className="mt-3 text-gray-600">Vous vous interdisez d'utiliser Free QR Code pour :</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-gray-600">
          <li>Générer des QR codes redirigeant vers des contenus illégaux, frauduleux, malveillants ou diffamatoires ;</li>
          <li>Hameçonner, usurper l'identité d'un tiers ou tromper les utilisateurs ;</li>
          <li>Distribuer des virus, malwares ou tout logiciel nuisible ;</li>
          <li>Contourner les limites d'utilisation, notamment par des abus massifs de génération automatisée ;</li>
          <li>Porter atteinte aux droits de propriété intellectuelle ou à la vie privée d'autrui.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">4. Propriété intellectuelle</h2>
        <p className="mt-3 text-gray-600">
          L'interface, la marque, les logiciels et les éléments graphiques de Free QR Code sont la propriété de l'éditeur. Vous conservez la propriété du contenu que vous encodez dans vos QR codes, sous réserve qu'il respecte les lois en vigueur et les présentes conditions.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">5. Confidentialité</h2>
        <p className="mt-3 text-gray-600">
          Vos données personnelles sont traitées conformément à notre politique de confidentialité disponible à l'adresse <code>/legal/privacy</code>. En utilisant le service, vous acceptez cette politique.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">6. Responsabilité</h2>
        <p className="mt-3 text-gray-600">
          Vous êtes seul responsable du contenu que vous générez, diffusez ou rendez accessible via vos QR codes. Free QR Code ne peut être tenu responsable des conséquences directes ou indirectes liées à l'utilisation du service par un utilisateur, ni à l'indisponibilité temporaire du service.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">7. Limitation de responsabilité</h2>
        <p className="mt-3 text-gray-600">
          Dans la mesure maximale autorisée par la loi, la responsabilité de Free QR Code est limitée aux préjudices directs et prévisibles. L'éditeur ne saurait être responsable des pertes de données, de chiffre d'affaires ou de toute autre conséquence indirecte, sauf faute lourde ou dolosive.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">8. Modifications des conditions</h2>
        <p className="mt-3 text-gray-600">
          Nous nous réservons le droit de modifier les présentes conditions à tout moment. Les utilisateurs seront informés des modifications substantielles par e-mail ou via le service. L'utilisation continue du service après modification vaut acceptation des nouvelles conditions.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">9. Résiliation</h2>
        <p className="mt-3 text-gray-600">
          Vous pouvez supprimer votre compte à tout moment depuis les paramètres du service. L'éditeur se réserve le droit de suspendre ou de résilier un compte en cas de violation des présentes conditions, sans préavis ni indemnité. Les données associées au compte peuvent être supprimées conformément à la politique de confidentialité.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">10. Droit applicable</h2>
        <p className="mt-3 text-gray-600">
          Les présentes conditions sont régies par le droit applicable au lieu d'établissement de l'éditeur. Tout litige relatif à leur interprétation ou à leur exécution sera soumis à la compétence des juridictions compétentes, sous réserve d'une attribution de compétence spécifique.
        </p>
      </section>

      <p className="mt-10 text-sm text-gray-500">
        Dernière mise à jour : 2 août 2026
      </p>
    </div>
  );
}
