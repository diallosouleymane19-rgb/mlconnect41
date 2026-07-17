'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SuiviPage({ params }: { params: { ref: string } }) {
  const [course, setCourse] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchCourse() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .rpc('get_course_by_ref', { ref: params.ref })
          .single()

        if (error) throw error
        setCourse(data)
      } catch (err: any) {
        setError(err.message || 'Course non trouvée')
      } finally {
        setLoading(false)
      }
    }

    fetchCourse()
  }, [params.ref])

  if (loading) return <div className="text-center py-20">Chargement...</div>
  if (error) return <div className="text-center py-20 text-red-600">{error}</div>

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold mb-6">Suivi de Course</h1>

        <div className="space-y-4">
          <div>
            <p className="text-gray-600">Référence</p>
            <p className="text-2xl font-bold text-blue-600">{course.reference}</p>
          </div>

          <div>
            <p className="text-gray-600">Statut</p>
            <p className="text-lg font-semibold capitalize">{course.statut}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">Départ</p>
              <p className="font-semibold">{course.adresse_depart}</p>
            </div>
            <div>
              <p className="text-gray-600">Destination</p>
              <p className="font-semibold">{course.destination}</p>
            </div>
          </div>

          <div>
            <p className="text-gray-600">Date et heure</p>
            <p className="font-semibold">{course.date_course} à {course.heure_course}</p>
          </div>

          <div>
            <p className="text-gray-600">Motif</p>
            <p className="font-semibold">{course.motif}</p>
          </div>

          <div>
            <p className="text-gray-600">Prix estimé</p>
            <p className="text-xl font-bold text-green-600">{course.montant_estime}€</p>
          </div>
        </div>
      </div>
    </main>
  )
}
