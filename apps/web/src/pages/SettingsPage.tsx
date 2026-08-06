import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSettings } from '@/hooks/useSettings';

const profileSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  consentementMarketing: z.boolean(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    ancienMotDePasse: z.string().min(1, 'L\'ancien mot de passe est requis'),
    nouveauMotDePasse: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères'),
    confirmation: z.string().min(1, 'Veuillez confirmer le nouveau mot de passe'),
  })
  .refine((data) => data.nouveauMotDePasse === data.confirmation, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmation'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user, isLoading, isSaving, error, success, update, refresh, clearMessages } = useSettings();

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    reset: resetProfile,
    formState: { errors: profileErrors, isDirty: isProfileDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nom: user?.nom ?? '',
      consentementMarketing: user?.consentementMarketing ?? false,
    },
  });

  useEffect(() => {
    if (user) {
      resetProfile({
        nom: user.nom,
        consentementMarketing: user.consentementMarketing,
      });
    }
  }, [user, resetProfile]);

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      ancienMotDePasse: '',
      nouveauMotDePasse: '',
      confirmation: '',
    },
  });

  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  const onSubmitProfile = async (data: ProfileFormData) => {
    clearMessages();
    await update({
      nom: data.nom,
      consentementMarketing: data.consentementMarketing,
    });
  };

  const onSubmitPassword = async (data: PasswordFormData) => {
    clearMessages();
    await update({
      ancienMotDePasse: data.ancienMotDePasse,
      nouveauMotDePasse: data.nouveauMotDePasse,
    });
    resetPassword();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Paramètres</h2>
          <p className="mt-2 text-gray-600">Gérez vos informations de profil et la sécurité de votre compte.</p>
        </div>
      </div>

      {success && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700" role="status">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
          <button
            type="button"
            onClick={() => void refresh()}
            className="ml-2 font-semibold underline hover:text-red-800"
          >
            Réessayer
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">Chargement…</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg bg-white shadow">
            <div className="border-b border-gray-200">
              <nav aria-label="Paramètres" className="-mb-px flex space-x-8 px-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                    activeTab === 'profile'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Profil
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('password')}
                  className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                    activeTab === 'password'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Mot de passe
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'profile' && (
                <form onSubmit={handleSubmitProfile(onSubmitProfile)} className="space-y-6" noValidate>
                  <div>
                    <label htmlFor="nom" className="block text-sm font-medium text-gray-700">
                      Nom
                    </label>
                    <input
                      id="nom"
                      type="text"
                      autoComplete="name"
                      {...registerProfile('nom')}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      aria-invalid={profileErrors.nom ? 'true' : 'false'}
                      aria-describedby={profileErrors.nom ? 'nom-error' : undefined}
                    />
                    {profileErrors.nom && (
                      <p id="nom-error" className="mt-1 text-sm text-red-600">
                        {profileErrors.nom.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={user?.email ?? ''}
                      readOnly
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 shadow-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">L'email ne peut pas être modifié.</p>
                  </div>

                  <div className="flex items-start gap-3">
                    <input
                      id="consentementMarketing"
                      type="checkbox"
                      {...registerProfile('consentementMarketing')}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="consentementMarketing" className="text-sm text-gray-700">
                      J'accepte de recevoir les emails marketing
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="submit"
                      disabled={isSaving || !isProfileDirty}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                    >
                      {isSaving ? 'Enregistrement…' : 'Sauvegarder le profil'}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'password' && (
                <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="space-y-6" noValidate>
                  <div>
                    <label htmlFor="ancienMotDePasse" className="block text-sm font-medium text-gray-700">
                      Ancien mot de passe
                    </label>
                    <input
                      id="ancienMotDePasse"
                      type="password"
                      autoComplete="current-password"
                      {...registerPassword('ancienMotDePasse')}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      aria-invalid={passwordErrors.ancienMotDePasse ? 'true' : 'false'}
                      aria-describedby={passwordErrors.ancienMotDePasse ? 'ancien-error' : undefined}
                    />
                    {passwordErrors.ancienMotDePasse && (
                      <p id="ancien-error" className="mt-1 text-sm text-red-600">
                        {passwordErrors.ancienMotDePasse.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="nouveauMotDePasse" className="block text-sm font-medium text-gray-700">
                      Nouveau mot de passe
                    </label>
                    <input
                      id="nouveauMotDePasse"
                      type="password"
                      autoComplete="new-password"
                      {...registerPassword('nouveauMotDePasse')}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      aria-invalid={passwordErrors.nouveauMotDePasse ? 'true' : 'false'}
                      aria-describedby={passwordErrors.nouveauMotDePasse ? 'nouveau-error' : undefined}
                    />
                    {passwordErrors.nouveauMotDePasse && (
                      <p id="nouveau-error" className="mt-1 text-sm text-red-600">
                        {passwordErrors.nouveauMotDePasse.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirmation" className="block text-sm font-medium text-gray-700">
                      Confirmation du nouveau mot de passe
                    </label>
                    <input
                      id="confirmation"
                      type="password"
                      autoComplete="new-password"
                      {...registerPassword('confirmation')}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                      aria-invalid={passwordErrors.confirmation ? 'true' : 'false'}
                      aria-describedby={passwordErrors.confirmation ? 'confirmation-error' : undefined}
                    />
                    {passwordErrors.confirmation && (
                      <p id="confirmation-error" className="mt-1 text-sm text-red-600">
                        {passwordErrors.confirmation.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                    >
                      {isSaving ? 'Enregistrement…' : 'Mettre à jour le mot de passe'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
