import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-indigo-600">404</h1>
      <p className="mt-4 text-xl font-semibold text-gray-900">Page introuvable</p>
      <p className="mt-2 text-gray-600">La page que vous recherchez n'existe pas ou a été déplacée.</p>
      <div className="mt-6 flex gap-4">
        <Link to="/" className="text-indigo-600 hover:text-indigo-500">
          Retour à l'accueil
        </Link>
        <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-500">
          Tableau de bord
        </Link>
      </div>
    </div>
  );
}
