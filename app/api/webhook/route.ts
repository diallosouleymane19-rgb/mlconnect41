import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')!

  let event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    return new Response('Invalid signature', { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as any
    const courseRef = paymentIntent.metadata.courseRef

    const supabase = createClient()
    await supabase
      .from('courses')
      .update({ statut: 'payee' })
      .eq('reference', courseRef)
  }

  return Response.json({ ok: true })
}