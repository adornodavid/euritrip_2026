// POST /api/upload → sube una imagen (base64) a Supabase Storage bucket 'eurotrip', devuelve URL pública
// Fase 0: requiere sesión + ser editor del viaje (trip_id en body)
import { getSupabase } from './_supabase.js';
import { setCors, requireUser, requireTripMember } from './_auth.js';
export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  const auth = await requireUser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  try {
    const { content_b64, contentType, ext, trip_id } = req.body || {};
    if (!content_b64) return res.status(400).json({ error: 'content_b64 requerido' });
    const mem = await requireTripMember(auth.user.id, trip_id, 'editor');
    if (mem.error) return res.status(mem.status).json({ error: mem.error });
    const sb = getSupabase();
    const buf = Buffer.from(content_b64, 'base64');
    const name = auth.user.id + '/' + trip_id + '/' + Date.now() + '-' + Math.round(Math.random()*1e6) + '.' + (ext || 'jpg');
    const { error } = await sb.storage.from('eurotrip').upload(name, buf, { contentType: contentType || 'image/jpeg', upsert: false });
    if (error) throw error;
    const { data } = sb.storage.from('eurotrip').getPublicUrl(name);
    return res.status(200).json({ ok: true, url: data.publicUrl });
  } catch (e) {
    console.error('upload.js error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
