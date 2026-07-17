'use client'

import { useState } from 'react'
import { createDemande } from './actions'

export default function DemandePage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    adresse_depart: '',
    destination: '',
    date_course: '',
    heure_course: '',
    motif: 'medical',
    type_service: 'taxi',
    distance_km: '',
    prescription: false
  })

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await createDemande(formData)
      if (result.ok) {
        setSuccess(true)
        setFormData({
          nom: '',
          prenom: '',
          telephone: '',
          adresse_depart: '',
          destination: '',
          date_course: '',
          heure_course: '',
          motif: 'medical',
          type_service: 'taxi',
          distance_km: '',
          prescription: false
        })
        setTimeout(() => setSuccess(false), 5000)
      } else {
        setError(result.error || 'Erreur lors de la création')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">Demande de Course</h1>
        <p className="text-gray-600 mb-6">Transport médical en Loir-et-Cher</p>

        {success && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            Demande créée avec succès!
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              name="nom"
              placeholder="Nom"
              value={formData.nom}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            <input
              type="text"
              name="prenom"
              placeholder="Prénom"
              value={formData.prenom}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <input
            type="tel"
            name="telephone"
            placeholder="Téléphone"
            value={formData.telephone}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />

          <input
            type="text"
            name="adresse_depart"
            placeholder="Adresse de départ"
            value={formData.adresse_depart}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />

          <input
            type="text"
            name="destination"
            placeholder="Destination"
            value={formData.destination}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />

          <div className="grid grid-cols-2 gap-4">
            <input
              type="date"
              name="date_course"
              value={formData.date_course}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            <input
              type="time"
              name="heure_course"
              value={formData.heure_course}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>

          <select
            name="motif"
            value={formData.motif}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="medical">Consultation médicale</option>
            <option value="hospitalisation">Hospitalisation</option>
            <option value="urgence">Urgence</option>
            <option value="autre">Autre</option>
          </select>

          <select
            name="type_service"
            value={formData.type_service}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
          >
            <option value="taxi">Taxi</option>
            <option value="vtc">VTC</option>
            <option value="medical">Transport Médical</option>
          </select>

          <input
            type="number"
            name="distance_km"
            placeholder="Distance (km)"
            value={formData.distance_km}
            onChange={handleChange}
            step="0.1"
            className="w-full border border-gray-300 rounded px-3 py-2"
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="prescription"
              checked={formData.prescription}
              onChange={handleChange}
              className="w-4 h-4"
            />
            <span className="text-gray-700">Avec prescription médicale</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Envoi...' : 'Soumettre la demande'}
          </button>
        </form>
      </div>
    </main>
  )
}
