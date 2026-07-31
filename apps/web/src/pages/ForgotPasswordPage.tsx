import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Email invalide'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await api.post('/auth/forgot-password', data);
      setSubmitted(true);
    } catch {
      setError("Impossible d'envoyer la demande. Veuillez réessayer.");
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow text-center">
          <h1 className="text-2xl font-bold text-gray-900">Email envoyé</h1>
          <p className="mt-2 text-gray-600">
            Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow">
        <h1 className="text-center text-2xl font-bold text-gray-900">Mot de passe oublié</h1>
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Envoi…' : 'Envoyer le lien'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
