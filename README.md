# Eurotrip 2026 · David + Paty

Propuesta interactiva HTML para viaje a Europa **15-31 Octubre 2026** (15 noches).

🌐 **Sitio público**: https://adornodavid.github.io/euritrip_2026/ (GitHub Pages, sin chatbot)
🤖 **Sitio con chatbot IA** (Vercel): pendiente de deploy — ver instrucciones abajo

## Ruta v6

**Paris 4N → Bordeaux 2N → Toulouse 1N → Barcelona 3N → Valencia 1N → Madrid 4N = 15N**

Todo por tren de alta velocidad, sin vuelos cortos, máximo 3h15min por tramo.

## Day trips

- 🏰 **Versalles** (desde Paris)
- 🍷 **Saint-Émilion** viñedo UNESCO (desde Bordeaux)
- 🏰 **Toledo** UNESCO (desde Madrid)
- 🍷 Día 29 flex: Chinchón / Vinos Madrid DO / Ribera del Duero (según presupuesto)

## Vuelos (ya pagados · $30K MXN pareja)

- **IDA**: AM44 · MTY 3:25 PM (jue 15 oct) → CDG 9:40 AM (vie 16 oct) · Asientos 29A + 29B
- **REGRESO**: AM35 · MAD 10:30 AM (sáb 31 oct) → MTY 3:45 PM · Asientos 34H + 34J

## Features v6 (Da Maria style)

- **Diseño editorial** estilo awwwards.com/sites/da-maria
- Tipografía **Playfair Display** (italic serif) + Sora + Space Mono
- Scroll animations con IntersectionObserver
- 6 mapas Leaflet con zonas hoteles + restaurantes + museos + landmarks
- Links automáticos a Google Maps + Booking + Tripadvisor + TheFork + YouTube por cada lugar
- Galería de fotos clickeable → Google Images del lugar real
- Widgets de clima por ciudad (octubre)
- Gastronomía + platos típicos por ciudad
- **Chatbot IA "Mily"** powered by Claude (requiere deploy en Vercel)
- Presupuesto detallado EUR + MXN

## Stack

- Frontend: HTML + CSS + JS vanilla
- Mapas: Leaflet 1.9.4
- Fuentes: Google Fonts (Playfair Display, Sora, Space Mono)
- IA chatbot: Anthropic Claude vía Vercel Serverless Function
- Hosting: GitHub Pages (sin chatbot) + Vercel (con chatbot)

## Cómo hacer deploy en Vercel (con chatbot funcional)

### 1. Conectar repo a Vercel

1. Ve a https://vercel.com/new
2. Login con GitHub (`adornodavid`)
3. **Import** el repo `adornodavid/euritrip_2026`
4. Framework Preset: **Other** (Vercel detecta automáticamente)
5. Root Directory: dejar default (raíz)
6. Build Command: dejar vacío
7. Output Directory: dejar vacío
8. **NO hagas deploy todavía** — primero env vars (siguiente paso)

### 2. Configurar Environment Variables

**ANTES de hacer deploy** (o agrega después y haz Redeploy):

| Name | Value | Para qué |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | Chatbot Claudia |
| `SUPABASE_URL` | `https://qflyzgbsufvwrfkrrpfo.supabase.co` | DB Stream Match |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (copia de Supabase dashboard) | Acceso server-side a DB |
| `EUROTRIP_WRITE_KEY` | invéntala (ej: `paty-david-2026`) | Auth para form manual |

**Para conseguir SUPABASE_SERVICE_ROLE_KEY:**
1. Ve a https://supabase.com/dashboard/project/qflyzgbsufvwrfkrrpfo/settings/api
2. Sección "Project API Keys"
3. Copia el valor de **`service_role`** (no anon, el service_role)
4. Pégalo en Vercel como `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **NUNCA** subas `service_role` a Git. Solo va en Vercel env vars.

### 3. Verificar que funciona

1. Vercel te da URL tipo `https://euritrip-2026-xxxxxx.vercel.app`
2. Abre el sitio
3. Click en el botón flotante 💬 (esquina inferior derecha)
4. Pregunta: *"¿Cuánto cuesta el viaje?"*
5. Si responde con info del viaje → ✅ funcional
6. Si dice "API key no configurada" → revisar env vars en Vercel

### 4. (Opcional) Dominio custom

En Vercel → Settings → Domains → puedes apuntar `eurotrip.arkamia.mx` o lo que quieras.

## Cómo desarrollar localmente

```bash
# Instalar Vercel CLI (solo primera vez)
npm install -g vercel

# En la carpeta del proyecto
cd "Proyectos Personales/eurotrip 2026"
npm install

# Linkear con tu proyecto Vercel
vercel link

# Pull env vars (incluye ANTHROPIC_API_KEY)
vercel env pull .env.local

# Correr localhost con función serverless
vercel dev
```

Abre http://localhost:3000 — el chatbot funciona localmente igual que en prod.

## Seguridad

🚨 **API key**: NUNCA en el código frontend ni en commits. Vive como env var en Vercel.

🚨 Si por error la committeas, **revoca inmediatamente** en https://console.anthropic.com/settings/keys y genera una nueva.

## Branding

Arkamia Brandbook: Off White + Lightning Yellow + Bolt Black · Playfair Display + Sora + Space Mono

---

Propuesta generada con Claude Code · Versión v6.0 (27 mayo 2026)
