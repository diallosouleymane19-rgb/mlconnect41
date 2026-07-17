import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  try {
    const { ref } = await params
    const supabase = createClient()
    const { data: course, error } = await supabase
      .from('courses')
      .select('*')
      .eq('reference', ref)
      .single()

    if (error || !course) {
      return Response.json({ error: 'Course not found' }, { status: 404 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(course.montant_estime * 100),
      currency: 'eur',
      metadata: {
        courseRef: ref,
        usagerNom: course.usager_nom
      }
    })

    return Response.json({ clientSecret: paymentIntent.client_secret })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}