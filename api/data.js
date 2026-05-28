// GET /api/data → devuelve todo el estado del viaje (notas, bookmarks, reservations, hoteles, day overrides)
// Lectura pública (cualquier visitante del sitio puede ver)
import { getSupabase, TABLES, tableName } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Solo GET permitido' });
  }

  try {
    const sb = getSupabase();
    const data = {};
    for (const logical of TABLES) {
      const { data: rows, error } = await sb.from(tableName(logical)).select('*').order('created_at', { ascending: false });
      if (error) throw new Error(`${logical}: ${error.message}`);
      data[logical] = rows || [];
    }
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('data.js error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
