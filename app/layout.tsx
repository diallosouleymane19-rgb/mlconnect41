import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MobiLoireConnect41',
  description: 'Transport medical en Loir-et-Cher',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
