// POST /api/write → escribir en cualquier tabla del eurotrip
// Requiere header X-Write-Key con la clave EUROTRIP_WRITE_KEY (David + Paty la conocen)
import { getSupabase, TABLES, tableName, checkWriteKey } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Write-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  const auth = checkWriteKey(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error });

  const { action, table, row, id, patch } = req.body || {};
  if (!table || !TABLES.includes(table)) {
    return res.status(400).json({ error: `Tabla inválida. Usa: ${TABLES.join(', ')}` });
  }

  try {
    const sb = getSupabase();
    const real = tableName(table);
    // PK por tabla: la mayoria es id uuid; budget usa category (text PK)
    const pkCol = table === 'budget' ? 'category' : 'id';
    // Para upsert, columna de conflicto especial por tabla
    const conflictCol = table === 'hotel_choices' ? 'city'
                      : table === 'day_overrides' ? 'date'
                      : table === 'budget' ? 'category'
                      : 'id';
    let result;

    if (action === 'insert') {
      if (!row) return res.status(400).json({ error: 'row requerido' });
      const { data, error } = await sb.from(real).insert(row).select().single();
      if (error) throw error;
      result = { inserted: data };
    } else if (action === 'update') {
      if (!id || !patch) return res.status(400).json({ error: 'id + patch requeridos' });
      const { data, error } = await sb.from(real).update(patch).eq(pkCol, id).select().single();
      if (error) throw error;
      result = { updated: data };
    } else if (action === 'upsert') {
      if (!row) return res.status(400).json({ error: 'row requerido' });
      const { data, error } = await sb.from(real).upsert(row, { onConflict: conflictCol }).select().single();
      if (error) throw error;
      result = { upserted: data };
    } else if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'id requerido' });
      const { error } = await sb.from(real).delete().eq(pkCol, id);
      if (error) throw error;
      result = { deleted: id };
    } else {
      return res.status(400).json({ error: 'action debe ser: insert | update | upsert | delete' });
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('write.js error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
