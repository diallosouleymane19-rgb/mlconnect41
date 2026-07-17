'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const DemandeSchema = z.object({
  nom: z.string().min(2),
  prenom: z.string().min(2),
  telephone: z.string().min(10),
  adresse_depart: z.string().min(5),
  destination: z.string().min(5),
  date_course: z.string(),
  heure_course: z.string(),
  motif: z.string(),
  type_service: z.string(),
  distance_km: z.string().transform(Number),
  prescription: z.boolean()
})

function generateCourseRef() {
  return `REF-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
}

function estimatePrice(distance: number, serviceType: string): number {
  const basePrices = {
    taxi: 2.60,
    vtc: 3.50,
    medical: 2.50
  }
  const kmRate = {
    taxi: 1.05,
    vtc: 1.50,
    medical: 1.20
  }
  const base = basePrices[serviceType as keyof typeof basePrices] || 2.60
  const rate = kmRate[serviceType as keyof typeof kmRate] || 1.05
  return Math.round((base + distance * rate) * 100) / 100
}

export async function createDemande(formData: any) {
  try {
    const validated = DemandeSchema.parse(formData)

    const supabase = createClient()
    const ref = generateCourseRef()
    const montantEstime = estimatePrice(validated.distance_km, validated.type_service)

    const { error } = await supabase.from('courses').insert([{
      reference: ref,
      usager_nom: `${validated.prenom} ${validated.nom}`,
      telephone: validated.telephone,
      adresse_depart: validated.adresse_depart,
      destination: validated.destination,
      date_course: validated.date_course,
      heure_course: validated.heure_course,
      motif: validated.motif,
      type_service: validated.type_service,
      distance_km: validated.distance_km,
      montant_estime: montantEstime,
      prescription: validated.prescription,
      statut: 'en_attente'
    }])

    if (error) throw error

    return { ok: true, ref }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Erreur serveur' }
  }
}
