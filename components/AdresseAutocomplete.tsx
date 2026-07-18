'use client';
import React, { useState, useCallback } from 'react';

interface Address {
  id: number;
  numero: number;
  rue: string;
  commune: string;
  code_postal: string;
  latitude: number;
  longitude: number;
}

interface Props {
  onSelect: (address: Address) => void;
  label?: string;
  placeholder?: string;
}

export default function AdresseAutocomplete({ onSelect, label, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/adresses/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  const debouncedSearch = useCallback((q: string) => {
    setQuery(q);
    const timer = setTimeout(() => handleSearch(q), 300);
    return () => clearTimeout(timer);
  }, [handleSearch]);

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: 16 }}>
      <label style={{ display: 'block', color: '#cfe3f5', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      <input
        type="text"
        value={query}
        onChange={(e) => debouncedSearch(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
      />
      {loading && <p style={{ color: '#9fc3e8', fontSize: 13, margin: '6px 0 0' }}>Recherche...</p>}
      {results.length > 0 && (
        <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1d3a5f', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, marginTop: 6, padding: 4, listStyle: 'none', zIndex: 20, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {results.map((addr) => (
            <li key={addr.id}>
              <button
                type="button"
                onClick={() => { onSelect(addr); setQuery(''); setResults([]); }}
                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', borderRadius: 8 }}
              >
                {addr.numero} {addr.rue} — {addr.code_postal} {addr.commune}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}