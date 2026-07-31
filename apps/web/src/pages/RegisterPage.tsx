import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const registerSchema = z
  .object({
    nom: z.string().min(1, 'Nom requis'),
    email: z.string().email('Email invalide'),
    motDePasse: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    confirmation: z.string().min(1, 'Veuillez confirmer le mot de passe'),
    consentementMarketing: z.boolean().refine((v) => v === true, {
      message: 'Le consentement est obligatoire pour utiliser le service',
    }),
  })
  .refine((data) => data.motDePasse === data.confirmation, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmation'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      consentementMarketing: false,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    try {
      const input = { nom: data.nom, email: data.email, motDePasse: data.motDePasse, consentementMarketing: data.consentementMarketing };
      await registerUser(input);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError('Impossible de créer le compte. Veuillez vérifier vos informations.');
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow text-center">
          <h1 className="text-2xl font-bold text-gray-900">Compte créé !</h1>
          <p className="mt-2 text-gray-600">
            Un email de confirmation vous a été envoyé. Vous allez être redirigé vers la page de connexion.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow">
        <div>
          <h1 className="text-center text-2xl font-bold tracking-tight text-gray-900">
            Créer un compte gratuit
          </h1>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label htmlFor="nom" className="block text-sm font-medium text-gray-700">
              Nom
            </label>
            <input
              id="nom"
              type="text"
              autoComplete="name"
              {...register('nom')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              aria-invalid={errors.nom ? 'true' : 'false'}
              aria-describedby={errors.nom ? 'nom-error' : undefined}
            />
            {errors.nom && (
              <p id="nom-error" className="mt-1 text-sm text-red-600">
                {errors.nom.message}
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
              autoComplete="email"
              {...register('email')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="motDePasse" className="block text-sm font-medium text-gray-700">
              Mot de passe
            </label>
            <input
              id="motDePasse"
              type="password"
              autoComplete="new-password"
              {...register('motDePasse')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              aria-invalid={errors.motDePasse ? 'true' : 'false'}
              aria-describedby={errors.motDePasse ? 'password-error' : undefined}
            />
            {errors.motDePasse && (
              <p id="password-error" className="mt-1 text-sm text-red-600">
                {errors.motDePasse.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirmation" className="block text-sm font-medium text-gray-700">
              Confirmation du mot de passe
            </label>
            <input
              id="confirmation"
              type="password"
              autoComplete="new-password"
              {...register('confirmation')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              aria-invalid={errors.confirmation ? 'true' : 'false'}
              aria-describedby={errors.confirmation ? 'confirmation-error' : undefined}
            />
            {errors.confirmation && (
              <p id="confirmation-error" className="mt-1 text-sm text-red-600">
                {errors.confirmation.message}
              </p>
            )}
          </div>

          <div className="flex items-start gap-2">
            <input
              id="consentementMarketing"
              type="checkbox"
              {...register('consentementMarketing')}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              aria-invalid={errors.consentementMarketing ? 'true' : 'false'}
              aria-describedby={errors.consentementMarketing ? 'consent-error' : undefined}
            />
            <label htmlFor="consentementMarketing" className="text-sm text-gray-700">
              J'accepte de recevoir les emails marketing (obligatoire pour utiliser le service)
            </label>
          </div>
          {errors.consentementMarketing && (
            <p id="consent-error" className="text-sm text-red-600">
              {errors.consentementMarketing.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Inscription…' : "S'inscrire"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Déjà un compte ?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
