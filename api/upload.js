// POST /api/upload → sube una imagen (base64) a Supabase Storage bucket 'eurotrip', devuelve URL pública
import { getSupabase, checkWriteKey } from './_supabase.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Write-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  const auth = checkWriteKey(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error });
  try {
    const { content_b64, contentType, ext } = req.body || {};
    if (!content_b64) return res.status(400).json({ error: 'content_b64 requerido' });
    const sb = getSupabase();
    const buf = Buffer.from(content_b64, 'base64');
    const name = 'receipts/' + Date.now() + '-' + Math.round(Math.random()*1e6) + '.' + (ext || 'jpg');
    const { error } = await sb.storage.from('eurotrip').upload(name, buf, { contentType: contentType || 'image/jpeg', upsert: false });
    if (error) throw error;
    const { data } = sb.storage.from('eurotrip').getPublicUrl(name);
    return res.status(200).json({ ok: true, url: data.publicUrl });
  } catch (e) {
    console.error('upload.js error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
