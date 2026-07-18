'use client'
import { useState } from 'react'
import AdresseAutocomplete from '@/components/AdresseAutocomplete'

interface Address {
  id: number
  numero: number
  rue: string
  commune: string
  code_postal: string
  latitude: number
  longitude: number
}

export default function DemandePage() {
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    adresse_depart: '',
    adresse_depart_lat: 0,
    adresse_depart_lng: 0,
    destination: '',
    destination_lat: 0,
    destination_lng: 0,
    date_course: '',
    heure_course: '',
    motif: 'medical',
    type_service: 'taxi',
  })
  const [distance, setDistance] = useState<number | null>(null)
  const [price, setPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectAdresse = (type: 'depart' | 'destination', address: Address) => {
    if (type === 'depart') {
      setFormData({
        ...formData,
        adresse_depart: `${address.numero} ${address.rue}`,
        adresse_depart_lat: address.latitude,
        adresse_depart_lng: address.longitude,
      })
    } else {
      setFormData({
        ...formData,
        destination: `${address.numero} ${address.rue}`,
        destination_lat: address.latitude,
        destination_lng: address.longitude,
      })
    }
  }

  const calculerDistance = async () => {
    if (!formData.adresse_depart_lat || !formData.destination_lat) return
    
    try {
      const res = await fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat1: formData.adresse_depart_lat,
          lng1: formData.adresse_depart_lng,
          lat2: formData.destination_lat,
          lng2: formData.destination_lng,
        })
      })
      const data = await res.json()
      setDistance(data.distance)
      setPrice(data.price)
    } catch (e) {
      console.error(e)
      setError('Erreur calcul distance')
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = {
        ...formData,
        distance: distance || null,
        price: price || null,
      }
      const res = await fetch('/api/demande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        alert('Demande créée!')
        setFormData({
          nom: '', prenom: '', telephone: '',
          adresse_depart: '', adresse_depart_lat: 0, adresse_depart_lng: 0,
          destination: '', destination_lat: 0, destination_lng: 0,
          date_course: '', heure_course: '',
          motif: 'medical', type_service: 'taxi',
        })
        setDistance(null)
        setPrice(null)
      } else {
        setError('Erreur création demande')
      }
    } catch (e) {
      setError('Erreur: ' + e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Demande de Course</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Nom"
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            className="px-3 py-2 border rounded-lg"
            required
          />
          <input
            type="text"
            placeholder="Prénom"
            value={formData.prenom}
            onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
            className="px-3 py-2 border rounded-lg"
            required
          />
        </div>

        <input
          type="tel"
          placeholder="Téléphone"
          value={formData.telephone}
          onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          required
        />

        <AdresseAutocomplete
          label="Adresse de départ"
          placeholder="Chercher adresse..."
          onSelect={(addr) => selectAdresse('depart', addr)}
        />
        <p className="text-sm text-gray-600">{formData.adresse_depart}</p>

        <AdresseAutocomplete
          label="Destination"
          placeholder="Chercher adresse..."
          onSelect={(addr) => {
            selectAdresse('destination', addr)
            setTimeout(() => calculerDistance(), 100)
          }}
        />
        <p className="text-sm text-gray-600">{formData.destination}</p>

        {distance && price && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm">Distance: <strong>{distance.toFixed(1)} km</strong></p>
            <p className="text-lg font-bold">Prix estimé: <strong>{price.toFixed(2)}€</strong></p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            value={formData.date_course}
            onChange={(e) => setFormData({ ...formData, date_course: e.target.value })}
            className="px-3 py-2 border rounded-lg"
            required
          />
          <input
            type="time"
            value={formData.heure_course}
            onChange={(e) => setFormData({ ...formData, heure_course: e.target.value })}
            className="px-3 py-2 border rounded-lg"
            required
          />
        </div>

        <select
          value={formData.motif}
          onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="medical">Médical</option>
          <option value="loisir">Loisir</option>
          <option value="travail">Travail</option>
        </select>

        <select
          value={formData.type_service}
          onChange={(e) => setFormData({ ...formData, type_service: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="taxi">Taxi</option>
          <option value="ambulance">Ambulance</option>
        </select>

        {error && <p className="text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Création...' : 'Créer Demande'}
        </button>
      </form>
    </div>
  )
}
