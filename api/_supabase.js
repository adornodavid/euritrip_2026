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

// Tablas de datos por-viaje (todas tienen trip_id).
export const TABLES = ['notes', 'bookmarks', 'reservations', 'hotel_choices', 'day_overrides', 'expenses', 'budget', 'activities', 'trip_cities', 'media', 'trip_travelers', 'packing_items'];
export const tableName = (logical) => `bayu_${logical}`;
