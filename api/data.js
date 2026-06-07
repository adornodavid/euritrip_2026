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
    // budget se ordena por sort_order ASC; expenses por expense_date DESC; demás por created_at DESC
    const ORDER = {
      budget: { col: 'sort_order', asc: true },
      expenses: { col: 'expense_date', asc: false }
    };
    for (const logical of TABLES) {
      let q = sb.from(tableName(logical)).select('*');
      if (logical === 'activities') {
        // Planner: por día, luego orden manual dentro del día, luego hora
        q = q.order('activity_date', { ascending: true, nullsFirst: false })
             .order('sort_order', { ascending: true, nullsFirst: false })
             .order('start_time', { ascending: true, nullsFirst: true });
      } else {
        const ord = ORDER[logical] || { col: 'created_at', asc: false };
        q = q.order(ord.col, { ascending: ord.asc, nullsFirst: false });
      }
      const { data: rows, error } = await q;
      if (error) throw new Error(`${logical}: ${error.message}`);
      data[logical] = rows || [];
    }
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('data.js error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
