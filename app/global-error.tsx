'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg">
          <h1 className="text-xl font-bold text-red-600">Erreur critique</h1>
          <p className="mt-2 text-sm text-slate-600">L'application a rencontre un probleme.</p>
          <button onClick={reset} className="mt-6 w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
            Reessayer
          </button>
        </div>
      </body>
    </html>
  );
}
