'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg">
        <h1 className="text-xl font-bold text-red-600">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-slate-600">{error.message || 'Erreur inattendue'}</p>
        <div className="mt-6 flex gap-2">
          <button onClick={reset} className="flex-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
            Réessayer
          </button>
          <Link href="/" className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
