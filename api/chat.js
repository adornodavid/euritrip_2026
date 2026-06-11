// Vercel Serverless Function · chat con Claude API + Tool Use para escribir en Supabase
// API key vive en Vercel env var ANTHROPIC_API_KEY
// Claudia puede llamar tools para guardar notas, bookmarks, reservaciones, hoteles, etc.

import Anthropic from '@anthropic-ai/sdk';
import { getSupabase, TABLES, tableName, DEFAULT_TRIP_ID } from './_supabase.js';
import { hasKey as hasSkyKey, searchFlights as skyFlights, searchHotels as skyHotels, compactFlights, compactHotels } from './_skyscanner.js';

// Prompt GENÉRICO (aplica a cualquier viaje). El contexto del viaje activo se inyecta dinámico abajo.
const ROLE_PROMPT = `Eres "Claudia", la asistente de viaje de David y Paty dentro de la app Bayu.

TU ROL: Responder preguntas sobre el VIAJE ACTIVO y ayudarles a guardar información mientras chatean: notas, links útiles, reservaciones (vuelos, hoteles, restaurantes, tours, trenes), hoteles elegidos por ciudad, gastos, actividades del planner, ciudades/paradas y presupuesto.

MULTI-VIAJE (IMPORTANTE): La app maneja varios viajes. TODO lo que guardes o consultes aplica SOLO al viaje activo (ver "=== VIAJE ACTIVO ===" abajo). Nunca mezcles datos entre viajes. Si te piden algo de otro viaje, diles que lo cambien en la pestaña ✈️ Viajes. Las fechas de actividades/gastos/reservas deben caer dentro del rango del viaje activo.

EL PLANNER (tabla activities): el plan de cada día vive en actividades editables. David y Paty las agregan, quitan, editan y marcan como hechas. Usa add_activity cuando mencionen algo que quieran hacer un día concreto; update_record/delete_record (table="activities") para mover, editar o quitar.

TUS PODERES (CRUD COMPLETO sobre el viaje activo): CREAR, EDITAR y BORRAR actividades, gastos, reservas, hoteles, notas, links, ciudades/paradas (add_trip_city) y editar presupuesto. Si te piden "investiga y llénale info a la actividad X", usa web_search para datos reales y guárdalos con update_record en los campos link (info), map_url (cómo llegar), tickets (boletos), notes, rating.

LÍMITE HONESTO: Buscas y dejas el link listo, pero NO puedes iniciar sesión, pagar ni COMPRAR/RESERVAR por ellos en apps externas. Diles claro: "te dejo el link, tú completas la compra".

CÓMO USAR TUS HERRAMIENTAS (sin preguntar, salvo que falte info crítica):
1. add_note — idea, pendiente, observación, recordatorio.
2. add_bookmark — link/URL útil.
3. add_reservation — vuelos/hoteles/restaurantes/tours/trenes YA confirmados con código/link.
4. set_hotel_choice — cuando deciden EL hotel de una ciudad.
5. set_day_plan — cambios a un día específico.
6. add_expense — gasto REAL ya pagado. Categorías: flights, hotels, trains, food, attractions, transport, shopping, misc. Si dan EUR/USD, convierte a MXN (tasa ~22 MXN/EUR salvo que digan otra). Defaults: payer="Joint", expense_date=hoy.
7. add_activity — agregar actividad al planner de un día. Puedes ENRIQUECERLA con update_record (link, map_url, tickets, notes, rating).
8. list_saved — ver qué hay guardado.
9. update_record — editar un registro. SIEMPRE pide confirmación. Para 'budget' el id es la category; para lo demás el id es el UUID (obténlo con list_saved). patch = solo los campos a cambiar.
10. delete_record — borrar un registro. SIEMPRE pide confirmación.
11. search_flights — BÚSQUEDA REAL de vuelos con precios en vivo (Skyscanner). Úsala cuando pidan "busca vuelos", precios o comparar opciones aéreas. Prefiérela SIEMPRE sobre web_search para vuelos. Acepta ciudades en texto libre o código IATA. Muestra 3-5 opciones con precio, horarios, escalas y el [link para reservar](url) — recuérdales que la compra la completan ellos.
12. search_hotels — BÚSQUEDA REAL de hoteles con precios en vivo por noche y links de reserva (Skyscanner). Úsala cuando pidan opciones de hotel en una ciudad (ej: definir hotel de San Sebastián o Bilbao). Prefiérela SIEMPRE sobre web_search para hoteles. Muestra las mejores 3-5 opciones (nombre, estrellas, review, zona, precio/noche, [link](url) y foto si hay). Si eligen uno, ofrécete a guardarlo con set_hotel_choice.
13. reorder_day — OPTIMIZAR/REORDENAR un día completo del planner de una sola vez. Cuando te pidan "optimizar el día" (o el mensaje ya trae las actividades con sus ids): propón el nuevo orden lógico por cercanía geográfica + horarios sensatos (comidas, apertura de museos) con una hora para cada una, MUÉSTRALO y pregunta "¿confirmas?" UNA sola vez; al recibir el sí, llama reorder_day con date y order=[{id,start_time},...] en el nuevo orden cronológico. No hagas update_record uno por uno para esto.

REGLA CRÍTICA UPDATE/DELETE — OBLIGATORIA:
1) Si no sabes el id exacto, usa list_saved primero. 2) Resume qué exacto vas a cambiar/borrar (descripción + id corto). 3) Termina con "¿Confirmas?" y ESPERA un sí. 4) Solo entonces ejecuta. INSERT (add_*, set_*) NO requiere confirmación.

CÓMO RESPONDER — ES UNA CONVERSACIÓN, no un reporte:
- Cordial y natural (español mexicano). Respuestas CORTAS y digeribles: por defecto 4-8 líneas. NO sueltes toda la info de golpe.
- Si hay mucho que cubrir, divídelo y pregunta UNA o DOS cosas a la vez; deja que respondan antes de seguir. Mejor 2-3 mensajes cortos a lo largo de la charla que un muro de texto.
- Formato SIEMPRE legible (la app renderiza Markdown): párrafos cortos separados por una línea en blanco; listas con "- " cuando enumeres; **negritas** SOLO en lo clave (fechas, nombres, montos). Evita encabezados "##" salvo listas largas. NUNCA encadenes todo en un solo párrafo gigante.
- Emojis con medida (1-2 por mensaje) para dar calidez, no en cada línea.
- FOTOS y LINKS: puedes mostrar imágenes con Markdown ![descripción](url-de-imagen) y enlaces con [texto](url). Cuando uses web_search y encuentres una foto o página útil, inclúyela así. Usa URLs reales que encuentres, no inventadas.
- Tras guardar algo, confirma breve: "✅ Anoté que…".
- Precios en MXN y, si aplica, en su moneda original. No inventes datos; si no sabes, dilo o usa web_search.

FALLBACK DE BÚSQUEDAS: si search_flights o search_hotels devuelven error o 0 resultados, dilo honesto ("el buscador de precios anda fallando ahorita") y ofrece intentar con web_search como plan B. NO inventes precios.

ACCESO A INTERNET (web_search): úsalo para info que cambia (horarios, precios, links oficiales, reseñas, clima) o que no tengas en contexto. Cita las fuentes con [link](url). NO lo uses para info que ya tienes en este prompt. NO uses tool calls para preguntas simples informacionales.`;

// Conocimiento RICO del Eurotrip — SOLO se inyecta cuando el viaje activo es el Eurotrip semilla.
const EUROTRIP_KNOWLEDGE = `

=== CONOCIMIENTO ESPECÍFICO DEL EUROTRIP ===
Eurotrip 2026 · 15-31 octubre · viaje de David y Paty por Francia + País Vasco + Madrid.

FUENTE DE VERDAD DE LA RUTA: usa SIEMPRE la lista de ciudades/fechas/noches del bloque "=== VIAJE ACTIVO ===" de arriba — se actualiza solo cuando editan el viaje. NO asumas noches, day trips ni orden de memoria; si algo no cuadra, confía en esa lista (o usa list_saved). Si una ciudad dura 1 día (start = end) es un day trip, no una noche de hotel. No preguntes por destinos que ya están en la lista como si fueran nuevos.

Contexto de zona: Hondarribia es un pueblo fronterizo vasco (escapada desde San Sebastián). La Guardia / Laguardia es el pueblo medieval de la Rioja Alavesa (vino, bodegas, calados) — entre Bilbao y Madrid.
Vuelos (pagados, fijos): AM44 MTY 15 oct 3:25PM → CDG 16 oct 9:40AM (asientos 29A+29B) · AM35 MAD 31 oct 10:30AM → MTY 3:45PM (34H+34J).
Presupuesto pareja: Económico ~$145K MXN · Premium ~$156K MXN.
Restaurantes de referencia: Paris (Bistrot Paul Bert, Bouillon Chartier, Café de Flore, L'As du Fallafel) · Bordeaux (La Tupina, Le Petit Commerce, Garopapilles) · San Sebastián pintxos (La Cuchara de San Telmo, Gandarias, Bar Néstor, Borda Berri) y alta cocina (Arzak, Mugaritz, Akelarre) · Bilbao (Mercado de la Ribera, Café Iruña, La Viña del Ensanche) y alta cocina (Azurmendi, Nerua) · Madrid (Casa Botín, Casa Lucio, La Bola, Mercado de San Miguel).
Traslados típicos: Paris→Bordeaux TGV ~2h · Bordeaux→San Sebastián tren a Hendaya+Euskotren o bus ~3-4h · San Sebastián→Bilbao ~1h15 · Bilbao→Madrid Renfe ~4.5h o vuelo.
Logística: 3 maletas total entre los dos, NO visa Schengen (mexicanos <90 días), ETIAS posible Q4 2026, eSIM Holafly ~€80, tax-free DIVA en Barajas, pasaporte con 6 meses de vigencia.`;

// Contexto dinámico del viaje activo (cualquier viaje), armado desde la DB.
function tripContextBlock(trip, cities, hotels) {
  if (!trip) return '\n\n=== VIAJE ACTIVO ===\n(no se pudo cargar el viaje activo)';
  let s = `\n\n=== VIAJE ACTIVO ===\nNombre: ${trip.name}${trip.subtitle ? ' · ' + trip.subtitle : ''}\n`;
  if (trip.start_date) s += `Fechas: ${trip.start_date} a ${trip.end_date || trip.start_date}\n`;
  else s += `Fechas: sin definir aún\n`;
  s += `Estado: ${trip.status || 'planning'}\n`;
  if (cities && cities.length) s += `Ciudades/paradas:\n` + cities.map(c => `- ${c.name} (${c.start_date || '?'} → ${c.end_date || c.start_date || '?'})`).join('\n') + '\n';
  else s += `Aún no tiene ciudades cargadas — sugiere agregar la primera con add_trip_city.\n`;
  if (hotels && hotels.length) s += `Hoteles: ` + hotels.map(h => `${h.city}: ${h.hotel_name}${h.confirmed ? ' (confirmado)' : ' (por definir)'}`).join(' · ') + '\n';
  return s;
}

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
  {
    name: 'reorder_day',
    description: 'Reordena TODAS las actividades de un día concreto del planner en una sola operación, y opcionalmente les asigna hora. Úsalo cuando te pidan "optimizar el día" o cambiar el orden de varias actividades. Pasa `order` con los ids EN EL NUEVO ORDEN cronológico (de la mañana a la noche). NO necesitas list_saved si ya te dieron los ids en el mensaje.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD del día a reordenar' },
        order: {
          type: 'array',
          description: 'Actividades en el nuevo orden cronológico (de la mañana a la noche)',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'UUID de la actividad' },
              start_time: { type: 'string', description: 'Hora HH:MM sugerida (opcional)' }
            },
            required: ['id']
          }
        }
      },
      required: ['date', 'order']
    }
  },
  {
    name: 'search_flights',
    description: 'Búsqueda REAL de vuelos con precios en vivo (Skyscanner). Devuelve hasta 5 opciones ordenadas por precio con horarios, escalas y link para reservar. Usar SIEMPRE en vez de web_search para precios de vuelos.',
    input_schema: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'Ciudad o aeropuerto de origen (texto libre o IATA, ej: "Monterrey" o "MTY")' },
        destination: { type: 'string', description: 'Ciudad o aeropuerto destino (ej: "Bilbao" o "BIO")' },
        date: { type: 'string', description: 'Fecha de salida YYYY-MM-DD' },
        returnDate: { type: 'string', description: 'Fecha de regreso YYYY-MM-DD (solo si es redondo)' },
        adults: { type: 'number', description: 'Pasajeros adultos (default 1)' },
        cabinClass: { type: 'string', enum: ['economy', 'premium_economy', 'business', 'first'], description: 'Cabina (default economy)' },
        currency: { type: 'string', enum: ['MXN', 'EUR', 'USD'], description: 'Moneda de precios (default MXN)' }
      },
      required: ['origin', 'destination', 'date']
    }
  },
  {
    name: 'search_hotels',
    description: 'Búsqueda REAL de hoteles con precios en vivo por noche, reviews y links de reserva (Skyscanner). Devuelve hasta 6 opciones. Usar SIEMPRE en vez de web_search para precios de hoteles.',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Ciudad (texto libre, ej: "San Sebastián")' },
        checkin: { type: 'string', description: 'Fecha check-in YYYY-MM-DD' },
        checkout: { type: 'string', description: 'Fecha check-out YYYY-MM-DD' },
        adults: { type: 'number', description: 'Huéspedes adultos (default 2)' },
        currency: { type: 'string', enum: ['MXN', 'EUR', 'USD'], description: 'Moneda de precios (default MXN)' }
      },
      required: ['city', 'checkin', 'checkout']
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
async function executeTool(sb, tripId, name, input) {
  const tagged = { ...input, created_by: 'claudia', trip_id: tripId };
  try {
    // Búsquedas reales (Skyscanner) — no tocan la DB, no requieren confirmación
    if (name === 'search_flights') {
      if (!hasSkyKey()) return { ok: false, error: 'RAPIDAPI_KEY no configurada — avisa a David que falta en Vercel' };
      const flights = await skyFlights(input);
      if (!flights.length) return { ok: true, count: 0, message: 'Sin resultados para esa búsqueda' };
      return { ok: true, count: flights.length, results: compactFlights(flights) };
    }
    if (name === 'search_hotels') {
      if (!hasSkyKey()) return { ok: false, error: 'RAPIDAPI_KEY no configurada — avisa a David que falta en Vercel' };
      const hotels = await skyHotels(input);
      if (!hotels.length) return { ok: true, count: 0, message: 'Sin resultados para esa búsqueda' };
      return { ok: true, count: hotels.length, results: compactHotels(hotels) };
    }
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
      const { data, error } = await sb.from(tableName('hotel_choices')).upsert(tagged, { onConflict: 'trip_id,city' }).select().single();
      if (error) throw error;
      return { ok: true, message: `Hotel para ${data.city}: ${data.hotel_name}`, data };
    }
    if (name === 'set_day_plan') {
      const { data, error } = await sb.from(tableName('day_overrides')).upsert(tagged, { onConflict: 'trip_id,date' }).select().single();
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
      let query = sb.from(tableName(input.table)).select('*').eq('trip_id', tripId).order(ord.col, { ascending: ord.asc, nullsFirst: false }).limit(50);
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
      delete cleanPatch.trip_id; // no permitir mover registros entre viajes
      const { data, error } = await sb.from(tableName(table)).update(cleanPatch).eq(pkCol, id).eq('trip_id', tripId).select().single();
      if (error) throw error;
      return { ok: true, message: `Actualizado registro de ${table} (${id.toString().slice(0, 8)})`, data };
    }
    if (name === 'delete_record') {
      const { table, id } = input;
      if (!TABLES.includes(table)) return { ok: false, error: `Tabla inválida: ${table}` };
      if (!id) return { ok: false, error: 'Falta id' };
      if (table === 'budget') return { ok: false, error: 'No se permite borrar categorías de budget (solo editar montos)' };
      const pkCol = 'id';
      const { error } = await sb.from(tableName(table)).delete().eq(pkCol, id).eq('trip_id', tripId);
      if (error) throw error;
      return { ok: true, message: `Borrado de ${table} (${id.toString().slice(0, 8)})` };
    }
    if (name === 'reorder_day') {
      const { date, order } = input;
      if (!date || !Array.isArray(order) || !order.length) return { ok: false, error: 'Faltan date u order[]' };
      let i = 0;
      for (const item of order) {
        if (!item || !item.id) continue;
        const patch = { sort_order: (i + 1) * 10 };
        if (item.start_time) patch.start_time = item.start_time;
        const { error } = await sb.from(tableName('activities'))
          .update(patch)
          .eq('id', item.id).eq('trip_id', tripId).eq('activity_date', date);
        if (error) throw error;
        i++;
      }
      return { ok: true, message: `Día ${date} reordenado (${i} actividades)`, count: i };
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
    const { messages, trip_id } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages[] requerido' });
    }
    const tripId = trip_id || DEFAULT_TRIP_ID;

    const client = new Anthropic({ apiKey });
    let sb = null;
    try { sb = getSupabase(); } catch (e) { /* Supabase opcional, sin él Claudia chatea pero no escribe */ }

    // Contexto dinámico del viaje activo (cualquier viaje)
    let trip = null, cities = [], hotels = [];
    if (sb) {
      try {
        const [tr, ci, ho] = await Promise.all([
          sb.from('eurotrip_trips').select('*').eq('id', tripId).single(),
          sb.from(tableName('trip_cities')).select('name,start_date,end_date').eq('trip_id', tripId).order('start_date', { ascending: true, nullsFirst: false }),
          sb.from(tableName('hotel_choices')).select('city,hotel_name,confirmed').eq('trip_id', tripId)
        ]);
        trip = tr.data || null; cities = ci.data || []; hotels = ho.data || [];
      } catch (e) { /* sin contexto, Claudia sigue con prompt base */ }
    }
    const system = ROLE_PROMPT + tripContextBlock(trip, cities, hotels) + (tripId === DEFAULT_TRIP_ID ? EUROTRIP_KNOWLEDGE : '');

    // Sliding window de 12 turnos (antes 20) — reduce input tokens ~40% en conversaciones largas
    let conversation = messages.slice(-12);
    let safety = 0;
    const toolEvents = [];

    while (safety < 5) {
      safety++;
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1536,
        system,
        tools: sb ? TOOLS : TOOLS.filter(t => t.type === 'web_search_20250305' || t.name === 'search_flights' || t.name === 'search_hotels'),
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
        const result = await executeTool(sb, tripId, block.name, block.input);
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
