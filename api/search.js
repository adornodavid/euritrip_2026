// Vercel Serverless Function · búsqueda real de vuelos/hoteles/aeropuertos (Skyscanner via RapidAPI)
// GET /api/search?type=airports&q=bilbao
// GET /api/search?type=flights&origin=MTY&destination=CDG&date=YYYY-MM-DD[&returnDate=YYYY-MM-DD]&adults=2
// GET /api/search?type=hotels&city=<ciudad>&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&adults=2
// origin/destination/city aceptan texto libre (se resuelven con autocomplete) o código IATA.
import { hasKey, searchAirports, searchFlights, searchHotels } from './_skyscanner.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!hasKey()) return res.status(500).json({ error: 'RAPIDAPI_KEY no configurada en Vercel' });

  const q = req.query || {};
  const type = q.type;

  try {
    if (type === 'airports') {
      if (!q.q || q.q.length < 2) return res.status(200).json({ data: [] });
      return res.status(200).json({ data: await searchAirports(q.q) });
    }

    if (type === 'flights') {
      if (!q.origin || !q.destination || !q.date) {
        return res.status(400).json({ error: 'origin, destination y date son requeridos' });
      }
      const data = await searchFlights({
        origin: q.origin,
        destination: q.destination,
        date: q.date,
        returnDate: q.returnDate || undefined,
        cabinClass: q.cabinClass || undefined,
        adults: q.adults ? parseInt(q.adults) : 1,
        currency: q.currency || 'MXN'
      });
      return res.status(200).json({ data });
    }

    if (type === 'hotels') {
      if (!q.city || !q.checkin || !q.checkout) {
        return res.status(400).json({ error: 'city, checkin y checkout son requeridos' });
      }
      const data = await searchHotels({
        city: q.city,
        checkin: q.checkin,
        checkout: q.checkout,
        adults: q.adults ? parseInt(q.adults) : 2,
        currency: q.currency || 'MXN'
      });
      return res.status(200).json({ data });
    }

    return res.status(400).json({ error: 'type debe ser airports, flights u hotels' });
  } catch (error) {
    console.error('search.js error:', error);
    return res.status(500).json({ data: [], error: error?.message || 'Error interno' });
  }
}
