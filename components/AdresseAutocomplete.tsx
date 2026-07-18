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
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/adresses/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useCallback((q: string) => {
    setQuery(q);
    const timer = setTimeout(() => handleSearch(q), 300);
    return () => clearTimeout(timer);
  }, [handleSearch]);

  return (
    <div className="relative w-full">
      <label className="block text-sm font-medium mb-2">{label}</label>
      <input
        type="text"
        value={query}
        onChange={(e) => debouncedSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg"
      />
      {loading && <p className="text-sm text-gray-500">Recherche...</p>}
      {results.length > 0 && (
        <ul className="absolute top-full left-0 w-full bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
          {results.map((addr) => (
            <li key={addr.id}>
              <button
                onClick={() => {
                  onSelect(addr);
                  setQuery('');
                  setResults([]);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-100"
              >
                {addr.numero} {addr.rue} - {addr.code_postal} {addr.commune}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
