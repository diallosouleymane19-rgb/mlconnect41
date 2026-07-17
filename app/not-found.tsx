import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900">404</h1>
        <p className="mt-2 text-sm text-slate-600">Page introuvable.</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
          Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}
