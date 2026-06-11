# Bayu · Trip Planner

App de planeación de viajes (PWA) de David + Paty. Nació como propuesta interactiva del **Eurotrip 2026 (15–31 octubre)** y evolucionó a una app **multi-viaje** con asistente de IA.

🌐 **Sitio público**: https://adornodavid.github.io/euritrip_2026/ (GitHub Pages, solo `guia.html`, sin backend)
🤖 **App completa** (Vercel): requiere las env vars de abajo — chatbot, gastos, planner y datos en vivo.

## Qué hace la app

Seis pestañas:

- 🗺️ **Planner** — itinerario día por día con actividades editables, clima por día, botones rápidos por actividad (info, mapa, boletos) y "Optimizar día con IA" (reordena por cercanía y horarios).
- 💰 **Gastos** — presupuesto vs. gastos reales en MXN, por categoría, con fotos de recibos.
- 🧭 **Explore** — tips, ideas y guía de emergencia por viaje.
- 🤖 **Claudia** — asistente de viaje con IA (ver abajo).
- 👤 **Perfil** — datos del viaje activo y ajustes.
- ✈️ **Viajes** — crear, editar y cambiar entre viajes (multi-viaje: nada está hardcodeado a un solo trip).

La **ruta, ciudades, fechas y hoteles viven en Supabase**, no en el código: se editan desde la app o vía Claudia, y todos los componentes (incluida Claudia) leen el itinerario en vivo.

## Claudia (chatbot IA)

Serverless function (`api/chat.js`) con Claude + tool use:

- CRUD completo sobre el viaje activo: notas, links, reservaciones, hoteles, gastos, actividades, ciudades y presupuesto.
- `web_search` para horarios, precios, links oficiales y fotos reales.
- Reordena días completos del planner (`reorder_day`).
- Responde en Markdown con fotos y links; pide confirmación antes de editar o borrar.
- Conocimiento extra del Eurotrip semilla (vuelos, restaurantes, logística) solo cuando ese es el viaje activo.

## Eurotrip 2026 (viaje semilla)

- **Vuelos pagados**: AM44 MTY 15 oct 3:25 PM → CDG 16 oct 9:40 AM (29A+29B) · AM35 MAD 31 oct 10:30 AM → MTY 3:45 PM (34H+34J).
- **Ruta actual**: vive en la DB (tab ✈️ Viajes) — Francia + País Vasco + Madrid. La guía editorial original (ruta v6 por Barcelona/Valencia) se conserva en `guia.html` como referencia histórica.
- **Presupuesto pareja**: Económico ~$145K MXN · Premium ~$156K MXN.

## Estructura del repo

```
index.html        App shell de Bayu (PWA)
app/main.js       Lógica de la app (tabs, planner, gastos, chat, viajes)
app/              Íconos, logo (viento/Vayu) y opciones de logo
api/chat.js       Claudia: Claude + tool use + web_search
api/data.js       GET estado completo del viaje activo (lectura pública)
api/write.js      Escritura a Supabase (protegida con write key)
api/upload.js     Subida de imágenes a Supabase Storage (recibos)
api/translate.js  Traductor rápido de frases de viaje (Claude Haiku)
api/_supabase.js  Cliente compartido + tablas + auth de escritura
guia.html         Guía editorial estática original del Eurotrip (standalone)
sql/              Migraciones de Supabase
manifest.json     PWA manifest (Bayu)
sw.js             Service worker — network-first para el app shell
```

## Stack

- Frontend: HTML + CSS + JS vanilla · PWA (manifest + service worker)
- Diseño: "Sunset Editorial" v10 · Playfair Display + Sora + Space Mono
- DB: Supabase (tablas `eurotrip_*`: trips, trip_cities, activities, expenses, budget, notes, bookmarks, reservations, hotel_choices, day_overrides, media) + Storage
- IA: Anthropic Claude vía Vercel Serverless Functions
- Hosting: Vercel (app completa) · GitHub Pages (guía estática)

## Deploy en Vercel

1. https://vercel.com/new → Import `adornodavid/euritrip_2026` → Framework Preset: **Other**, build/output vacíos.
2. Configura las env vars **antes** del primer deploy (o agrega y haz Redeploy):

| Name | Value | Para qué |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | Claudia + traductor |
| `SUPABASE_URL` | `https://qflyzgbsufvwrfkrrpfo.supabase.co` | DB |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (Supabase dashboard → Project API Keys → `service_role`) | Acceso server-side a DB |
| `EUROTRIP_WRITE_KEY` | clave compartida inventada | Auth para escrituras desde la app |

⚠️ **NUNCA** subas `service_role` ni la API key a Git. Solo env vars en Vercel.

3. Abre el sitio → pestaña 🤖 Claudia → pregunta algo del viaje. Si responde con datos del itinerario → ✅ funcional.

## Desarrollo local

```bash
npm install -g vercel   # solo primera vez
npm install
vercel link
vercel env pull .env.local
vercel dev              # http://localhost:3000 con funciones serverless
```

## Seguridad

🚨 Si una API key llega a un commit por error, **revócala de inmediato** en https://console.anthropic.com/settings/keys y genera una nueva.

## Branding

Bayu = viento (Vayu). Arkamia Brandbook: Off White + Lightning Yellow + Bolt Black · Playfair Display + Sora + Space Mono.

---

Hecho con Claude Code · v10 "Sunset Editorial" (junio 2026)
