import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Recherche via la Base Adresse Nationale (BAN) officielle, filtree sur le Loir-et-Cher (41)
async function searchBAN(query: string) {
  const url =
    'https://api-adresse.data.gouv.fr/search/?q=' +
    encodeURIComponent(query) +
    '&limit=15&lat=47.6&lon=1.33';
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('BAN error ' + res.status);
  const data = await res.json();
  const features = (data.features || []).filter(
    (f: any) => (f.properties?.postcode || '').startsWith('41')
  );
  return features.slice(0, 10).map((f: any, i: number) => ({
    id: f.properties.id || i,
    numero: parseInt(f.properties.housenumber, 10) || 0,
    rue: f.properties.street || f.properties.name || '',
    commune: f.properties.city || '',
    code_postal: f.properties.postcode || '',
    latitude: f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
  }));
}

// Fallback: table Supabase adresses_41
async function searchSupabase(query: string) {
  const { data, error } = await supabase
    .from('adresses_41')
    .select('id,numero,rue,commune,code_postal,latitude,longitude')
    .textSearch('full_text', `${query}:*`)
    .limit(10);
  if (error) throw error;
  return data || [];
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || query.length < 2) return NextResponse.json({ results: [] });

    let results: any[] = [];
    try {
      results = await searchBAN(query);
    } catch (e) {
      console.error('BAN failed, fallback Supabase:', e);
    }
    if (!results.length) {
      try {
        results = await searchSupabase(query);
      } catch (e) {
        console.error('Supabase fallback failed:', e);
      }
    }
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}