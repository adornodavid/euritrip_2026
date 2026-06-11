// Fase 0 · Cuenta del usuario: export de datos (GDPR) y borrado de cuenta (Apple lo exige)
// GET  /api/account?action=export  → JSON con todos los datos de los viajes que posee
// POST /api/account {action:'delete'} → borra viajes propios + perfil + usuario auth
import { getSupabase, TABLES, tableName } from './_supabase.js';
import { setCors, requireUser } from './_auth.js';

export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireUser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const uid = auth.user.id;
  const sb = getSupabase();

  try {
    if (req.method === 'GET' && req.query?.action === 'export') {
      const { data: owned } = await sb.from('bayu_trips').select('*').eq('owner_id', uid);
      const { data: memberships } = await sb.from('bayu_trip_members').select('trip_id,role').eq('user_id', uid);
      const tripIds = [...new Set([...(owned || []).map(t => t.id), ...(memberships || []).map(m => m.trip_id)])];
      const out = { exported_at: new Date().toISOString(), user: { id: uid, email: auth.user.email }, trips: owned || [], memberships: memberships || [], data: {} };
      for (const logical of TABLES) {
        const { data } = await sb.from(tableName(logical)).select('*').in('trip_id', tripIds.length ? tripIds : ['00000000-0000-0000-0000-000000000000']);
        out.data[logical] = data || [];
      }
      res.setHeader('Content-Disposition', 'attachment; filename="bayu-export.json"');
      return res.status(200).json(out);
    }

    if (req.method === 'POST' && req.body?.action === 'delete') {
      if (req.body?.confirm !== 'BORRAR') return res.status(400).json({ error: 'Falta confirmación' });
      // Viajes que posee → cascade borra todo su contenido
      await sb.from('bayu_trips').delete().eq('owner_id', uid);
      await sb.from('bayu_trip_members').delete().eq('user_id', uid);
      await sb.from('bayu_profiles').delete().eq('id', uid);
      await sb.from('bayu_ai_usage').delete().eq('user_id', uid);
      const { error } = await sb.auth.admin.deleteUser(uid);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'action inválida' });
  } catch (e) {
    console.error('account.js error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
