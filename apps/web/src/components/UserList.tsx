import type { Utilisateur } from '@free-qr/shared-types';

interface UserListProps {
  users: Utilisateur[];
  onToggleActive?: (id: string, estActif: boolean) => void;
  onChangeRole?: (id: string, role: 'utilisateur' | 'admin') => void;
  onDelete?: (id: string) => void;
}

export function UserList({ users, onToggleActive, onChangeRole, onDelete }: UserListProps) {
  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-gray-600">Aucun utilisateur trouvé.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Nom
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Email
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Rôle
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Statut
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Inscription
            </th>
            <th scope="col" className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onToggleActive={onToggleActive}
              onChangeRole={onChangeRole}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface UserRowProps {
  user: Utilisateur;
  onToggleActive?: (id: string, estActif: boolean) => void;
  onChangeRole?: (id: string, role: 'utilisateur' | 'admin') => void;
  onDelete?: (id: string) => void;
}

function UserRow({ user, onToggleActive, onChangeRole, onDelete }: UserRowProps) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{user.nom}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{user.email}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
        {onChangeRole ? (
          <select
            value={user.role}
            onChange={(e) => onChangeRole(user.id, e.target.value as 'utilisateur' | 'admin')}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          >
            <option value="utilisateur">Utilisateur</option>
            <option value="admin">Admin</option>
          </select>
        ) : (
          <span className="capitalize">{user.role}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${user.estActif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {user.estActif ? 'Actif' : 'Inactif'}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
        {user.dateInscription ? new Date(user.dateInscription).toLocaleDateString('fr-FR') : '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
        <div className="flex items-center justify-end gap-2">
          {onToggleActive && (
            <button
              type="button"
              onClick={() => onToggleActive(user.id, !user.estActif)}
              className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              {user.estActif ? 'Désactiver' : 'Activer'}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(user.id)}
              className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Supprimer
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
