import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

const schema = z
  .object({
    motDePasse: z.string().min(8, 'Au moins 8 caractères'),
    confirmation: z.string().min(1, 'Veuillez confirmer le mot de passe'),
  })
  .refine((data) => data.motDePasse === data.confirmation, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmation'],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, motDePasse: data.motDePasse });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch {
      setError('Le lien est invalide ou a expiré.');
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow text-center">
          <h1 className="text-2xl font-bold text-gray-900">Mot de passe réinitialisé</h1>
          <p className="mt-2 text-gray-600">Vous allez être redirigé vers la page de connexion.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow">
        <h1 className="text-center text-2xl font-bold text-gray-900">Réinitialiser le mot de passe</h1>
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div>
            <label htmlFor="motDePasse" className="block text-sm font-medium text-gray-700">Nouveau mot de passe</label>
            <input
              id="motDePasse"
              type="password"
              {...register('motDePasse')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
            {errors.motDePasse && <p className="mt-1 text-sm text-red-600">{errors.motDePasse.message}</p>}
          </div>
          <div>
            <label htmlFor="confirmation" className="block text-sm font-medium text-gray-700">Confirmation</label>
            <input
              id="confirmation"
              type="password"
              {...register('confirmation')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
            {errors.confirmation && <p className="mt-1 text-sm text-red-600">{errors.confirmation.message}</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
}
