'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!)

function CheckoutContent() {
  const searchParams = useSearchParams()
  const courseRef = searchParams.get('ref')
  const [clientSecret, setClientSecret] = useState('')

  useEffect(() => {
    if (!courseRef) return

    fetch(`/api/checkout/${courseRef}`, { method: 'POST' })
      .then(res => res.json())
      .then(data => setClientSecret(data.clientSecret))
  }, [courseRef])

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      {clientSecret && (
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      )}
    </main>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center">Chargement...</div>}>
      <CheckoutContent />
    </Suspense>
  )
}