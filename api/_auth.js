// Fase 0 · Auth middleware para las serverless functions que quedan.
// El cliente manda Authorization: Bearer <jwt de supabase-js>; aquí se resuelve
// el usuario y se verifica membresía del viaje EN SERVIDOR (nunca confiar en el body).
import { getSupabase } from './_supabase.js';

// CORS restringido: prod + previews del proyecto + Capacitor (Fase 2)
const ORIGIN_RE = /^https:\/\/euritrip-2026[a-z0-9-]*\.vercel\.app$|^capacitor:\/\/localhost$|^http:\/\/localhost(:\d+)?$/;
export function setCors(req, res, methods) {
  const origin = req.headers.origin || '';
  if (ORIGIN_RE.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods || 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export async function requireUser(req) {
  const jwt = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!jwt) return { error: 'No autenticado', status: 401 };
  const { data, error } = await getSupabase().auth.getUser(jwt);
  if (error || !data?.user) return { error: 'Sesión inválida', status: 401 };
  return { user: data.user };
}

export async function requireTripMember(userId, tripId, minRole = 'editor') {
  if (!tripId) return { error: 'trip_id requerido', status: 400 };
  const sb = getSupabase();
  const rank = { viewer: 0, editor: 1, owner: 2 };
  const [{ data: m }, { data: t }] = await Promise.all([
    sb.from('bayu_trip_members').select('role').eq('trip_id', tripId).eq('user_id', userId).maybeSingle(),
    sb.from('bayu_trips').select('owner_id').eq('id', tripId).maybeSingle()
  ]);
  const role = t?.owner_id === userId ? 'owner' : m?.role;
  if (!role || rank[role] < rank[minRole]) return { error: 'Sin acceso a este viaje', status: 403 };
  return { role };
}

// Quota de mensajes IA por usuario/mes (plan free). Devuelve error si se agotó.
export async function checkAndCountAi(userId, limit = 400) {
  const sb = getSupabase();
  const month = new Date().toISOString().slice(0, 7);
  const { data } = await sb.from('bayu_ai_usage').select('msgs').eq('user_id', userId).eq('month', month).maybeSingle();
  const used = data?.msgs || 0;
  if (used >= limit) return { error: `Límite mensual de mensajes IA alcanzado (${limit})`, status: 429 };
  await sb.from('bayu_ai_usage').upsert({ user_id: userId, month, msgs: used + 1 }, { onConflict: 'user_id,month' });
  return { used: used + 1 };
}
