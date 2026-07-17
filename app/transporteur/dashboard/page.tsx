'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logoutAction } from '@/app/login/actions'

export default function DashboardPage() {
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCourses() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('statut', 'en_attente')
          .order('date_course', { ascending: true })

        if (error) throw error
        setCourses(data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchCourses()
  }, [])

  const handleAccept = async (ref: string) => {
    try {
      const supabase = createClient()
      await supabase
        .from('courses')
        .update({ statut: 'acceptee' })
        .eq('reference', ref)

      setCourses(courses.filter(c => c.reference !== ref))
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="text-center py-20">Chargement...</div>

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard Transporteur</h1>
          <form action={logoutAction}>
            <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
              Déconnexion
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Courses en attente ({courses.length})</h2>

          {courses.length === 0 ? (
            <p className="text-gray-600">Aucune course en attente</p>
          ) : (
            <div className="space-y-4">
              {courses.map(course => (
                <div key={course.id} className="border border-gray-300 rounded p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-gray-600">Référence</p>
                      <p className="font-semibold text-blue-600">{course.reference}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Client</p>
                      <p className="font-semibold">{course.usager_nom}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Départ</p>
                      <p className="font-semibold">{course.adresse_depart}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Destination</p>
                      <p className="font-semibold">{course.destination}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Prix</p>
                      <p className="font-bold text-green-600">{course.montant_estime}€</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Distance</p>
                      <p className="font-semibold">{course.distance_km} km</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAccept(course.reference)}
                    className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700"
                  >
                    Accepter la course
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
