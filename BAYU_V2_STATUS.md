# BAYU v2 · STATUS — estado del proyecto y bitácora de sesiones

> **Cómo usar este documento**: es el punto de entrada para retomar el trabajo.
> En una sesión nueva de Claude Code di: **"Lee BAYU_V2_STATUS.md y continúa
> donde nos quedamos"**. Mantenerlo actualizado al final de cada sesión de trabajo.

---

## 🗺️ Mapa de documentos del proyecto

| Documento | Qué contiene | Cuándo leerlo |
|---|---|---|
| **`BAYU_V2_STATUS.md`** (este) | Estado actual + bitácora + siguientes pasos | SIEMPRE primero |
| `BAYU_V2_MASTER_PLAN.md` | El QUÉ: 7 fases (auth+RLS, de-hardcodeo, Capacitor, Explore, ads+Pro, afiliados, stores) | Para trabajar funcionalidad v2 |
| `BAYU_V2_DESIGN_SYSTEM.md` | El CÓMO se ve: identidad RÁFAGA, tokens, sprints D1-D4 | Para trabajo visual/UX |
| `sql/v2-draft-2026-06-11-auth-rls-multiuser.sql` | Migración DB v2 (NO aplicada) | Al ejecutar Fase 0 |
| `CLAUDE.md` | Mapa del código + convenciones | Lo lee Claude Code solo |

---

## 📍 Estado actual (al 11 jun 2026)

### Hecho y en `main` (producción)
- ✅ `README.md` actualizado al estado real del proyecto (PR #1).
- ✅ Plan maestro v2 + borrador SQL + `CLAUDE.md` (PR #1).
- ✅ Design system RÁFAGA documentado (PR #2).

- ✅ **Rediseño RÁFAGA (Sprint D1 + orbe D2) EN PRODUCCIÓN** (PR #3, aprobado
  por David tras revisar el preview). Detalle de lo implementado:
  - `app/ui.css` nueva: design tokens RÁFAGA (azul `#3056F5`, un gradiente de
    firma azul→violeta, ámbar `--live` solo para HOY), reemplaza las 5 capas
    de CSS inline de `index.html`.
  - Tipografía Plus Jakarta Sans + Space Mono (horas/montos, tabular-nums).
  - Sprite SVG de íconos (`#i-*` en index.html) + helper `I()` en main.js —
    cero emojis en chrome de UI (tabbar, botones editar/borrar/mover, FAB, chat).
  - Tabbar de 5 con **Claudia al centro como orbe** con gradiente; tab "Viajes"
    eliminado → switcher tocando la marca o el hero.
  - `askSheet/confirmSheet/promptSheet/infoSheet` en main.js reemplazan TODOS
    los `confirm()/prompt()/alert()` nativos; validaciones → toasts.
  - `wkey()` ahora es async (sheet en vez de prompt). manifest + theme-color
    al azul nuevo. sw.js cache `bayu-v11-rafaga`.
- 💡 Tip de previews: Vercel genera un preview automático con cada push a la
  rama (protegido con Vercel Authentication — entrar logueado, o generar link
  compartible con el tool `get_access_to_vercel_url` del MCP de Vercel).
  ⚠️ Los previews usan la MISMA DB de producción: lo que guardes ahí es real.

---

## 🧭 Siguientes pasos (en orden recomendado)

1. **Fase 0 del master plan** (BLOQUEANTE para friends & family): Supabase Auth + RLS real.
   Prompt: *"Lee BAYU_V2_MASTER_PLAN.md y ejecuta la Fase 0"*. (David decidió 11-jun
   ejecutar Fase 1 primero; Fase 0 sigue siendo requisito antes de invitar usuarios.)
2. **Sprints D3-D4 del diseño**: Modo HOY, wizard de viaje, gastos fintech.
   Prompt: *"Lee BAYU_V2_DESIGN_SYSTEM.md y ejecuta el Sprint D3"*.
3. Fases 2-6: Capacitor → Explore dinámico → ads+Pro → afiliados → stores.

> ✅ **Fase 1 (de-hardcodeo) EJECUTADA el 11-jun** — ver bitácora abajo. Pendientes
> menores de Fase 1: onboarding-wizard completo (es parte de D4/Fase 0) y normales
> climáticas para fechas >16 días (se quitó el fallback hardcodeado de octubre).

---

## 📓 Bitácora de sesiones

### Sesión 11 jun 2026 (Claude Code web)
- Análisis completo del repo y auditoría del código v1.
- `README.md` reescrito al estado real → **PR #1 mergeado a main**.
- **`BAYU_V2_MASTER_PLAN.md`** creado: visión de negocio (ads AdMob + Bayu Pro
  vía RevenueCat + afiliados Travelpayouts/GetYourGuide), auditoría con los 7
  problemas bloqueantes de seguridad, inventario de ~20 hardcodeos David/Paty/
  Eurotrip, arquitectura objetivo (Capacitor + supabase-js con RLS + serverless
  solo para secretos), 7 fases con checklists, control de costos de IA.
- **`sql/v2-draft-2026-06-11-auth-rls-multiuser.sql`**: migración completa v2
  (profiles, trip_members, trip_travelers, chat_messages, ai_usage, city_guides,
  affiliate_clicks, RLS por membresía, triggers, migración de datos).
- **`BAYU_V2_DESIGN_SYSTEM.md`** creado → **PR #2 mergeado a main**: diagnóstico
  con evidencia (color de Airbnb `#FF5A5F`, emojis como íconos, confirm()
  nativos, CSS en 5 capas), identidad RÁFAGA, navegación 5 tabs + orbe,
  Modo HOY, wizard conversacional, sprints D1-D4.
- **Sprint D1+orbe IMPLEMENTADO** (commit `0ec6f47`), verificado en preview
  de Vercel, aprobado por David y **mergeado a producción (PR #3)**.
- `BAYU_V2_STATUS.md` creado como punto de entrada para retomar sesiones.
- Decisiones tomadas: Capacitor (no React Native), Supabase Auth (no Auth0),
  AdMob+RevenueCat (no Stripe-only), Travelpayouts como red principal de
  afiliados, tablas renombradas a `bayu_*` en la migración v2.

### Sesión 11 jun 2026 (Claude Code local — tarde 2) — FASE 1: de-hardcodeo total ejecutada
- **Migración DB aplicada** (`sql/2026-06-11-fase1-dehardcodeo.sql`): `trips.home_currency`
  + `trips.guide_url` · `trip_cities.lat/lng/country_code` (backfill 7 ciudades Eurotrip) ·
  tablas nuevas `eurotrip_trip_travelers` (seed David+Paty), `eurotrip_packing_items`,
  `eurotrip_chat_messages` (RLS + GRANTs + reload schema). Conocimiento del prompt viejo
  de Claudia → 3 notas del viaje en DB.
- **api/**: fuera `DEFAULT_TRIP_ID` (sin trip activo = error 400 explícito), fuera
  `EUROTRIP_KNOWLEDGE`, prompt de Claudia 100% dinámico (viajeros + moneda base del trip),
  historial de chat persistente por viaje (GET /api/chat?trip= + insert post-turno),
  tool nueva `add_packing_items`, TABLES += trip_travelers/packing_items.
- **app/main.js + index.html**: pagadores dinámicos desde `trip_travelers` (split, chips,
  modal) · `money()`/fxCalc por `home_currency` con tasa en vivo (frankfurter.dev, caché
  24h, fallback manual) · clima por geocoding Open-Meteo (al guardar ciudad + auto-heal
  de ciudades sin coords; fuera WX_COORDS/WX_OCT) · tips/chips/emergencia genéricos
  (emergencia = dataset por país ISO de las ciudades) · empaque en DB con migración 1-vez
  desde localStorage + "lista básica"/Claudia · sugerencias hardcodeadas fuera (cards
  genéricas Tours/Qué ver/Videos/Ideas IA hasta el motor de Fase 3) · guía `/guia` gated
  por `trips.guide_url` · localStorage `eurotrip_*`→`bayu_*` con migración suave ·
  viajeros editables en Perfil · moneda base en modal de viaje · sw cache `bayu-v12-fase1`.
- **Regla de oro verificada**: `grep -riE "david|paty|eurotrip|2026-10|<ciudades>" app/ api/ index.html sw.js`
  = 0 hits funcionales (solo claves localStorage legacy en código de migración).
- Diferido consciente: wizard onboarding completo (D4), normales climáticas >16 días,
  rename de tablas `eurotrip_*`→`bayu_*` (va con la migración v2 de Fase 0).

### Sesión 11 jun 2026 (Claude Code local — tarde) — búsqueda real de vuelos/hoteles portada de Bayu v1
- **Auditoría de Bayu v1** (Next.js en `Proyectos Claude Code/Personal David/BAYU/bayu-app`):
  la búsqueda real funcionaba con **Skyscanner vía RapidAPI** (`flights-sky`), no con
  Amadeus (ese módulo apuntaba al sandbox de test y nunca se cableó a las rutas).
  La key `RAPIDAPI_KEY` de v1 sigue viva (verificada con request real).
- **`api/_skyscanner.js`** nuevo: port a JS vanilla del cliente de v1 — vuelos one-way/
  roundtrip (con polling de resultados incompletos), hoteles con precios por partner +
  booking URLs, autocomplete de lugares. Acepta ciudades en texto libre o IATA.
  Retry con backoff (el upstream del provider da 502 intermitente). + helpers
  `compactFlights`/`compactHotels` para no inflar tokens de Claudia.
- **`api/search.js`** nuevo: endpoint GET (`type=airports|flights|hotels`) para el futuro
  UI de búsqueda (Sprint D3+) sin gastar tokens de IA.
- **Claudia: 2 tools nuevas** en `chat.js` — `search_flights` y `search_hotels` (resultados
  compactos top 5-6, prompt actualizado con fallback honesto a web_search si el provider
  falla). Sirve YA para el pendiente de definir hoteles de San Sebastián y Bilbao.
- **`RAPIDAPI_KEY` configurada en Vercel** (Production + Preview) vía CLI/REST.
- ⚠️ Probado en vivo: **vuelos OK** (BIO→MAD 18 resultados, $1,128 MXN directo Air Europa);
  **hoteles intermitente** ese día (502 del upstream de RapidAPI) — el código degrada con
  error honesto y Claudia ofrece web_search como plan B. Re-probar hoteles en vivo.
- Sinergia futura: los resultados de hoteles traen `otherPrices` por partner → conecta
  directo con la Fase 5 de afiliados (Travelpayouts) del master plan.

<!-- Plantilla para nuevas sesiones:
### Sesión DD mmm AAAA
- Qué se hizo / decisiones / commits / pendientes que dejó
-->
