// Vercel Serverless Function · chat con Claude API + Tool Use para escribir en Supabase
// API key vive en Vercel env var ANTHROPIC_API_KEY
// Claudia puede llamar tools para guardar notas, bookmarks, reservaciones, hoteles, etc.

import Anthropic from '@anthropic-ai/sdk';
import { getSupabase, TABLES, tableName } from './_supabase.js';

const SYSTEM_PROMPT = `Eres "Claudia", la asistente de viaje de David y Paty para su Eurotrip 2026 (15-31 octubre 2026).

TU ROL:
Responder preguntas sobre el viaje Y ayudarles a guardar información mientras chatean: notas, links útiles, reservaciones (vuelos, hoteles, restaurantes, tours), hoteles elegidos por ciudad, cambios a días específicos.

DATOS CLAVE DEL VIAJE:

**Ruta (15 noches, todo en tren):**
- Paris 4N (16-20 oct, llega de MTY)
- Bordeaux 2N (20-22 oct)
- Toulouse 1N (22-23 oct, cassoulet de cena)
- Barcelona 3N (23-26 oct)
- Valencia 1N (26-27 oct, paella auténtica)
- Madrid 4N (27-31 oct, vuela a MTY 31 oct 10:30am)

**Vuelos (ya pagados):**
- AM44 Aeroméxico 787-9 · MTY 15 oct 3:25 PM → CDG 16 oct 9:40 AM · Asientos 29A+29B
- AM35 Aeroméxico 787-9 · MAD 31 oct 10:30 AM → MTY 3:45 PM · Asientos 34H+34J

**Day trips:** Versalles (Paris), Saint-Émilion (Bordeaux), Toledo (Madrid), día 29 FLEX (Chinchón/Vinos Madrid DO/Ribera del Duero/Aranjuez/Madrid completo)

**Hoteles recomendados:**
PARIS: Marais (Hôtel Emile €210, Jeanne d'Arc €180, La Chambre €220) · Saint-Germain (St Paul Rive Gauche €195, Villa Madame €215, Villa Saint-Germain €230)
BORDEAUX: Chartrons (Hotel Indigo €175, Villas Foch €200, Une Chambre Chez Dupont €165) · Triangle d'Or (Hôtel de Sèze €210, Grand Hôtel Français €155, La Maison du Lierre €145)
TOULOUSE: Mama Shelter €125, Le Grand Balcon €160, Cour des Consuls €220, Albert 1er €115
BARCELONA: Eixample (Ohla €195, Alma €220, Room Mate Anna €175) · Born (Yurbban €185, H10 Madison €160, Wittmore €215)
VALENCIA: Caro €180, Sorolla Centro €140, Vincci Lys €130
MADRID: Letras/Sol (Catalonia €180, NH Tepa €210, Room Mate Alba €155) · Salamanca/Chamberí (Orfila €220, Único €215, Tótem €185)

**Presupuesto pareja Europa:** Económico $145K MXN · Premium $156K MXN

**Trenes anticipados pareja:** Paris-Bordeaux €140-180 · Bordeaux-Toulouse €100-140 · Toulouse-BCN €90-130 · BCN-Valencia €80-120 · Valencia-Madrid €60-90

**Restaurantes top:**
- Paris: Bistrot Paul Bert, Bouillon Chartier, Café de Flore, L'As du Fallafel
- Bordeaux: La Tupina, Le Petit Commerce, Garopapilles, Le 7 (Cité du Vin)
- Toulouse: Le Colombier (cassoulet), Émile
- Barcelona: Cal Pep, Cervecería Catalana, Quimet & Quimet, 7 Portes
- Valencia: Casa Carmela, La Pepica, Horchatería Santa Catalina
- Madrid: Casa Botín, Casa Lucio, La Bola, Lhardy

**Logística:** 3 maletas total, NO visa Schengen, ETIAS posible Q4 2026, eSIM Holafly €80, tax-free DIVA Barajas, pasaporte 6 meses vigencia.

CÓMO USAR TUS HERRAMIENTAS (tools):

Cuando David o Paty mencionen información que valga la pena guardar, usa las herramientas SIN preguntar (a menos que falte info crítica):

1. **add_note**: cualquier idea, pendiente, observación, recordatorio
   - Ej: "Recuerda llevar adaptador EU" → add_note(text="...", category="todo")
   - Ej: "Idea: ir a Sitges si sobra tiempo" → add_note(text="...", category="idea", city="Barcelona")

2. **add_bookmark**: cualquier link/URL útil
   - Ej: "Mira este restaurante https://x.com/..." → add_bookmark(title, url, city)

3. **add_reservation**: vuelos, hoteles, restaurantes, tours YA CONFIRMADOS con código/link
   - Ej: "Reservé Bistrot Paul Bert para el 17 oct 8pm via TheFork" → add_reservation(type="restaurant", title, date, time, link, city)

4. **set_hotel_choice**: cuando deciden EL hotel por ciudad
   - Ej: "Nos quedamos con Hotel Emile para Paris" → set_hotel_choice(city="Paris", hotel_name="...", confirmed=true)

5. **set_day_plan**: cambios a un día específico
   - Ej: "El día 19 mejor cancelamos Versalles y vamos a Montmartre" → set_day_plan(date="2026-10-19", new_plan="...")

6. **add_expense**: registrar un gasto REAL del viaje (ya pagado/gastado)
   - Categorías: flights, hotels, trains, food, attractions, transport, shopping, misc
   - Si dan monto en EUR, conviértelo a MXN con tasa ~22 MXN/EUR (a menos que digan otra)
   - Ej: "Gasté €85 en cena en Bistrot Paul Bert" → add_expense(category="food", description="Cena Bistrot Paul Bert", amount_mxn=1870, amount_original=85, currency="EUR", fx_rate=22, city="Paris", payer="Joint")
   - Ej: "Pagué $9,500 MXN del hotel de Paris" → add_expense(category="hotels", description="Hotel Emile Paris", amount_mxn=9500, currency="MXN", city="Paris")
   - Defaults: payer="Joint" si no especifican quién, expense_date=hoy si no dan fecha

7. **list_saved**: ver qué tienen guardado (notes, reservations, bookmarks, hotel_choices, day_overrides, expenses, budget)

CÓMO RESPONDER:
- Sé directa, español mexicano cordial.
- Después de guardar algo, CONFIRMA brevemente: "✅ Anoté que..."
- Si te preguntan precios, da MXN Y euros.
- Markdown OK: **negritas**, listas, [links](url).
- Si te piden ver lo guardado, usa list_saved y formatea bonito.
- No inventes datos. Si no estás segura, dilo.

NO uses tool calls para preguntas simples informacionales. SOLO úsalas cuando el usuario mencione algo concreto que valga la pena persistir.`;

// Tool definitions para Claudia
const TOOLS = [
  {
    name: 'add_note',
    description: 'Guardar una nota, idea, pendiente, recordatorio o advertencia',
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto de la nota' },
        category: { type: 'string', enum: ['general', 'todo', 'idea', 'reminder', 'warning'], description: 'Categoría' },
        city: { type: 'string', description: 'Ciudad asociada (opcional): Paris, Bordeaux, Toulouse, Barcelona, Valencia, Madrid' }
      },
      required: ['text']
    }
  },
  {
    name: 'add_bookmark',
    description: 'Guardar un link/URL útil para revisar después',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título descriptivo del link' },
        url: { type: 'string', description: 'URL completa' },
        city: { type: 'string', description: 'Ciudad asociada (opcional)' },
        category: { type: 'string', description: 'Categoría: restaurant, hotel, tour, museum, transport, info, etc.' },
        notes: { type: 'string', description: 'Notas adicionales' }
      },
      required: ['title', 'url']
    }
  },
  {
    name: 'add_reservation',
    description: 'Guardar una reservación CONFIRMADA: vuelo, hotel, restaurante, tour, tren, etc.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['flight', 'hotel', 'restaurant', 'tour', 'train', 'transfer', 'activity', 'other'] },
        title: { type: 'string', description: 'Ej: "Hotel Emile · check-in 16 oct"' },
        date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
        time: { type: 'string', description: 'Hora (ej: 20:00, 8 PM, etc.)' },
        confirmation_code: { type: 'string' },
        link: { type: 'string', description: 'Link al booking/voucher' },
        city: { type: 'string' },
        cost: { type: 'string', description: 'Costo total (ej: "€340 pareja", "$1,200 MXN")' },
        notes: { type: 'string' }
      },
      required: ['type', 'title']
    }
  },
  {
    name: 'set_hotel_choice',
    description: 'Marcar EL hotel elegido para una ciudad (upsert por ciudad)',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Paris, Bordeaux, Toulouse, Barcelona, Valencia, o Madrid' },
        hotel_name: { type: 'string' },
        zone: { type: 'string', description: 'Zona/barrio del hotel' },
        price_per_night: { type: 'string', description: 'Ej: "€180"' },
        confirmed: { type: 'boolean', description: 'true si ya está reservado' },
        booking_url: { type: 'string' },
        notes: { type: 'string' }
      },
      required: ['city', 'hotel_name']
    }
  },
  {
    name: 'set_day_plan',
    description: 'Cambiar el plan de un día específico (upsert por fecha)',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD (ej: 2026-10-19)' },
        new_plan: { type: 'string', description: 'Nuevo plan del día' },
        notes: { type: 'string' }
      },
      required: ['date', 'new_plan']
    }
  },
  {
    name: 'add_expense',
    description: 'Registrar un gasto REAL del viaje. Usa cuando David o Paty mencionen que YA gastaron, pagaron o compraron algo.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['flights', 'hotels', 'trains', 'food', 'attractions', 'transport', 'shopping', 'misc'], description: 'Categoría del gasto' },
        description: { type: 'string', description: 'Qué fue el gasto (ej: "Cena Bistrot Paul Bert", "Hotel Emile Paris noche 1")' },
        amount_mxn: { type: 'number', description: 'Monto en MXN. Si el gasto fue en EUR, convertir a MXN con la tasa fx_rate' },
        amount_original: { type: 'number', description: 'Monto en moneda original (opcional, solo si fue en EUR/USD)' },
        currency: { type: 'string', enum: ['MXN', 'EUR', 'USD'], description: 'Moneda original (default MXN)' },
        fx_rate: { type: 'number', description: 'Tasa de cambio aplicada (ej: 22 si 1 EUR = 22 MXN)' },
        payer: { type: 'string', enum: ['David', 'Paty', 'Joint'], description: 'Quién pagó (default Joint)' },
        expense_date: { type: 'string', description: 'Fecha del gasto YYYY-MM-DD (opcional)' },
        city: { type: 'string', description: 'Ciudad asociada al gasto (opcional)' },
        notes: { type: 'string', description: 'Notas adicionales' }
      },
      required: ['category', 'description', 'amount_mxn']
    }
  },
  {
    name: 'list_saved',
    description: 'Listar lo que ya está guardado en la base de datos',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: TABLES, description: 'Qué tabla listar' },
        city: { type: 'string', description: 'Filtrar por ciudad (opcional)' }
      },
      required: ['table']
    }
  }
];

// Ejecutor de tools
async function executeTool(sb, name, input) {
  const tagged = { ...input, created_by: 'claudia' };
  try {
    if (name === 'add_note') {
      const { data, error } = await sb.from(tableName('notes')).insert(tagged).select().single();
      if (error) throw error;
      return { ok: true, message: `Nota guardada (id ${data.id.slice(0, 8)})`, data };
    }
    if (name === 'add_bookmark') {
      const { data, error } = await sb.from(tableName('bookmarks')).insert(tagged).select().single();
      if (error) throw error;
      return { ok: true, message: `Bookmark "${data.title}" guardado`, data };
    }
    if (name === 'add_reservation') {
      const { data, error } = await sb.from(tableName('reservations')).insert(tagged).select().single();
      if (error) throw error;
      return { ok: true, message: `Reservación "${data.title}" guardada`, data };
    }
    if (name === 'set_hotel_choice') {
      const { data, error } = await sb.from(tableName('hotel_choices')).upsert(tagged, { onConflict: 'city' }).select().single();
      if (error) throw error;
      return { ok: true, message: `Hotel para ${data.city}: ${data.hotel_name}`, data };
    }
    if (name === 'set_day_plan') {
      const { data, error } = await sb.from(tableName('day_overrides')).upsert(tagged, { onConflict: 'date' }).select().single();
      if (error) throw error;
      return { ok: true, message: `Plan del ${data.date} actualizado`, data };
    }
    if (name === 'add_expense') {
      const row = { ...tagged };
      if (!row.payer) row.payer = 'Joint';
      if (!row.currency) row.currency = 'MXN';
      const { data, error } = await sb.from(tableName('expenses')).insert(row).select().single();
      if (error) throw error;
      return { ok: true, message: `Gasto registrado: ${data.description} · $${Number(data.amount_mxn).toLocaleString('es-MX')} MXN`, data };
    }
    if (name === 'list_saved') {
      let query = sb.from(tableName(input.table)).select('*').order('created_at', { ascending: false }).limit(50);
      if (input.city) query = query.eq('city', input.city);
      const { data, error } = await query;
      if (error) throw error;
      return { ok: true, count: data.length, rows: data };
    }
    return { ok: false, error: `Tool desconocida: ${name}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' });

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages[] requerido' });
    }

    const client = new Anthropic({ apiKey });
    let sb = null;
    try { sb = getSupabase(); } catch (e) { /* Supabase opcional, sin él Claudia chatea pero no escribe */ }

    let conversation = messages.slice(-20);
    let safety = 0;
    const toolEvents = [];

    while (safety < 5) {
      safety++;
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: sb ? TOOLS : undefined,
        messages: conversation
      });

      // Si terminó normal sin tools, devuelve respuesta
      if (response.stop_reason !== 'tool_use') {
        const reply = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
        return res.status(200).json({ reply, usage: response.usage, tool_events: toolEvents });
      }

      // Ejecutar tools
      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const result = await executeTool(sb, block.name, block.input);
        toolEvents.push({ tool: block.name, input: block.input, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result)
        });
      }

      // Agregar response del asistente + tool results al historial y continuar
      conversation.push({ role: 'assistant', content: response.content });
      conversation.push({ role: 'user', content: toolResults });
    }

    return res.status(500).json({ error: 'Demasiados ciclos de tool use' });
  } catch (error) {
    console.error('chat.js error:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
}
