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

### Hecho y en la rama `claude/euritrip-analysis-updates-ugm10o` (NO en main aún)
- ✅ **Sprint D1 + orbe D2 IMPLEMENTADOS** (commit `0ec6f47`):
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
- 🔍 **Preview en vivo** (Vercel lo genera automático al pushear la rama):
  https://euritrip-2026-git-claude-96bd33-adornodavid-gmailcoms-projects.vercel.app
  (protegido con Vercel Authentication — entrar logueado en Vercel, o generar
  link compartible con el tool `get_access_to_vercel_url` del MCP de Vercel).
  ⚠️ El preview usa la MISMA DB de producción: lo que guardes ahí es real.

### Pendiente de decisión de David
- [ ] **Aprobar el rediseño RÁFAGA** (verlo en el preview) → al aprobar, merge
      de la rama a `main` = el rediseño sale a producción.

---

## 🧭 Siguientes pasos (en orden recomendado)

1. **Aprobar/ajustar rediseño** y mergear la rama (lleva el rediseño a prod).
2. **Fase 0 del master plan** (BLOQUEANTE): Supabase Auth + RLS real.
   Prompt: *"Lee BAYU_V2_MASTER_PLAN.md y ejecuta la Fase 0"*.
3. **Fase 1**: de-hardcodeo total (inventario completo en §1.3 del master plan).
4. **Sprints D3-D4 del diseño**: Modo HOY, wizard de viaje, gastos fintech.
   Prompt: *"Lee BAYU_V2_DESIGN_SYSTEM.md y ejecuta el Sprint D3"*.
5. Fases 2-6: Capacitor → Explore dinámico → ads+Pro → afiliados → stores.

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
- **Sprint D1+orbe IMPLEMENTADO** en la rama (commit `0ec6f47`) y verificado
  con preview deploy de Vercel. main NO tocado.
- Decisiones tomadas: Capacitor (no React Native), Supabase Auth (no Auth0),
  AdMob+RevenueCat (no Stripe-only), Travelpayouts como red principal de
  afiliados, tablas renombradas a `bayu_*` en la migración v2.

<!-- Plantilla para nuevas sesiones:
### Sesión DD mmm AAAA
- Qué se hizo / decisiones / commits / pendientes que dejó
-->
