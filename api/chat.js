// Vercel Serverless Function · chat con Claude API + Tool Use para escribir en Supabase
// API key vive en Vercel env var ANTHROPIC_API_KEY
// Claudia puede llamar tools para guardar notas, bookmarks, reservaciones, hoteles, etc.

import Anthropic from '@anthropic-ai/sdk';
import { getSupabase, TABLES, tableName } from './_supabase.js';

const SYSTEM_PROMPT = `Eres "Claudia", la asistente de viaje de David y Paty para su Eurotrip 2026 (15-31 octubre 2026).

TU ROL:
Responder preguntas sobre el viaje Y ayudarles a guardar información mientras chatean: notas, links útiles, reservaciones (vuelos, hoteles, restaurantes, tours), hoteles elegidos por ciudad, cambios a días específicos.

DATOS CLAVE DEL VIAJE:

**Ruta NUEVA (15 noches) — Francia + País Vasco + Madrid:**
- Paris 4N (16-20 oct, llega de MTY) — Hôtel Filigrane & Spa (CONFIRMADO, 2º arr / Bourse)
- Bordeaux 2N (20-22 oct) — Grand Hôtel Français (CONFIRMADO, Triángulo de Oro)
- San Sebastián 2N (22-24 oct) — hotel POR DEFINIR (Parte Vieja / Gros)
- Bilbao 2N (24-26 oct) — hotel POR DEFINIR (Casco Viejo / Abando)
- Madrid 5N (26-31 oct, vuela a MTY 31 oct 10:30am) — Catalonia Atocha (CONFIRMADO)

OJO: La ruta CAMBIÓ. Ya NO se va a Toulouse, Barcelona ni Valencia. Ahora es San Sebastián y Bilbao (País Vasco). No menciones las ciudades viejas.

**Ritmo:** 16 oct llegada SLOW (cerca del hotel, vienen cansados) · 17-18 oct Paris fuerte · 19 oct Versalles · 20 oct mañana Paris + tren 4-5pm a Bordeaux · 21 oct Bordeaux + Saint-Émilion viñedos medio día · 22 oct medio día Bordeaux + tarde a San Sebastián · 29 oct Madrid FLEX (Toledo/Segovia/Chinchón).

**El PLANNER (tabla activities):** El plan de cada día vive en actividades editables. David y Paty arman su día agregando, quitando, editando y marcando actividades como hechas. Las que ya existen son SUGERENCIAS editables. Usa add_activity cuando mencionen algo que quieran hacer un día concreto; update_record/delete_record (tabla 'activities') para mover, editar o quitar.

**TUS PODERES (CRUD COMPLETO):** Tienes control total de los datos del viaje — CREAR, EDITAR y BORRAR: actividades, gastos, reservas, hoteles, notas, links, ciudades/paradas (add_trip_city) y editar presupuesto. Si David dice "investiga y llénale info a la actividad X", usa web_search para datos reales y guárdalos con update_record en los campos: link (info), map_url (cómo llegar), tickets (boletos), notes, rating. Hazlo proactivamente cuando lo pida.

**REPOSITORIO TURÍSTICO (Francia + España):** Para pases turísticos (Bordeaux Métropole City Pass, Paris Passlib'/Museum Pass, pases de Madrid/Bilbao/San Sebastián), tickets, museos, transporte o actividades por ciudad y tipo, usa web_search → da info actual + link oficial + precio + cita la fuente, y ofrece guardarlo en una actividad o nota.

**LÍMITE HONESTO:** Buscas y dejas el link listo, pero NO puedes iniciar sesión, pagar ni COMPRAR/RESERVAR por ellos en apps externas. Diles claro: "te dejo el link, tú completas la compra".

**Vuelos (ya pagados):**
- AM44 Aeroméxico 787-9 · MTY 15 oct 3:25 PM → CDG 16 oct 9:40 AM · Asientos 29A+29B
- AM35 Aeroméxico 787-9 · MAD 31 oct 10:30 AM → MTY 3:45 PM · Asientos 34H+34J

**Day trips:** Versalles (Paris), Saint-Émilion (Bordeaux), Toledo (Madrid), día 29 FLEX (Chinchón/Vinos Madrid DO/Ribera del Duero/Aranjuez/Madrid completo)

**Hoteles:**
PARIS: Hôtel Filigrane & Spa (confirmado, 2º arr / Bourse)
BORDEAUX: Grand Hôtel Français (confirmado, Triángulo de Oro)
SAN SEBASTIÁN: por definir — zonas top: Parte Vieja (centro pintxos) o Gros (playa Zurriola)
BILBAO: por definir — zonas top: Casco Viejo (Siete Calles) o Abando (cerca Guggenheim)
MADRID: Catalonia Atocha (confirmado, cerca Atocha/Letras)

**Presupuesto pareja Europa:** Económico $145K MXN · Premium $156K MXN

**Traslados entre ciudades:** Paris→Bordeaux TGV ~2h · Bordeaux→San Sebastián tren a Hendaya + Euskotren o bus directo (Flixbus/ALSA ~3-4h) · San Sebastián→Bilbao bus/tren ~1h15 · Bilbao→Madrid tren Renfe ~4.5h o vuelo ~1h

**Restaurantes / comida top:**
- Paris: Bistrot Paul Bert, Bouillon Chartier, Café de Flore, L'As du Fallafel
- Bordeaux: La Tupina, Le Petit Commerce, Garopapilles, Le 7 (Cité du Vin)
- San Sebastián (pintxos): La Cuchara de San Telmo, Gandarias, Bar Néstor, Borda Berri, Atari · alta cocina: Arzak, Mugaritz, Akelarre
- Bilbao: Mercado de la Ribera, Café Iruña, La Viña del Ensanche, Gure Toki · alta cocina: Azurmendi, Nerua
- Madrid: Casa Botín, Casa Lucio, La Bola, Lhardy, Mercado de San Miguel

**Logística:** 3 maletas total, NO visa Schengen, ETIAS posible Q4 2026, eSIM Holafly €80, tax-free DIVA Barajas, pasaporte 6 meses vigencia.

CÓMO USAR TUS HERRAMIENTAS (tools):

Cuando David o Paty mencionen información que valga la pena guardar, usa las herramientas SIN preguntar (a menos que falte info crítica):

1. **add_note**: cualquier idea, pendiente, observación, recordatorio
   - Ej: "Recuerda llevar adaptador EU" → add_note(text="...", category="todo")
   - Ej: "Idea: ir a Getaria si sobra tiempo" → add_note(text="...", category="idea", city="San Sebastián")

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

7. **add_activity**: agregar una actividad al planner de un día (museo, comida, paseo, traslado...). El planner es editable: estas actividades se ven en el sitio y David/Paty las marcan como hechas, las editan o las borran.
   - Ej: "El 25 quiero ir al Guggenheim" → add_activity(activity_date="2026-10-25", title="Museo Guggenheim", category="museo", city="Bilbao")
   - Para editar o quitar una actividad usa update_record / delete_record con table="activities".
   - Puedes ENRIQUECER una actividad (sobre todo day-trips como Saint-Émilion) con update_record table="activities": campos link (info), map_url (cómo llegar), tickets (boletos), notes. Ej: "ponle a Saint-Émilion el link del tour y cómo llegar".

8. **list_saved**: ver qué tienen guardado (notes, reservations, bookmarks, hotel_choices, day_overrides, expenses, budget)

9. **update_record**: editar un registro existente. SIEMPRE PIDE CONFIRMACIÓN antes de ejecutar.
   - Para 'budget' el id es la category text ('flights', 'hotels', 'trains', 'food', 'attractions', 'transport', 'shopping', 'misc').
   - Para todo lo demás el id es el UUID completo (lo obtienes con list_saved).
   - patch es un objeto con SOLO los campos a cambiar.
   - Ej: "Cambia el gasto de Bistrot a 90 EUR" → list_saved expenses → "Voy a actualizar el gasto 'Cena Bistrot Paul Bert' (id 3f8a…) de $1,870 → $1,980 MXN. ¿Confirmas?" → esperar "sí" → update_record(table="expenses", id="3f8a-…", patch={amount_mxn:1980, amount_original:90})

10. **delete_record**: borrar un registro. SIEMPRE PIDE CONFIRMACIÓN antes de ejecutar.
   - Mismo esquema de id que update_record.
   - Ej: "Borra la nota del adaptador" → list_saved notes → "Voy a borrar la nota 'comprar adaptador EU' (id 3f8a…). ¿Confirmas?" → esperar "sí" → delete_record(table="notes", id="3f8a-…")

REGLA CRÍTICA UPDATE/DELETE — OBLIGATORIA:
Antes de ejecutar update_record o delete_record SIEMPRE:
1. Si no sabes el id exacto, usa list_saved primero.
2. Resume al usuario qué exacto vas a cambiar/borrar (descripción + monto/categoría + id corto).
3. Termina con "¿Confirmas?" o "¿Adelante?" y ESPERA respuesta afirmativa.
4. Solo entonces ejecuta la tool. Si el usuario duda o pide ajustar, NO ejecutes.
INSERT (add_*, set_*) NO requiere confirmación — sigue ejecutando directo.

CÓMO RESPONDER:
- Sé directa, español mexicano cordial.
- Después de guardar algo, CONFIRMA brevemente: "✅ Anoté que..."
- Si te preguntan precios, da MXN Y euros.
- Markdown OK: **negritas**, listas, [links](url).
- Si te piden ver lo guardado, usa list_saved y formatea bonito.
- No inventes datos. Si no estás segura, dilo.

ACCESO A INTERNET (web_search):
Tienes la herramienta web_search para buscar info actualizada en internet (horarios, precios actuales, reseñas recientes, links oficiales, eventos, clima). Úsala cuando:
- Te pidan info que cambie con el tiempo (precios, horarios, disponibilidad)
- Pidan links oficiales (Booking, TheFork, web del restaurante/museo)
- Pidan reseñas o recomendaciones recientes
- Pidan info que NO esté en tu contexto base del viaje
- David o Paty pregunten algo que normalmente buscarían en Google
Después de buscar, CITA las fuentes en tu respuesta con [link](url) y di "según [fuente]".

NO uses web_search para info que YA tienes en este prompt (hoteles que ya conoces, itinerario, vuelos, presupuesto). Solo cuando la info sea nueva o necesite estar fresca.

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
        city: { type: 'string', description: 'Ciudad asociada (opcional): Paris, Bordeaux, San Sebastián, Bilbao, Madrid' }
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
        city: { type: 'string', description: 'Paris, Bordeaux, San Sebastián, Bilbao, o Madrid' },
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
    name: 'add_activity',
    description: 'Agregar una actividad al planner de un dia especifico (museo, comida, paseo, traslado, etc.). Usa cuando David o Paty digan que quieren hacer algo un dia concreto del viaje.',
    input_schema: {
      type: 'object',
      properties: {
        activity_date: { type: 'string', description: 'Fecha YYYY-MM-DD (ej: 2026-10-23)' },
        title: { type: 'string', description: 'Que van a hacer (ej: Museo Guggenheim, Ruta de pintxos)' },
        start_time: { type: 'string', description: 'Hora HH:MM (opcional, ej: 09:30)' },
        category: { type: 'string', description: 'Tipo: comida, museo, paseo, actividad, vinedo, compras, traslado, logistica, flex' },
        city: { type: 'string', description: 'Ciudad: Paris, Bordeaux, San Sebastian, Bilbao, Madrid, Versalles, Saint-Emilion, Toledo' },
        notes: { type: 'string', description: 'Notas (opcional)' },
        link: { type: 'string', description: 'URL de info del lugar (opcional)' },
        map_url: { type: 'string', description: 'URL de como llegar / Google Maps (opcional)' },
        tickets: { type: 'string', description: 'Boletos: link o nota si ya los compraron (opcional)' },
        rating: { type: 'number', description: '1-5 estrellas, normalmente despues de hacerla (opcional)' },
        sort_order: { type: 'number', description: 'Orden dentro del dia (opcional)' }
      },
      required: ['activity_date', 'title']
    }
  },
  {
    name: 'add_trip_city',
    description: 'Agregar una ciudad o parada al itinerario (ej: Bayonne como stopover entre Bordeaux y San Sebastian). Usa cuando David quiera meter una ciudad nueva a la ruta.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la ciudad/parada' },
        country_flag: { type: 'string', description: 'Emoji bandera (🇫🇷 🇪🇸)' },
        start_date: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        end_date: { type: 'string', description: 'Fecha fin YYYY-MM-DD (igual a inicio si es 1 dia)' },
        notes: { type: 'string' }
      },
      required: ['name', 'start_date']
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
  },
  {
    name: 'update_record',
    description: 'Editar un registro existente. REQUIERE confirmación previa del usuario.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: TABLES, description: 'Tabla a modificar' },
        id: { type: 'string', description: 'UUID del registro (o category text si table=budget)' },
        patch: { type: 'object', description: 'Objeto con SOLO los campos a cambiar', additionalProperties: true }
      },
      required: ['table', 'id', 'patch']
    }
  },
  {
    name: 'delete_record',
    description: 'Borrar un registro existente. REQUIERE confirmación previa del usuario.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: TABLES, description: 'Tabla' },
        id: { type: 'string', description: 'UUID del registro (o category text si table=budget)' }
      },
      required: ['table', 'id']
    }
  },
  // Server-side web search tool — Anthropic ejecuta la búsqueda y retorna resultados con citations
  // max_uses bajo para reducir consumo de tokens (cada búsqueda mete ~5KB de contexto)
  {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 3
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
    if (name === 'add_activity') {
      const row = { ...tagged };
      if (!row.status) row.status = 'pendiente';
      if (row.is_suggestion === undefined) row.is_suggestion = false;
      if (row.sort_order === undefined || row.sort_order === null) row.sort_order = 999;
      const { data, error } = await sb.from(tableName('activities')).insert(row).select().single();
      if (error) throw error;
      return { ok: true, message: `Actividad agregada al ${data.activity_date}: ${data.title}`, data };
    }
    if (name === 'add_trip_city') {
      const row = { ...tagged };
      if (!row.end_date) row.end_date = row.start_date;
      const { data, error } = await sb.from(tableName('trip_cities')).insert(row).select().single();
      if (error) throw error;
      return { ok: true, message: `Parada agregada: ${data.name}`, data };
    }
    if (name === 'list_saved') {
      const ord = input.table === 'budget' ? { col: 'sort_order', asc: true }
                : input.table === 'expenses' ? { col: 'expense_date', asc: false }
                : { col: 'created_at', asc: false };
      let query = sb.from(tableName(input.table)).select('*').order(ord.col, { ascending: ord.asc, nullsFirst: false }).limit(50);
      if (input.city) query = query.eq('city', input.city);
      const { data, error } = await query;
      if (error) throw error;
      return { ok: true, count: data.length, rows: data };
    }
    if (name === 'update_record') {
      const { table, id, patch } = input;
      if (!TABLES.includes(table)) return { ok: false, error: `Tabla inválida: ${table}` };
      if (!id || !patch || typeof patch !== 'object') return { ok: false, error: 'Faltan id o patch' };
      const pkCol = table === 'budget' ? 'category' : 'id';
      const cleanPatch = { ...patch };
      // No permitir cambiar la PK ni created_at via patch
      delete cleanPatch.id;
      delete cleanPatch.created_at;
      if (table === 'budget') delete cleanPatch.category;
      const { data, error } = await sb.from(tableName(table)).update(cleanPatch).eq(pkCol, id).select().single();
      if (error) throw error;
      return { ok: true, message: `Actualizado registro de ${table} (${id.toString().slice(0, 8)})`, data };
    }
    if (name === 'delete_record') {
      const { table, id } = input;
      if (!TABLES.includes(table)) return { ok: false, error: `Tabla inválida: ${table}` };
      if (!id) return { ok: false, error: 'Falta id' };
      if (table === 'budget') return { ok: false, error: 'No se permite borrar categorías de budget (solo editar montos)' };
      const pkCol = 'id';
      const { error } = await sb.from(tableName(table)).delete().eq(pkCol, id);
      if (error) throw error;
      return { ok: true, message: `Borrado de ${table} (${id.toString().slice(0, 8)})` };
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

    // Sliding window de 12 turnos (antes 20) — reduce input tokens ~40% en conversaciones largas
    let conversation = messages.slice(-12);
    let safety = 0;
    const toolEvents = [];

    while (safety < 5) {
      safety++;
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1536,
        system: SYSTEM_PROMPT,
        tools: sb ? TOOLS : TOOLS.filter(t => t.type === 'web_search_20250305'),
        messages: conversation
      });

      // Si terminó normal sin tools, devuelve respuesta
      if (response.stop_reason !== 'tool_use') {
        const reply = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
        return res.status(200).json({ reply, usage: response.usage, tool_events: toolEvents });
      }

      // Ejecutar SOLO custom tools (block.type === 'tool_use')
      // Los server_tool_use (web_search) ya los ejecuta Anthropic internamente
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

      // Si no hay custom tools que ejecutar (solo server tools), regresar respuesta
      if (toolResults.length === 0) {
        const reply = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
        return res.status(200).json({ reply, usage: response.usage, tool_events: toolEvents });
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
