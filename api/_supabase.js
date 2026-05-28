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

// Tablas válidas (logical name → real table name en public)
export const TABLES = ['notes', 'bookmarks', 'reservations', 'hotel_choices', 'day_overrides', 'expenses', 'budget'];
export const tableName = (logical) => `eurotrip_${logical}`;

// Verifica write key (clave compartida David/Paty)
export function checkWriteKey(req) {
  const writeKey = process.env.EUROTRIP_WRITE_KEY;
  if (!writeKey) return { ok: false, error: 'EUROTRIP_WRITE_KEY no configurada en Vercel' };
  const provided = req.headers['x-write-key'] || req.body?.write_key;
  if (provided !== writeKey) return { ok: false, error: 'Clave de escritura incorrecta' };
  return { ok: true };
}
