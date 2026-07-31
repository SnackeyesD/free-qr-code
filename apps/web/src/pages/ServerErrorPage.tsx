import { Link } from 'react-router-dom';

export default function ServerErrorPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-600">500</h1>
      <p className="mt-4 text-xl font-semibold text-gray-900">Erreur serveur</p>
      <p className="mt-2 text-gray-600">Une erreur inattendue s'est produite. Veuillez réessayer plus tard.</p>
      <Link to="/" className="mt-6 text-indigo-600 hover:text-indigo-500">
        Retour à l'accueil
      </Link>
    </div>
  );
}
