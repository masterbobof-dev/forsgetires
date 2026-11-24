// Visitor's country / city for the shop statistics, taken from Vercel's own
// geolocation headers (no third-party service, nothing is stored here).
const COUNTRIES = { UA: 'Україна', PL: 'Польща', DE: 'Німеччина', MD: 'Молдова', RO: 'Румунія', CZ: 'Чехія', SK: 'Словаччина', US: 'США', GB: 'Велика Британія' };

export default function handler(req, res) {
  const code = String(req.headers['x-vercel-ip-country'] || '');
  let city = String(req.headers['x-vercel-ip-city'] || '');
  try { city = decodeURIComponent(city); } catch { /* keep raw */ }
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({ country: COUNTRIES[code] || code || 'Unknown', city: city || 'Unknown' });
}
