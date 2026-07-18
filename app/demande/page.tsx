'use client'
import { useState } from 'react'
import AdresseAutocomplete from '@/components/AdresseAutocomplete'

export default function Page() {
  const [depart, setDepart] = useState({ lat: 0, lng: 0, text: '' })
  const [dest, setDest] = useState({ lat: 0, lng: 0, text: '' })
  const [distance, setDistance] = useState(null)
  const [price, setPrice] = useState(null)

  const selectAdresse = (type, a) => {
    if (type === 'depart') {
      setDepart({ lat: a.latitude, lng: a.longitude, text: a.numero + ' ' + a.rue })
    } else {
      setDest({ lat: a.latitude, lng: a.longitude, text: a.numero + ' ' + a.rue })
      calcDistance(depart, { lat: a.latitude, lng: a.longitude })
    }
  }

  const calcDistance = async (dp, ds) => {
    if (!dp.lat || !ds.lat) return
    try {
      const res = await fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat1: dp.lat, lng1: dp.lng, lat2: ds.lat, lng2: ds.lng })
      })
      const data = await res.json()
      setDistance(data.distance)
      setPrice(data.price)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Demande de Course</h1>
      <AdresseAutocomplete label="Depart" placeholder="Chercher..." onSelect={(a) => selectAdresse('depart', a)} />
      <p className="text-sm mt-1">{depart.text}</p>
      <AdresseAutocomplete label="Destination" placeholder="Chercher..." onSelect={(a) => selectAdresse('destination', a)} />
      <p className="text-sm mt-1">{dest.text}</p>
      {distance && <div className="bg-blue-50 p-4 rounded-lg mt-4"><p>Distance: {distance.toFixed(1)} km</p><p className="font-bold">Prix: {price.toFixed(2)} EUR</p></div>}
    </div>
  )
}