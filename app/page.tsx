import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-brand-700 p-4">
      <div className="mx-auto max-w-md text-white text-center py-20">
        <h1 className="text-3xl font-bold mb-6">MobiLoireConnect41</h1>
        <p className="mb-8">Transport medical en Loir-et-Cher</p>
        <div className="space-y-3">
          <Link href="/demande" className="block rounded-lg bg-white text-brand-700 font-bold py-2 hover:bg-slate-50">
            Faire une demande
          </Link>
          <Link href="/login" className="block rounded-lg border border-white text-white font-bold py-2 hover:bg-white/10">
            Espace pro
          </Link>
        </div>
      </div>
    </main>
  )
}
