import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { lat1, lng1, lat2, lng2 } = await req.json();
    const response = await fetch(
      `http://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) throw new Error('OSRM error');
    const data = await response.json();
    const distance = data.routes[0]?.distance || 0;
    const duration = data.routes[0]?.duration || 0;

    return NextResponse.json({ 
      distance: distance / 1000, 
      duration, 
      price: Math.round((distance / 1000) * 1.5 * 100) / 100 
    });
  } catch (error) {
    console.error('Distance error:', error);
    return NextResponse.json({ error: 'Distance calculation failed' }, { status: 500 });
  }
}
