import Stripe from 'stripe'

const apiKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'

export const stripe = new Stripe(apiKey, {
  apiVersion: '2026-06-24.dahlia'
})

export async function createPaymentIntent(amount: number, courseRef: string) {
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'eur',
    metadata: {
      courseRef
    }
  })
}

export function calculateCommission(amount: number, transporterType: string) {
  const commissionRate = {
    taxi: 0.10,
    vtc: 0.12,
    medical: 0.08
  }
  const rate = commissionRate[transporterType as keyof typeof commissionRate] || 0.10
  const commission = amount * rate
  const transporterEarnings = amount - commission
  return { commission, transporterEarnings }
}