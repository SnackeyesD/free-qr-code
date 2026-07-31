import { Link } from 'react-router-dom';

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-red-600">403</h1>
      <p className="mt-4 text-xl font-semibold text-gray-900">Accès interdit</p>
      <p className="mt-2 text-gray-600">Vous n'avez pas les droits nécessaires pour accéder à cette page.</p>
      <Link to="/dashboard" className="mt-6 text-indigo-600 hover:text-indigo-500">
        Retour au tableau de bord
      </Link>
    </div>
  );
}
