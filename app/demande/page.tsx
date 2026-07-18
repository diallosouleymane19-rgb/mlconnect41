'use client'
import { useState } from 'react'
import AdresseAutocomplete from '@/components/AdresseAutocomplete'

interface Address {
  latitude: number
  longitude: number
  numero: number
  rue: string
  commune: string
}

export default function Page() {
  const [depart, setDepart] = useState({ lat: 0, lng: 0, text: '' })
  const [dest, setDest] = useState({ lat: 0, lng: 0, text: '' })
  const [distance, setDistance] = useState<number | null>(null)
  const [price, setPrice] = useState<number | null>(null)

  const selectAdresse = (type: string, a: Address) => {
    if (type === 'depart') {
      setDepart({ lat: a.latitude, lng: a.longitude, text: a.numero + ' ' + a.rue + ', ' + a.commune })
    } else {
      setDest({ lat: a.latitude, lng: a.longitude, text: a.numero + ' ' + a.rue + ', ' + a.commune })
      calcDistance(depart, { lat: a.latitude, lng: a.longitude })
    }
  }

  const calcDistance = async (dp: any, ds: any) => {
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
    } catch (e) { console.error(e) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #1a4a6e 0%, #123152 60%, #0d2340 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ color: '#fff', fontSize: 26, margin: 0 }}>Demande de Course</h1>
          <p style={{ color: '#9fc3e8', fontSize: 14, marginTop: 6 }}>Transport médical · Loir-et-Cher (41)</p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 18, padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
          <AdresseAutocomplete label="Adresse de départ" placeholder="Chercher une adresse..." onSelect={(a) => selectAdresse('depart', a)} />
          {depart.text && <p style={{ color: '#7ee0a3', fontSize: 13, margin: '0 0 14px' }}>✓ {depart.text}</p>}

          <AdresseAutocomplete label="Destination" placeholder="Chercher une adresse..." onSelect={(a) => selectAdresse('destination', a)} />
          {dest.text && <p style={{ color: '#7ee0a3', fontSize: 13, margin: '0 0 14px' }}>✓ {dest.text}</p>}

          {distance !== null && price !== null && (
            <div style={{ background: 'rgba(126,224,163,0.12)', border: '1px solid rgba(126,224,163,0.4)', borderRadius: 12, padding: 16, marginTop: 8 }}>
              <p style={{ color: '#cfe3f5', fontSize: 14, margin: 0 }}>Distance : <strong>{distance.toFixed(1)} km</strong></p>
              <p style={{ color: '#7ee0a3', fontSize: 20, fontWeight: 700, margin: '6px 0 0' }}>Prix estimé : {price.toFixed(2)} €</p>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#6f93b8', fontSize: 12, marginTop: 20 }}>
          <a href="/" style={{ color: '#9fc3e8' }}>← Retour à l'accueil</a>
        </p>
      </div>
    </div>
  )
}