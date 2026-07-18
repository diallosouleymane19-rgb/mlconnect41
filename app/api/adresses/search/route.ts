import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || query.length < 2) return NextResponse.json({ results: [] });

    const { data, error } = await supabase
      .from('adresses_41')
      .select('id,numero,rue,commune,code_postal,latitude,longitude')
      .textSearch('full_text', `${query}:*`)
      .limit(10);

    if (error) throw error;
    return NextResponse.json({ results: data || [] });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}