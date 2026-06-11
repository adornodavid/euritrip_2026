# BAYU v2 · MASTER PLAN — de PWA personal a app multi-usuario en las stores

> **Cómo usar este documento**: es la fuente de verdad para construir Bayu v2.
> Cuando retomes en Claude Code, di: *"Lee BAYU_V2_MASTER_PLAN.md y ejecuta la Fase N"*.
> Cada fase tiene checklist, archivos a tocar y criterios de aceptación.
> Estado: 📝 PLANEADO · Última revisión: 11 jun 2026

---

## Índice

0. [Visión y modelo de negocio](#0-visión)
1. [Auditoría: cómo funciona hoy (y qué está mal para multi-usuario)](#1-auditoría)
2. [Arquitectura objetivo](#2-arquitectura-objetivo)
3. [Fase 0 — Fundación: auth real + seguridad (BLOQUEANTE)](#fase-0)
4. [Fase 1 — De-hardcodeo total + aislamiento por viaje](#fase-1)
5. [Fase 2 — Empaquetado nativo (APK / App Store) con Capacitor](#fase-2)
6. [Fase 3 — Explore dinámico por ciudad + videos + búsqueda poderosa](#fase-3)
7. [Fase 4 — Monetización: ads + suscripción "Bayu Pro"](#fase-4)
8. [Fase 5 — Afiliados: buscador de vuelos y hoteles con comisión](#fase-5)
9. [Fase 6 — Lanzamiento en stores (compliance y checklist)](#fase-6)
10. [Control de costos de IA](#10-costos-ia)
11. [Variables de entorno v2 (lista completa)](#11-env-vars)
12. [Orden de ejecución y dependencias](#12-orden)

---

<a name="0-visión"></a>
## 0. Visión y modelo de negocio

**Bayu** = trip planner con asistente de IA (Claudia) que cualquier persona descarga
de Google Play / App Store, crea su cuenta, y gestiona N viajes con planner,
gastos, documentos, álbum y exploración por ciudad.

**Fuentes de ingreso (3):**

| Fuente | Mecanismo | Free | Pro |
|---|---|---|---|
| 1. Publicidad | AdMob (app nativa) + AdSense (web) | ✅ ve ads | ❌ sin ads |
| 2. Suscripción **Bayu Pro** | RevenueCat (App Store + Play Billing + Stripe web) | — | $XX/mes o $XXX/año |
| 3. Afiliados | Links de comisión en búsqueda de vuelos/hoteles (Travelpayouts, Booking, GetYourGuide) | ✅ | ✅ |

**Tiers propuestos:**

- **Free**: 2 viajes · 30 mensajes de Claudia/mes · ads · afiliados activos.
- **Pro**: viajes ilimitados · Claudia ilimitada (fair use) · sin ads · colaboradores
  ilimitados por viaje · "Optimizar día con IA" ilimitado.

La colaboración (lo que hoy son David+Paty en un mismo viaje) **se conserva como
feature**: un viaje tiene dueño + miembros invitados. Es diferenciador real.

---

<a name="1-auditoría"></a>
## 1. Auditoría: cómo funciona hoy

### 1.1 Flujo actual (v10)

```
index.html (app shell, 6 tabs) ── app/main.js (render + estado en DATA global)
        │
        ├── GET  /api/data?trip=<id>   → lee TODO el viaje activo (PÚBLICO, sin auth)
        ├── POST /api/write            → CRUD genérico {action,table,row|patch,id,trip_id}
        │                                auth: header X-Write-Key == EUROTRIP_WRITE_KEY (clave compartida)
        ├── POST /api/chat             → Claudia: Claude + 11 tools + web_search, scoped a trip_id del body
        ├── POST /api/upload           → imagen base64 → Supabase Storage bucket 'eurotrip' (público)
        └── POST /api/translate        → Claude Haiku, traducción rápida
        
Supabase: tablas eurotrip_* (trips, trip_cities, activities, expenses, budget,
notes, bookmarks, reservations, hotel_choices, day_overrides, media).
Todas las funciones usan SERVICE_ROLE (bypassa RLS). RLS efectivamente inexistente.
```

### 1.2 Problemas BLOQUEANTES para multi-usuario (orden de gravedad)

| # | Problema | Dónde | Riesgo |
|---|---|---|---|
| 1 | **Sin usuarios**: una sola clave compartida (`EUROTRIP_WRITE_KEY`) da escritura TOTAL a todas las tablas de TODOS los viajes | `api/_supabase.js:checkWriteKey`, `api/write.js` | Cualquiera con la clave borra todo |
| 2 | **Lectura pública total**: `/api/data` devuelve gastos, documentos, reservas de cualquier viaje con solo pasar `?trip=<uuid>` | `api/data.js` | Privacidad cero |
| 3 | **`trip_id` viene del cliente** sin validar pertenencia: en `/api/write` y `/api/chat` el body decide a qué viaje escribir | `api/write.js:23`, `api/chat.js` | Un usuario escribe en el viaje de otro |
| 4 | **`DEFAULT_TRIP_ID` como fallback**: si falta `trip_id`, escribe al Eurotrip semilla → contaminación cruzada silenciosa | `api/_supabase.js:24`, `api/write.js:23` | Datos de un viaje caen en otro |
| 5 | **Sin límites de IA**: `/api/chat` y `/api/translate` abiertos → factura Anthropic ilimitada | `api/chat.js`, `api/translate.js` | Costo descontrolado |
| 6 | Storage bucket `eurotrip` público con uploads sin dueño | `api/upload.js` | Quota/abuso |
| 7 | CORS `*` en todos los endpoints | todos los `api/*.js` | Amplifica 1-5 |

### 1.3 Inventario COMPLETO de hardcodeo David/Paty/Eurotrip (a eliminar en Fase 1)

**`app/main.js`:**
- `SUGG` (líneas ~6-12): sugerencias fijas de Paris/Bordeaux/San Sebastián/Bilbao/Madrid con imágenes locales `images/` → motor dinámico (Fase 3).
- `SEED_TRIP` + `isEurotrip()` (l.17-18): branching especial para el viaje semilla → eliminar.
- `tripStart()/tripEnd()` con fallback `'2026-10-16'/'2026-10-31'` (l.15-16) → sin fallback de fechas.
- `started = new Date()>=new Date('2026-10-16...')` (renderPlanner) → usar fechas del trip.
- `DAYTRIPS=['Versalles','Saint-Émilion','Toledo']` (l.32) → quitar (las paradas ya cubren esto).
- `WX_COORDS` / `WX_OCT` (l.174-175): coords y normales de octubre hardcodeadas por ciudad → geocoding dinámico (Open-Meteo Geocoding API, gratis) al guardar la ciudad; guardar `lat/lng` en `trip_cities`.
- Gastos: pagadores fijos `'David','Paty','Joint'` (renderGastos, modal) → tabla `trip_travelers` por viaje.
- `money()` siempre MXN → `trips.home_currency` por viaje.
- `TIPS` eurotrip (l.275) y `PACK_DEFAULT` europeo (l.288) → generados por ciudad/destino (Fase 3) y empaque por viaje en DB (hoy vive en `localStorage` = se pierde entre dispositivos).
- `emergencyHtml()` con teléfonos Francia/España fijos → por país de las ciudades del viaje (dataset estático de números de emergencia por país ISO, es data pública pequeña).
- `CHIPS_EURO` (l.374) → solo chips genéricos contextuales.
- `wkey()` prompt "Clave de escritura (David/Paty)" (l.22) → muere con auth real.
- Header `index.html`: `"Tu viaje · 15–31 Oct 2026"` hardcodeado de inicio.
- localStorage keys `eurotrip_*` → `bayu_*` (migración suave al arrancar).
- Link a `/guia` (guia.html, 275KB del Eurotrip) → solo visible si el usuario tiene ese contenido; en v2 sale del bundle de la app.

**`api/chat.js`:**
- `ROLE_PROMPT`: "asistente de viaje de **David y Paty**" → "del usuario" con nombre del perfil inyectado.
- `EUROTRIP_KNOWLEDGE` completo (vuelos AM44/AM35, restaurantes, presupuesto $145K) → **eliminar**; si el usuario quiere ese contexto, vive como notas/reservas del viaje en DB.
- Categorías de gasto y `payer="Joint"` default, tasa `~22 MXN/EUR` → derivar de `trip_travelers` y `home_currency`.
- `DEFAULT_TRIP_ID` → eliminar; sin trip activo = error explícito.

**`api/_supabase.js` / `api/write.js`:** `DEFAULT_TRIP_ID`, `EUROTRIP_WRITE_KEY`, prefijo de tablas `eurotrip_` (cosmético; se renombra a `bayu_` en la migración v2 mientras los datos son pocos).

**Regla de oro post-Fase 1**: *ninguna* cadena "David", "Paty", "eurotrip", fecha de
octubre 2026 ni ciudad europea debe existir en el código fuera de datos en DB.
Verificable con: `grep -riE "david|paty|eurotrip|2026-10|versalles" app/ api/ index.html`

---

<a name="2-arquitectura-objetivo"></a>
## 2. Arquitectura objetivo

```
┌─ CLIENTES ─────────────────────────────────────────────────────┐
│  Web (PWA, Vercel)      Android (APK/AAB)      iOS (IPA)       │
│  └── mismo código web ──┴── Capacitor wrapper ──┘              │
│      supabase-js (auth + queries con RLS, anon key)            │
└────────────┬───────────────────────────────────────────────────┘
             │ JWT del usuario en cada request
┌────────────▼───────────────────────────────────────────────────┐
│  Vercel Serverless (solo lo que NO puede ir directo a DB):     │
│   /api/chat        Claudia (valida JWT + membership + quota)   │
│   /api/explore     genera/lee guías de ciudad cacheadas        │
│   /api/affil/*     búsqueda vuelos/hoteles + deep links        │
│   /api/translate   (valida JWT + quota)                        │
│   /api/billing/*   webhooks RevenueCat → profiles.plan         │
└────────────┬───────────────────────────────────────────────────┘
┌────────────▼───────────────────────────────────────────────────┐
│  Supabase                                                      │
│   Auth: email+password, Google, Apple                          │
│   Postgres con RLS REAL (ver sql/v2-draft-*.sql)               │
│   Storage: bucket por-usuario con policies                     │
└────────────────────────────────────────────────────────────────┘
```

**Decisiones tomadas (no re-discutir sin razón fuerte):**

1. **Capacitor, no React Native/Flutter.** El frontend actual (vanilla JS, ~500
   líneas de lógica) funciona y es bueno en móvil. Capacitor lo envuelve tal
   cual → APK/AAB e iOS en días, no meses, con acceso a plugins nativos
   (AdMob, IAP, cámara, push). Reescribir en RN tiraría 100% del código por ~0
   beneficio de producto.
2. **CRUD directo del cliente a Supabase con RLS** (supabase-js + anon key)
   reemplaza a `/api/write` y `/api/data`. Menos latencia, menos código, y la
   seguridad vive en la DB (un solo lugar). Las funciones serverless quedan SOLO
   para lo que necesita secretos (Claude, afiliados, billing).
3. **Supabase Auth** (no Auth0/Firebase): ya estamos en Supabase, RLS se integra
   nativo, social login incluido. ⚠️ Apple exige "Sign in with Apple" si
   ofreces Google login en iOS — implementar los tres: email+password, Google, Apple.
4. **Migrar a Vite** (build) al hacer Fase 2: necesario para Capacitor y para
   partir `main.js` en módulos (`auth.js`, `planner.js`, `gastos.js`, `explore.js`,
   `claudia.js`, `viajes.js`, `api.js`). Sin framework: sigue vanilla.
5. **Tablas renombradas `eurotrip_*` → `bayu_*`** en la migración v2 (los datos
   actuales son pocos; es el único momento barato para hacerlo).

---

<a name="fase-0"></a>
## Fase 0 — Fundación: auth real + seguridad 🔐 (BLOQUEANTE, ~1 semana)

> Nada de lo demás se lanza sin esto. Resuelve los problemas 1-7 de la auditoría.

### Modelo de datos nuevo (ver `sql/v2-draft-2026-06-11-auth-rls-multiuser.sql`)

```
profiles        1:1 con auth.users (display_name, avatar_url, plan, ai_msgs_month…)
trips           + owner_id, home_currency, country_codes[]
trip_members    (trip_id, user_id, role: owner|editor|viewer) ← colaboración David+Paty
trip_travelers  (trip_id, name, emoji) ← reemplaza David/Paty/Joint hardcodeado
ai_usage        contadores por usuario/mes ← quotas
city_guides     caché GLOBAL de contenido por ciudad (Fase 3)
affiliate_clicks tracking de clicks de afiliado (Fase 5)
```

### Checklist

- [ ] Aplicar migración SQL v2 (revisar draft primero; crea tablas nuevas, renombra
      `eurotrip_*`→`bayu_*`, agrega `owner_id`, activa RLS con policies por membership).
- [ ] Activar Supabase Auth: email+password (con verificación), Google OAuth, Apple.
- [ ] Frontend: pantalla de login/registro (reemplaza el onboarding actual),
      sesión con `supabase-js`, logout en Perfil, "olvidé mi contraseña".
- [ ] Reemplazar `write()`/`load()` de `main.js` por queries supabase-js directas
      (RLS protege). Eliminar `/api/write`, `/api/data`, `wkey()`, `EUROTRIP_WRITE_KEY`.
- [ ] `/api/chat` y `/api/translate`: exigir `Authorization: Bearer <jwt>`,
      resolver `user_id` con `supabase.auth.getUser(jwt)`, **verificar membership
      del trip_id en servidor** (nunca confiar en el body), aplicar quota (ver §10).
- [ ] Uploads: bucket privado `user-media`, path `user_id/trip_id/...`, policies de
      Storage por dueño; URLs firmadas para servir.
- [ ] CORS: restringir a los orígenes de la app (web + capacitor://localhost).
- [ ] Migrar datos existentes: crear cuenta para David, asignarle `owner_id` de los
      viajes actuales, invitar a Paty como member del Eurotrip.
- [ ] **Borrado de cuenta in-app** (lo exige Apple) + export de datos (GDPR).

**Snippet de referencia — middleware de auth para las funciones que quedan:**

```js
// api/_auth.js (v2)
import { createClient } from '@supabase/supabase-js';
const admin = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

export async function requireUser(req) {
  const jwt = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!jwt) return { error: 'No autenticado', status: 401 };
  const { data: { user }, error } = await admin().auth.getUser(jwt);
  if (error || !user) return { error: 'Sesión inválida', status: 401 };
  return { user };
}

export async function requireTripMember(userId, tripId, minRole = 'editor') {
  if (!tripId) return { error: 'trip_id requerido', status: 400 };
  const { data } = await admin().from('bayu_trip_members')
    .select('role').eq('trip_id', tripId).eq('user_id', userId).maybeSingle();
  const rank = { viewer: 0, editor: 1, owner: 2 };
  if (!data || rank[data.role] < rank[minRole]) return { error: 'Sin acceso a este viaje', status: 403 };
  return { role: data.role };
}
```

**Criterio de aceptación:** usuario B no puede leer ni escribir NADA del viaje de
usuario A (probar con curl pasando trip_id ajeno a /api/chat y queries directas).

---

<a name="fase-1"></a>
## Fase 1 — De-hardcodeo total + aislamiento por viaje 🧹 (~1 semana)

### Checklist

- [ ] Ejecutar TODO el inventario §1.3 (es la lista de trabajo literal).
- [ ] **Pagadores dinámicos**: UI de gastos lee `trip_travelers`; al crear viaje se
      agrega "Yo" (nombre del perfil) + botón "agregar viajero"; split "Juntos" solo
      si hay 2+. Migrar gastos existentes (David/Paty/Joint → travelers del Eurotrip).
- [ ] **Moneda por viaje**: `trips.home_currency` (selector al crear viaje);
      `money()` formatea según esa moneda; FX del modal de gastos usa una API de
      tipo de cambio (exchangerate.host, gratis) con caché diario, no `22` fijo.
- [ ] **Clima dinámico**: al guardar una ciudad → geocoding Open-Meteo
      (`geocoding-api.open-meteo.com/v1/search?name=...`) → persistir `lat/lng/country_code`
      en `trip_cities`. `fetchWx` usa esas coords. Sin `WX_COORDS`. (Las normales
      mensuales también las da Open-Meteo Climate API para fechas >16 días.)
- [ ] **Prompt de Claudia 100% dinámico**: nombre(s) del usuario/viajeros desde DB,
      moneda desde el trip, cero bloque EUROTRIP_KNOWLEDGE. El historial de chat se
      persiste por (user, trip) en una tabla `bayu_chat_messages` → contexto sobrevive
      reinstalaciones y NUNCA se cruza entre viajes (key compuesta).
- [ ] **Empaque** a DB (`bayu_packing_items` por trip) con lista inicial generada por
      Claudia según destino/clima/duración (1 llamada al crear el viaje, cacheable).
- [ ] **Onboarding nuevo**: registro → "crea tu primer viaje" (nombre, fechas,
      moneda) → "agrega tu primera ciudad" → planner.
- [ ] Verificación final: `grep -riE "david|paty|eurotrip|2026-10" app/ api/ index.html` = 0 hits
      (excepto migraciones sql históricas y guia.html que sale del bundle).

**Criterio de aceptación:** crear "Viaje a Japón" como usuario nuevo → Claudia,
gastos, presupuesto, clima, tips y explore hablan SOLO de ese viaje; cambiar a otro
viaje no arrastra ni un dato (chat, filtros, totales, álbum).

---

<a name="fase-2"></a>
## Fase 2 — Empaquetado nativo con Capacitor 📱 (~1-2 semanas)

### Checklist

- [ ] Migrar a **Vite**: `npm create vite@latest` estructura, partir `main.js` en
      módulos ES, `index.html` como entry. Sin cambios visuales.
- [ ] `npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios`
      → `npx cap init Bayu mx.arkamia.bayu --web-dir=dist`.
- [ ] Config nativa: splash screen + íconos (ya existen 192/512), status bar,
      orientación portrait, `@capacitor/app` para botón back de Android.
- [ ] **Estrategia de updates**: el shell nativo carga los assets del bundle;
      evaluar Capgo o @capacitor/live-updates para empujar JS sin pasar por review
      (las stores lo permiten para contenido JS de Capacitor).
- [ ] Plugins que sustituyen hacks web: `@capacitor/camera` (recibos/álbum),
      `@capacitor/share`, `@capacitor/network` (offline queue), Push (Fase 4+,
      recordatorios "mañana vuelas a X").
- [ ] Deep links / App Links (`bayu://` + https universal links) para invitaciones
      a viajes compartidos.
- [ ] Builds: Android Studio → AAB firmado; Xcode → TestFlight. Cuentas:
      Google Play Console ($25 una vez), Apple Developer ($99/año).
- [ ] La web (Vercel) sigue siendo el mismo build → PWA se mantiene gratis.

**Criterio de aceptación:** APK instalable corriendo todo el flujo (login → crear
viaje → Claudia → gasto con foto de cámara) + build iOS en TestFlight.

---

<a name="fase-3"></a>
## Fase 3 — Explore dinámico por ciudad + videos + búsqueda poderosa 🌍 (~2 semanas)

> Hoy Explore solo brilla para el Eurotrip (SUGG/TIPS fijos). El objetivo: agregas
> "Kioto" a tu viaje → minutos después Explore tiene guía, videos, qué hacer, tips,
> números de emergencia y frases del idioma local. Para CUALQUIER ciudad del mundo.

### Motor de guías de ciudad (caché global compartida)

```
Usuario agrega ciudad → /api/explore?city=Kioto&country=JP&lang=es
  1. ¿Existe en bayu_city_guides (no expirada)? → devolver (el 2º usuario que
     agrega Kioto la recibe gratis: el costo de generación se amortiza globalmente)
  2. Si no: generar en background:
     a. Claude + web_search → JSON estructurado: { intro, top_sights[8],
        food[5], tips[6], scams_warnings[], best_areas[], day_trips[],
        emergency: {police, ambulance}, phrases[{local, es, fonética}] }
     b. YouTube Data API (search, ~100 unidades/búsqueda, 10K gratis/día)
        → top 4-6 videos "guía de viaje <ciudad>" → guardar videoIds
     c. Fotos: Wikimedia Commons / Unsplash API → urls de portada
  3. Persistir en bayu_city_guides (key: ciudad normalizada + lang, TTL 90 días)
```

### Checklist

- [ ] Endpoint `/api/explore` (con auth + quota) según el flujo de arriba.
- [ ] Tabla `bayu_city_guides` (ya en el SQL draft) + job de generación.
- [ ] **UI Explore v2**: secciones por ciudad del viaje activo — "Qué hacer"
      (cards con foto, sustituye SUGG), "🎬 Videos" (carrusel de **YouTube embebido
      IN-APP** con iframe API — sin saltar a la app de YouTube), "Tips locales",
      "Frases útiles" (con el traductor ya existente), "Emergencia" (números del
      país real de cada ciudad).
- [ ] "Qué hacer" → botón "+ Agregar al planner" (reusa `openAct` prellenado) y
      botón "🎟️ Ver tours" → link GetYourGuide/Viator **con affiliate ID** (anticipo
      de Fase 5; GetYourGuide ya está hoy sin afiliado en `actQuick`).
- [ ] **Claudia con videos y media**: el render de chat (`mdToHtml`) aprende a
      embeber YouTube (detectar urls de youtube → iframe) y a mostrar mini-cards
      de lugares; nueva tool `search_videos` (YouTube API) junto a `web_search`.
- [ ] **Búsqueda global en la app** (header): un input que busca sobre TODO el viaje
      (actividades, gastos, notas, reservas, guías) — es un filtro client-side
      sobre DATA, barato y muy útil.

**Criterio de aceptación:** viaje nuevo a una ciudad NO europea (ej. Tokio u Oaxaca)
→ Explore se llena solo con contenido real y videos reproducibles dentro de la app.

---

<a name="fase-4"></a>
## Fase 4 — Monetización: ads + Bayu Pro 💰 (~2 semanas)

### Ads

- [ ] **App nativa: AdMob** vía `@capacitor-community/admob` (AdSense NO aplica a
      apps nativas; AdSense queda solo para la versión web).
  - Formatos: **banner anclado** abajo del contenido en Planner/Explore (nunca
    tapando el tabbar) + **interstitial con frecuencia capada** (máx 1 por sesión,
    nunca en medio de un flujo de guardado) + **native ads** como card cada ~8
    items de Explore. NO ads dentro del chat de Claudia (mata la experiencia).
  - [ ] **Consentimiento**: Google UMP SDK (GDPR/EEA) + App Tracking Transparency
        en iOS si se usan ads personalizados (alternativa: ads no personalizados
        sin ATT).
- [ ] Web: AdSense con los mismos placements.
- [ ] Gate central `isPro()` en el cliente + `profiles.plan` como verdad (set por
      webhook de RevenueCat, NUNCA por el cliente).

### Suscripción Bayu Pro

- [ ] **RevenueCat** como capa única: App Store IAP + Google Play Billing + Stripe
      (web) con un solo SDK y webhooks. ⚠️ Apple/Google EXIGEN IAP para features
      digitales — no se puede cobrar Pro con Stripe dentro de la app nativa.
- [ ] Productos: `bayu_pro_monthly`, `bayu_pro_yearly` (con trial 7 días).
- [ ] Paywall: pantalla de upgrade (al exceder quota de Claudia, al crear 3er viaje,
      botón "Quitar anuncios" en Perfil).
- [ ] `/api/billing/revenuecat-webhook` → actualiza `profiles.plan` + `plan_expires_at`.
- [ ] Restaurar compras + manejo de expiración/grace period.

**Criterio de aceptación:** comprar Pro en sandbox (TestFlight/internal testing)
→ ads desaparecen y quota de IA se libera en <1 min; cancelar → revierte al expirar.

---

<a name="fase-5"></a>
## Fase 5 — Afiliados: vuelos y hoteles con comisión ✈️🏨 (~2 semanas)

> Nueva sección dentro del viaje: "Buscar vuelos" y "Buscar hoteles". Prellenado
> con las ciudades y fechas del viaje. Resultados in-app → deep link de afiliado →
> si compran, comisión para Bayu.

### Red de afiliados (decisión)

- **Travelpayouts** como red principal: una sola cuenta cubre **Aviasales/Jetradar
  (vuelos)** y **Hotellook (hoteles)**, tiene API JSON gratuita de búsqueda de
  precios + deep links con `marker` de afiliado, sin requisitos de tráfico para
  entrar. Comisión típica: ~1.6-2% vuelos, ~6-7% hoteles sobre la comisión del OTA.
- Complementos cuando haya tráfico: **Booking.com Affiliate Partner** (mejor
  conversión hotelera; pide volumen), **GetYourGuide Partner** para tours (aplicar
  ya — los links de tours YA existen en la app en `actQuick`/`openSug`, hoy
  regalamos esos clicks), **Kayak/Skyscanner** como alternativa de vuelos.

### Checklist

- [ ] Alta en Travelpayouts + GetYourGuide Partner → obtener `TP_MARKER`, `TP_API_TOKEN`, `GYG_PARTNER_ID`.
- [ ] `/api/affil/flights?from=&to=&depart=&return=` → proxy a la API de precios de
      Travelpayouts (cachear 30 min). El `from` default: geolocalización o aeropuerto
      guardado en perfil. ⚠️ El token NUNCA va al cliente → por eso es serverless.
- [ ] `/api/affil/hotels?city=&checkin=&checkout=` → ídem con Hotellook; el
      check-in/out se deriva de `trip_cities.start/end_date` de cada parada.
- [ ] **UI "✈️ Vuelos"**: card en Planner (si el viaje no tiene reserva de vuelo) +
      sección en Explore: top 5 opciones con precio/escala/duración → botón
      "Reservar" = deep link con marker → registra en `bayu_affiliate_clicks`.
- [ ] **UI "🏨 Hoteles"**: en cada ciudad del planner, junto a "Definir hotel":
      "🔍 Buscar hoteles" → top opciones con precio/noche y rating → "Ver precios"
      (deep link) y "Elegir este" (guarda en `hotel_choices` + link de afiliado).
- [ ] **Claudia vende sin ser vendedora**: nueva tool `search_flights` /
      `search_hotels` (llaman los mismos endpoints) — "¿cuánto está el vuelo a
      Madrid?" → opciones reales + link de afiliado. Disclosure: "puede que ganemos
      una comisión si reservas desde este link" (obligatorio FTC/UE).
- [ ] Sustituir los links GetYourGuide existentes por versión con partner ID.
- [ ] Dashboard mínimo: query de `affiliate_clicks` por semana (medir funnel).

**Criterio de aceptación:** desde un viaje con ciudades+fechas, buscar hotel → abrir
deep link → la visita aparece atribuida en el dashboard de Travelpayouts (sandbox).

---

<a name="fase-6"></a>
## Fase 6 — Lanzamiento en stores 🚀 (~1 semana + reviews)

- [ ] **Legal**: Política de privacidad + Términos (URL pública obligatoria para
      ambas stores y para AdMob/UMP). Generar páginas en el dominio (ej.
      bayu.arkamia.mx/privacy).
- [ ] **Apple App Store**: ficha (screenshots 6.7" y 5.5", iPad opcional),
      App Privacy "nutrition labels", Sign in with Apple ✓ (Fase 0), borrado de
      cuenta in-app ✓ (Fase 0), IAP revisables, demo account para el reviewer.
- [ ] **Google Play**: Data Safety form, content rating (IARC), target API level
      vigente, AAB firmado con Play App Signing, ficha + screenshots.
- [ ] **AdMob**: vincular apps publicadas, ads.txt en el dominio web para AdSense.
- [ ] Analytics + crashes: PostHog o Firebase Analytics + Sentry (decidir; PostHog
      es más privacy-friendly para la ficha de privacidad).
- [ ] Beta cerrada: TestFlight + Play internal testing con 10-20 usuarios reales
      ANTES del release público (mínimo 2 semanas — Play exige 12 testers/14 días
      para cuentas personales nuevas).
- [ ] Versionado: semver + changelog; pipeline de release documentado en este repo.

---

<a name="10-costos-ia"></a>
## 10. Control de costos de IA (crítico al abrir a público)

| Medida | Implementación |
|---|---|
| Quota por plan | `ai_usage` (user, mes): Free 30 msgs, Pro ilimitado con fair-use 1000/mes. Checar ANTES de llamar a Claude; al exceder → paywall. |
| Routing de modelos | Translate/empaque/títulos → **Haiku**. Chat Claudia → **Sonnet**. Nunca Opus en runtime. |
| Prompt caching | El system prompt de Claudia (rol + tools) es estable → `cache_control` de Anthropic ahorra ~90% de esos tokens. |
| Historial acotado | Mandar solo últimos ~20 mensajes + resumen (hoy ya se trunca en cliente; hacerlo server-side). |
| Guías amortizadas | `city_guides` global: 1 generación sirve a todos los usuarios (el costo por usuario tiende a 0). |
| `max_tokens` techo | Chat 1200, translate 600 (ya), explore 3000. |
| Alarma de gasto | Budget alert en Anthropic Console + métrica diaria de `ai_usage`. |

---

<a name="11-env-vars"></a>
## 11. Variables de entorno v2

| Var | Dónde | Nueva | Para qué |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel | — | Claudia, translate, guías |
| `SUPABASE_URL` | Vercel + cliente | — | DB |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | — | Solo funciones (auth check, billing) |
| `SUPABASE_ANON_KEY` | cliente | ✅ | supabase-js con RLS |
| `YOUTUBE_API_KEY` | Vercel | ✅ | Videos en Explore/Claudia |
| `TP_API_TOKEN` / `TP_MARKER` | Vercel | ✅ | Travelpayouts (vuelos/hoteles) |
| `GYG_PARTNER_ID` | Vercel | ✅ | Afiliado GetYourGuide |
| `REVENUECAT_WEBHOOK_SECRET` | Vercel | ✅ | Validar webhooks de billing |
| `ADMOB_APP_ID_ANDROID/IOS` + unit IDs | app nativa | ✅ | Ads |
| ~~`EUROTRIP_WRITE_KEY`~~ | — | ☠️ | **Se elimina en Fase 0** |

---

<a name="12-orden"></a>
## 12. Orden de ejecución y dependencias

```
Fase 0 (auth+RLS) ──► Fase 1 (de-hardcodeo) ──► Fase 2 (Capacitor)
                                   │                    │
                                   ▼                    ▼
                          Fase 3 (Explore/video)  Fase 4 (ads+Pro)
                                   │                    │
                                   └────► Fase 5 (afiliados) ──► Fase 6 (stores)
```

- 0 y 1 son secuenciales y bloqueantes (la seguridad primero; sin ella, todo lo
  demás es construir sobre arena).
- **El rediseño visual/UX vive en `BAYU_V2_DESIGN_SYSTEM.md`** (sprints D1-D4):
  correrlo en paralelo con la Fase 1, porque ambos reescriben las mismas pantallas.
- 3 puede avanzar en paralelo con 2 (es mayormente backend+UI web).
- 4 requiere 2 (los SDKs de ads/IAP son nativos).
- 5 puede empezar su parte de API/UI tras la Fase 1 (los deep links funcionan en
  web), pero el tracking serio conviene con la app ya empaquetada.
- **Total estimado: ~9-11 semanas** de trabajo enfocado para llegar a beta en stores.

### Primer prompt sugerido al retomar

> "Lee BAYU_V2_MASTER_PLAN.md. Vamos a ejecutar la Fase 0: revisa y ajusta
> sql/v2-draft-2026-06-11-auth-rls-multiuser.sql, aplícalo en Supabase, y
> implementa login/registro con Supabase Auth en el frontend."
