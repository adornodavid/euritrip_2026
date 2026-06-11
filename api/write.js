// POST /api/write → escribir en cualquier tabla del viaje activo
// Requiere header X-Write-Key con la clave EUROTRIP_WRITE_KEY (compartida del viaje — muere con auth en Fase 0)
// Multi-viaje: las tablas de datos se escopan por trip_id (del body); la tabla 'trips' es global.
import { getSupabase, WRITE_TABLES, tableName, checkWriteKey } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Write-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  const auth = checkWriteKey(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error });

  const { action, table, row, id, patch } = req.body || {};
  if (!table || !WRITE_TABLES.includes(table)) {
    return res.status(400).json({ error: `Tabla inválida. Usa: ${WRITE_TABLES.join(', ')}` });
  }

  const isTrips = table === 'trips';
  // trip activo: SIEMPRE explícito del body — sin viaje activo no hay escritura
  const tripId = isTrips ? null : req.body?.trip_id;
  if (!isTrips && !tripId) {
    return res.status(400).json({ error: 'trip_id requerido — selecciona un viaje activo' });
  }

  try {
    const sb = getSupabase();
    const real = tableName(table);
    // PK lógica por tabla: budget usa 'category' (parte de PK compuesta con trip_id), el resto 'id'
    const pkCol = table === 'budget' ? 'category' : 'id';
    // columna(s) de conflicto para upsert
    const conflictCol = table === 'hotel_choices' ? 'trip_id,city'
                      : table === 'day_overrides' ? 'trip_id,date'
                      : table === 'budget' ? 'trip_id,category'
                      : 'id';
    let result;

    if (action === 'insert') {
      if (!row) return res.status(400).json({ error: 'row requerido' });
      const payload = isTrips ? row : { ...row, trip_id: row.trip_id || tripId };
      const { data, error } = await sb.from(real).insert(payload).select().single();
      if (error) throw error;
      result = { inserted: data };

    } else if (action === 'update') {
      if (!id || !patch) return res.status(400).json({ error: 'id + patch requeridos' });
      let q = sb.from(real).update(patch).eq(pkCol, id);
      if (!isTrips) q = q.eq('trip_id', tripId); // escopa al viaje activo (clave para budget compuesto)
      const { data, error } = await q.select().single();
      if (error) throw error;
      result = { updated: data };

    } else if (action === 'upsert') {
      if (!row) return res.status(400).json({ error: 'row requerido' });
      const payload = isTrips ? row : { ...row, trip_id: row.trip_id || tripId };
      const { data, error } = await sb.from(real).upsert(payload, { onConflict: conflictCol }).select().single();
      if (error) throw error;
      result = { upserted: data };

    } else if (action === 'delete') {
      if (!id) return res.status(400).json({ error: 'id requerido' });
      let q = sb.from(real).delete().eq(pkCol, id);
      if (!isTrips) q = q.eq('trip_id', tripId);
      const { error } = await q;
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
