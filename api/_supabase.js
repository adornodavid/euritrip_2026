// Cliente Supabase compartido para todos los endpoints
// Usa SERVICE_ROLE key (server-only, bypass RLS)
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabase() {
  if (!url || !serviceKey) {
    throw new Error('Faltan env vars SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

// Tablas de datos por-viaje (todas tienen trip_id). data.js itera sobre estas.
export const TABLES = ['notes', 'bookmarks', 'reservations', 'hotel_choices', 'day_overrides', 'expenses', 'budget', 'activities', 'trip_cities', 'media', 'trip_travelers', 'packing_items'];
// Tablas escribibles = las de datos + la tabla de viajes (sin trip_id propio)
export const WRITE_TABLES = [...TABLES, 'trips'];
export const tableName = (logical) => `eurotrip_${logical}`;

// Verifica write key (clave compartida del viaje — muere con auth real en Fase 0)
export function checkWriteKey(req) {
  const writeKey = process.env.EUROTRIP_WRITE_KEY;
  if (!writeKey) return { ok: false, error: 'EUROTRIP_WRITE_KEY no configurada en Vercel' };
  const provided = req.headers['x-write-key'] || req.body?.write_key;
  if (provided !== writeKey) return { ok: false, error: 'Clave de escritura incorrecta' };
  return { ok: true };
}
