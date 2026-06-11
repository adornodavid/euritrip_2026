# Bayu · Guía para Claude Code

## Qué es este proyecto

**Bayu** es un trip planner PWA (vanilla JS + Vercel Serverless + Supabase) con
asistente de IA ("Claudia", Claude con tool use). Hoy es la app personal del
Eurotrip 2026 de David y Paty; **está en transición a Bayu v2**: app multi-usuario
con login, descargable de Google Play / App Store, con ads, suscripción Pro y
afiliados de vuelos/hoteles.

## 📋 Plan maestro v2

**Empieza SIEMPRE por `BAYU_V2_STATUS.md`** (estado actual + bitácora + siguiente
paso). Luego, **antes de cualquier trabajo de v2, lee `BAYU_V2_MASTER_PLAN.md`.** Contiene:
auditoría del código actual, arquitectura objetivo, 7 fases con checklists y
criterios de aceptación, y el borrador de migración
`sql/v2-draft-2026-06-11-auth-rls-multiuser.sql` (NO aplicado aún).

Orden de fases: 0 auth+RLS → 1 de-hardcodeo → 2 Capacitor → 3 Explore dinámico →
4 ads+Pro → 5 afiliados → 6 stores. Las fases 0 y 1 son bloqueantes.

**Para trabajo visual/UX, lee `BAYU_V2_DESIGN_SYSTEM.md`**: identidad nueva
"RÁFAGA" (tokens, tipografía, iconos Lucide, sistema de botones), navegación de
5 tabs con Claudia al centro, Modo HOY, y 4 sprints de implementación (D1-D4).
Regla: nada de emojis en chrome de UI, nada de `confirm()/alert()`, todo color/
espaciado/radio sale de `app/tokens.css`.

## Mapa del código (v1 actual)

| Archivo | Qué es |
|---|---|
| `index.html` | App shell: 6 tabs (Planner, Gastos, Explore, Claudia, Perfil, Viajes), modales, CSS completo |
| `app/main.js` | TODA la lógica de UI. Estado en globals `DATA/TRIPS/TRIP`. Render por concatenación de strings + `esc()` |
| `api/chat.js` | Claudia: Claude + 11 tools (CRUD por viaje) + web_search. Prompt con bloque hardcodeado del Eurotrip (a eliminar) |
| `api/data.js` | GET estado completo del viaje activo (hoy público, sin auth) |
| `api/write.js` | CRUD genérico `{action, table, row/patch, id, trip_id}` (hoy auth = clave compartida X-Write-Key) |
| `api/upload.js` / `api/translate.js` | Storage de imágenes / traductor con Haiku |
| `api/_supabase.js` | Cliente service_role + lista de tablas + write key |
| `guia.html` | Guía editorial estática del Eurotrip original (275KB, standalone, no tocar) |

## Convenciones

- Español mexicano en UI, comentarios y commits (estilo: `fix(chat): …`, `feat: …`).
- Vanilla JS, sin framework. Escapar SIEMPRE contenido dinámico con `esc()`.
- Tablas Supabase con prefijo `eurotrip_` (v1) → serán `bayu_` (v2, ver draft SQL).
- Todo dato de viaje lleva `trip_id`; NUNCA mezclar datos entre viajes.
- Secretos solo en env vars de Vercel, jamás en código ni commits.
- Deploy: Vercel (auto desde `main`). Probar local: `vercel dev`.

## Reglas v2 (cuando se trabaje el plan)

- Ninguna cadena "David", "Paty", "eurotrip", fechas de oct 2026 ni ciudades
  hardcodeadas en código nuevo — todo viene de DB/APIs.
- `trip_id` se valida SIEMPRE server-side contra la membresía del usuario (JWT),
  nunca se confía en el body.
- Toda llamada a Claude pasa por chequeo de quota (`bayu_ai_usage`) y usa el
  modelo mínimo necesario (Haiku para tareas simples, Sonnet para chat).
