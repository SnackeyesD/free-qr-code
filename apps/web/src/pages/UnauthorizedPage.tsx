import { Link } from 'react-router-dom';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-orange-600">401</h1>
      <p className="mt-4 text-xl font-semibold text-gray-900">Non authentifié</p>
      <p className="mt-2 text-gray-600">Veuillez vous connecter pour accéder à cette ressource.</p>
      <Link
        to="/login"
        className="mt-6 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        Se connecter
      </Link>
    </div>
  );
}
