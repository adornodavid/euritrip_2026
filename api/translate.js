// POST /api/translate → traduce texto con Claude (sin tools, rápido)
import Anthropic from '@anthropic-ai/sdk';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });
  try {
    const { text, target } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text requerido' });
    const client = new Anthropic({ apiKey });
    const r = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `Eres un traductor de viaje. Traduce EXACTAMENTE lo que te den al idioma "${target || 'francés'}". Devuelve SOLO la traducción, sin comillas ni explicaciones. Si es una frase útil de viaje, puedes añadir entre paréntesis una guía fonética simple para un hispanohablante.`,
      messages: [{ role: 'user', content: String(text).slice(0, 1000) }]
    });
    const translation = r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return res.status(200).json({ ok: true, translation });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
