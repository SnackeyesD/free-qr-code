import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const PRIMARY_CTA = 'Créer mon premier QR';

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600"
    >
      <path d="m4 10.5 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M2.5 8h11M10 4.5 13.5 8 10 11.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FEATURES = [
  {
    title: 'QR statiques',
    text: 'Le contenu est gravé dans le QR : aucun serveur à joindre, aucune expiration. Idéal pour un Wi-Fi invité ou un lien permanent.',
  },
  {
    title: 'QR dynamiques',
    text: 'Le QR pointe vers un alias court. Vous changez la destination quand vous voulez, sans réimprimer l’affiche, le menu ou le badge.',
  },
  {
    title: 'Personnalisation',
    text: 'Couleurs, fond, logo central, taille, cadre et niveau de correction d’erreur. L’aperçu en direct montre le rendu final.',
  },
  {
    title: '9 formats de contenu',
    text: 'Lien, texte, email, téléphone, SMS, Wi-Fi, vCard, géolocalisation et PDF. Chaque format est validé avant génération.',
  },
  {
    title: 'Fiches structurées',
    text: 'Composez un document à champs libres — coordonnées, horaires, offre, informations pratiques — et publiez-le sur une page dédiée.',
  },
  {
    title: 'Cartes de visite',
    text: 'Une carte s’affiche d’abord comme une page d’informations. Le visiteur choisit ensuite d’ajouter le contact à son téléphone via une vCard.',
  },
  {
    title: 'Statistiques de scans',
    text: 'Nombre de scans total et par QR, directement dans le tableau de bord. Les adresses IP sont anonymisées avant stockage.',
  },
  {
    title: 'Exports PNG, SVG, PDF',
    text: 'PNG pour le web et le print courant, SVG pour un rendu net à toute taille, PDF pour l’impression professionnelle.',
  },
  {
    title: 'API et clés à permissions',
    text: 'Créez, listez et gérez vos QR depuis vos propres outils avec des clés API à permissions fines, révocables en un clic.',
  },
];

const STEPS = [
  {
    number: '1',
    title: 'Choisissez le contenu',
    text: 'Un lien, une fiche, une carte de visite, un Wi-Fi… Le formulaire valide les données au fur et à mesure.',
  },
  {
    number: '2',
    title: 'Personnalisez le QR',
    text: 'Couleurs, logo, taille et correction d’erreur. L’aperçu est identique au fichier téléchargé.',
  },
  {
    number: '3',
    title: 'Partagez et suivez',
    text: 'Téléchargez en PNG, SVG ou PDF, imprimez, puis suivez les scans sans réimprimer si la destination change.',
  },
];

export default function FeaturesPage() {
  const { user } = useAuth();
  const dashboardTo = user ? '/dashboard' : '/register';

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden border-b border-gray-200 bg-gray-50">
        <div aria-hidden="true" className="qr-grid-bg pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
            Fonctionnalités
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Tout ce qu’il faut pour créer, imprimer et suivre un QR code
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-600">
            Free QR Code réunit la génération, la personnalisation, les fiches
            publiques et les statistiques dans un outil gratuit. Sans carte
            bancaire et sans service tiers pour afficher vos pages.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to={dashboardTo}
              className="group inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              {PRIMARY_CTA}
              <ArrowIcon />
            </Link>
            <Link
              to="/pricing"
              className="text-sm font-semibold text-gray-900 hover:text-indigo-600"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
            La boîte à outils
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            Des fonctionnalités concrètes, pas des promesses
          </h2>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-gray-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              En pratique
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
              Trois étapes, de l’idée à l’impression
            </h2>
          </div>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.number} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-base font-bold text-white"
                >
                  {step.number}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              Gratuit et responsable
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
              Un outil simple, des engagements clairs
            </h2>
            <p className="mt-4 leading-7 text-gray-600">
              La création de QR statiques et dynamiques, la personnalisation et
              les statistiques sont gratuites. Les pages publiques de fiches ne
              chargent aucune police, image ou script provenant d’un tiers.
            </p>
          </div>
          <ul className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-6">
            {[
              'Sans carte bancaire et sans compte payant obligatoire',
              'Adresses IP anonymisées avant stockage des statistiques',
              'Aucun HTML ni Markdown fourni par l’utilisateur dans les fiches',
              'Exports PNG, SVG et PDF disponibles immédiatement',
              'Suppression réelle des données et des fiches à la demande',
            ].map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-gray-700">
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white">
            Créez votre premier QR code en moins de deux minutes
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-300">
            Gratuit, sans carte bancaire. Vous pourrez modifier la destination
            plus tard sans réimprimer.
          </p>
          <div className="mt-8">
            <Link
              to={dashboardTo}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {PRIMARY_CTA}
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
