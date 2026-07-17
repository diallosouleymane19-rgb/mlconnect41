export function generateCourseRef(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = 'REF-';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

export function estimatePrice(distanceKm: number, serviceType: string): number {
  const basePrices: Record<string, number> = {
    taxi_immediat: 15,
    taxi_planifie: 10,
    vsl: 12,
    ambulance: 25,
  };
  const basePrice = basePrices[serviceType] || 10;
  return basePrice + distanceKm * 0.8;
}
