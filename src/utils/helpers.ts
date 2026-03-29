export function getStoreCoordinates(locationName: string) {
  if (!locationName) return null;
  const loc = locationName.toLowerCase();
  // Major Cities & Towns
  if (loc.includes('suva')) return { lat: -18.1416, lon: 178.4419 };
  if (loc.includes('nadi')) return { lat: -17.8000, lon: 177.4167 };
  if (loc.includes('lautoka')) return { lat: -17.6167, lon: 177.4667 };
  if (loc.includes('labasa')) return { lat: -16.4333, lon: 179.3667 };
  if (loc.includes('nausori')) return { lat: -18.0333, lon: 178.5333 };
  if (loc.includes('ba')) return { lat: -17.5333, lon: 177.6833 };
  if (loc.includes('sigatoka')) return { lat: -18.1405, lon: 177.5089 };
  if (loc.includes('savusavu')) return { lat: -16.7788, lon: 179.3333 };
  if (loc.includes('rakiraki')) return { lat: -17.3667, lon: 178.1500 };
  if (loc.includes('tavua')) return { lat: -17.4333, lon: 177.8667 };
  if (loc.includes('navua')) return { lat: -18.2167, lon: 178.1833 };
  if (loc.includes('levuka')) return { lat: -17.6833, lon: 178.8333 };
  if (loc.includes('tavuki')) return { lat: -19.0667, lon: 178.1167 };
  if (loc.includes('nabouwalu')) return { lat: -16.9833, lon: 178.7000 };
  
  // Specific Suburbs & Areas
  if (loc.includes('lami')) return { lat: -18.1167, lon: 178.4167 };
  if (loc.includes('nasinu')) return { lat: -18.0833, lon: 178.5000 };
  if (loc.includes('nakasi')) return { lat: -18.0667, lon: 178.5167 };
  if (loc.includes('makoi')) return { lat: -18.0833, lon: 178.5000 };
  if (loc.includes('valelevu')) return { lat: -18.0833, lon: 178.4833 };
  if (loc.includes('namaka')) return { lat: -17.7667, lon: 177.4333 };
  if (loc.includes('martintar')) return { lat: -17.7833, lon: 177.4333 };
  if (loc.includes('denarau')) return { lat: -17.7667, lon: 177.3833 };
  if (loc.includes('pacific harbour')) return { lat: -18.2500, lon: 178.0667 };
  if (loc.includes('korolevu')) return { lat: -18.2167, lon: 177.7333 };
  
  // Specific Malls/Stores
  if (loc.includes('mhcc')) return { lat: -18.1416, lon: 178.4419 };
  if (loc.includes('damodar')) return { lat: -18.1500, lon: 178.4500 };
  if (loc.includes('tappoo')) return { lat: -18.1416, lon: 178.4419 };
  if (loc.includes('rb patel')) return { lat: -18.1416, lon: 178.4419 }; // Default to Suva if just RB Patel
  if (loc.includes('new world')) return { lat: -18.1416, lon: 178.4419 }; // Default to Suva if just New World
  
  return null;
}

export function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export function parseWeightToKg(weightStr: string | undefined | null): number | null {
  if (!weightStr) return null;
  const lower = weightStr.toLowerCase().trim();
  const match = lower.match(/([\d.]+)\s*(kg|g|gm|l|ml)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  const unit = match[2];
  if (unit === 'kg' || unit === 'l') return val;
  if (unit === 'g' || unit === 'gm' || unit === 'ml') return val / 1000;
  return null;
}

export function getEffectivePrice(deal: any): number {
  if (deal.price) return deal.price;
  if (deal.variants && deal.variants.length > 0) {
    return Math.min(...deal.variants.map((v: any) => v.price));
  }
  return Infinity;
}

export function getNormalizedPrice(deal: any): { pricePerKg: number | null, unit: string } {
  if (deal.price_per_unit) return { pricePerKg: deal.price_per_unit, unit: 'kg' };
  
  const price = getEffectivePrice(deal);
  if (price === Infinity) return { pricePerKg: null, unit: 'kg' };

  const weightKg = parseWeightToKg(deal.weight);
  if (weightKg && weightKg > 0) {
    return { pricePerKg: price / weightKg, unit: 'kg' };
  }
  return { pricePerKg: null, unit: 'ea' };
}

export function isBasicNeed(deal: any): boolean {
  const textToSearch = `${deal?.name || ''} ${deal?.category || ''} ${deal?.subcategory || ''} ${deal?.brand || ''}`.toLowerCase();
  
  const basicNeedKeywords = [
    'rice', 'flour', 'sugar', 'cooking oil', 'soybean oil', 'canola oil', 'vegetable oil',
    'dhal', 'split peas', 'toor dhal', 'moong dhal', 'lentils', 'beans',
    'salt', 'tea', 'mackerel', 'sardines', 'milk', 'butter', 'eggs', 'chicken',
    'gas', 'lpg', 'toilet paper', 'soap', 'sanitary pad', 'diaper', 'infant formula', 'lactogen', 's26'
  ];
  
  return basicNeedKeywords.some(kw => textToSearch.includes(kw));
}
