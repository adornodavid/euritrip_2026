# BAYU v2 · DESIGN SYSTEM & UX — "Hecho por diseñador, no por developer"

> **Cómo usar este documento**: es la especificación de rediseño visual y de UX de
> Bayu. Cuando se retome en Claude Code: *"Lee BAYU_V2_DESIGN_SYSTEM.md y ejecuta
> el Sprint D1"*. Complementa a `BAYU_V2_MASTER_PLAN.md` (este doc es el CÓMO se
> ve y se siente; aquel es el QUÉ se construye). Se puede ejecutar en paralelo a
> las Fases 0-1 del master plan.
> Estado: 📝 PLANEADO · Última revisión: 11 jun 2026

---

## Índice

1. [Diagnóstico honesto del UI actual](#1-diagnóstico)
2. [Nueva identidad visual: "RÁFAGA"](#2-identidad)
3. [Design tokens (código listo para integrar)](#3-tokens)
4. [Tipografía](#4-tipografía)
5. [Iconografía: muerte al emoji](#5-iconos)
6. [Sistema de componentes](#6-componentes)
7. [Navegación nueva: de 6 tabs a 5 con Claudia al centro](#7-navegación)
8. [UX de app de viajes: los patrones que nos faltan](#8-ux-viajes)
9. [Microinteracciones y haptics](#9-motion)
10. [Accesibilidad (la vara mínima)](#10-a11y)
11. [Plan de implementación por sprints](#11-sprints)

---

<a name="1-diagnóstico"></a>
## 1. Diagnóstico honesto del UI actual

Lo que delata que "lo hizo un dev y no un diseñador" (con evidencia del código):

| # | Problema | Evidencia | Gravedad |
|---|---|---|---|
| 1 | **El color de marca es el de Airbnb.** `--brand:#FF5A5F` es exactamente el "Rausch" de Airbnb. La app se siente "como Airbnb genérico", no como una marca propia | `index.html:19,215` | 🔴 identidad |
| 2 | **Tres gradientes compitiendo**: morado→rosa→naranja (logo/onboarding), coral→naranja (botones), verde→teal (FAB/sadd). Ninguno "es" Bayu; juntos gritan plantilla | `--grad-brand`, `--grad-warm`, `--grad-cool` (l.332-334) | 🔴 identidad |
| 3 | **Emojis como sistema de iconos** (tabbar 🗺️💰🧭🤖👤✈️, botones ✏️🗑️▲▼, categorías 🍽️🏛️). Se ven distintos en cada OS, no se pueden colorear/pesar, y son EL marcador #1 de "web de aficionado" en una app | tabbar, `CAT`, `RES_ICON`, toda la UI | 🔴 |
| 4 | **`confirm()` / `prompt()` / `alert()` nativos del navegador** para borrar viajes, pedir la clave, agregar empaque. En una app de store esto es inaceptable: rompe la inmersión y en WebView se ve a "página web" | `main.js`: `delTrip`, `wkey`, `packAdd`, `delAct`… (~12 usos) | 🔴 |
| 5 | **CSS de 5 capas de parches** (base → "v9.2" → "deep pass 2" → "deep pass 3" → "v10") con overrides `!important`. No hay sistema: hay arqueología. Cada botón nuevo adivina su estilo | `index.html:17-458` | 🟠 deuda |
| 6 | **Sin jerarquía de botones**: conviven `.save` (gradiente), `.addbtn` (dashed), `.chip`, `.pf-btn`, `.eb`, `.sadd`, `.fab` sin reglas de cuándo usar cuál | CSS completo | 🟠 |
| 7 | **6 tabs** (iOS HIG recomienda máx 5) y un FAB verde cuyo significado cambia de pantalla. "Perfil" y "Viajes" son dos tabs para poca cosa | `index.html:530-537` | 🟠 |
| 8 | **Escala tipográfica ad-hoc**: 14 tamaños entre .54rem y 2.7rem sin ritmo (¿.58, .6, .62, .64, .66, .68, .7…?). Tres familias (Sora, Space Grotesk, Space Mono) sin reglas claras | todo el CSS | 🟠 |
| 9 | **Touch targets chicos**: `.mvbtn` (▲▼) ~14px, `.x`, `.rx`, `.del` de 20px — Apple exige 44pt mínimo | `main.js` render | 🟠 |
| 10 | **El planner es un acordeón de ciudades**, no un itinerario. Las apps de viaje top (TripIt, Wanderlog, Flighty) son *day-centric*: vives el viaje por DÍA, no por carpeta de ciudad | `renderPlanner()` | 🟠 UX |
| 11 | **No pasa nada especial cuando ESTÁS de viaje**: el día de hoy solo gana un fondito amarillo. El momento de mayor uso (en el destino, con prisa, con datos limitados) no tiene modo propio | `.day.today` | 🟠 UX |
| 12 | **Contraste insuficiente**: `--muted:#8c8c84` sobre `#FAF6F1` ≈ 2.9:1 (WCAG pide 4.5:1) — y muted se usa para CASI TODO el texto secundario | `index.html:19` | 🟠 a11y |

**Lo que SÍ está bien y se conserva**: la base de cards + bottom sheet, el dark
mode, los empty states ilustrados con CTA, el check animado con pop, las
sugerencias en carrusel horizontal, skeletons, pull-to-refresh, el respeto a
`prefers-reduced-motion`. No se tira todo: se le pone sistema y carácter.

---

<a name="2-identidad"></a>
## 2. Nueva identidad visual: **"RÁFAGA"**

**Concepto.** Bayu = viento (Vayu). El viento no es tibio: es **dirección,
velocidad y cielo**. La identidad deja de ser "coral de Airbnb + arcoíris" y se
vuelve **eléctrica y nocturna**: azul ión como color de acción, un solo gradiente
de firma (azul→violeta, "viento ionizado") reservado para los momentos de magia
(Claudia, CTAs primarios), y ámbar de atardecer SOLO para el viaje en vivo
(HOY, cuenta regresiva). Superficies limpias, tipografía grande y apretada,
sombras de color, mucho aire.

**Personalidad**: confiada, rápida, un poco descarada. Más Hopper/Flighty que
formulario de banco.

### Paleta

| Token | Hex | Uso |
|---|---|---|
| `ink` | `#0D1117` | Texto principal, botones primarios en light |
| `paper` (light bg) | `#F6F4EF` | Fondo cálido (se conserva la calidez actual) |
| `card` | `#FFFFFF` / `#171D2B` | Superficies |
| **`accent` (Azul Ráfaga)** | `#3056F5` | LA acción: links, tab activa, focus, progreso |
| `accent-2` (Violeta Ión) | `#8B5CF6` | Solo en el gradiente de firma |
| **`grad-bayu`** | `135deg, #3056F5 → #8B5CF6` | Claudia, CTA primario hero, onboarding. **ÚNICO gradiente permitido** |
| `live` (Ámbar Atardecer) | `#FFA726` | EXCLUSIVO del modo viaje-en-curso: badge HOY, countdown, próximo evento |
| `pos` | `#10B981` | Éxito, checks, presupuesto sano |
| `neg` | `#F43F5E` | Borrar, sobre-presupuesto, errores |
| `muted` | `#5C6470` light / `#9AA3B2` dark | Texto secundario (contraste AA real: 4.6:1) |
| dark bg | `#0B0E14` | Fondo dark (azulado profundo, no gris) |

**Reglas duras de color:**
1. Muere `#FF5A5F` y mueren `--grad-warm`/`--grad-cool`. Un solo gradiente: `grad-bayu`.
2. El ámbar `live` NUNCA aparece fuera del contexto "viaje en curso" — así el
   color *significa* algo (cuando la app se pinta de ámbar, estás viajando).
3. Color por función, no por decoración: azul = acción, verde = positivo,
   rojo = destructivo, ámbar = en vivo. Nada más.

---

<a name="3-tokens"></a>
## 3. Design tokens (código listo para integrar)

Crear `app/tokens.css` — TODO el CSS nuevo consume SOLO estos tokens. Las 5 capas
actuales se van fusionando a esto (ver Sprint D1).

```css
:root {
  /* ---- color ---- */
  --ink:        #0D1117;
  --paper:      #F6F4EF;
  --card:       #FFFFFF;
  --accent:     #3056F5;
  --accent-ink: #FFFFFF;
  --grad-bayu:  linear-gradient(135deg, #3056F5 0%, #8B5CF6 100%);
  --live:       #FFA726;
  --pos:        #10B981;
  --neg:        #F43F5E;
  --muted:      #5C6470;
  --line:       rgba(13, 17, 23, .09);
  --ring:       rgba(48, 86, 245, .22);          /* focus ring */

  /* ---- elevación (3 niveles, no 12 sombras distintas) ---- */
  --e1: 0 1px 2px rgba(13,17,23,.05);
  --e2: 0 2px 8px rgba(13,17,23,.07), 0 1px 2px rgba(13,17,23,.05);
  --e3: 0 12px 32px -12px rgba(13,17,23,.28);
  --glow-accent: 0 8px 24px -8px rgba(48,86,245,.55);

  /* ---- espaciado: grid de 4px, SIEMPRE ---- */
  --s1: 4px;  --s2: 8px;  --s3: 12px; --s4: 16px;
  --s5: 20px; --s6: 24px; --s7: 32px; --s8: 40px; --s9: 56px;

  /* ---- radios (3, no 9) ---- */
  --r-s: 10px;   /* chips, inputs, pills    */
  --r-m: 16px;   /* cards, botones          */
  --r-l: 24px;   /* sheets, hero, modales   */

  /* ---- tipografía (escala 1.2, ver §4) ---- */
  --f-display: 'Plus Jakarta Sans', system-ui, sans-serif;
  --f-body:    'Plus Jakarta Sans', system-ui, sans-serif;
  --f-mono:    'Space Mono', ui-monospace, monospace;   /* solo horas y montos */
  --t-hero: 800 clamp(1.7rem, 6vw, 2.1rem)/1.05 var(--f-display);
  --t-h1:   800 1.45rem/1.15 var(--f-display);
  --t-h2:   700 1.1rem/1.25  var(--f-display);
  --t-body: 500 .95rem/1.5   var(--f-body);
  --t-sub:  600 .82rem/1.4   var(--f-body);
  --t-cap:  700 .7rem/1.3    var(--f-body);   /* caps: +letter-spacing .06em */

  /* ---- motion ---- */
  --ease-out:  cubic-bezier(.22, .9, .3, 1);
  --ease-pop:  cubic-bezier(.2, .9, .3, 1.4);
  --dur-fast: 140ms; --dur-base: 240ms; --dur-slow: 420ms;

  /* ---- touch ---- */
  --tap-min: 44px;
}

[data-theme="dark"] {
  --ink:   #EDF0F6;
  --paper: #0B0E14;
  --card:  #171D2B;
  --muted: #9AA3B2;
  --line:  rgba(237, 240, 246, .09);
  --e1: 0 1px 2px rgba(0,0,0,.5);
  --e2: 0 2px 10px rgba(0,0,0,.5);
  --e3: 0 16px 40px -14px rgba(0,0,0,.7);
}
```

---

<a name="4-tipografía"></a>
## 4. Tipografía

- **Una sola familia: Plus Jakarta Sans** (Google Fonts, variable 400-800).
  Geométrica-humanista, moderna, con carácter en pesos altos — y una familia en
  vez de tres recorta peso de carga y decisiones. Sora y Space Grotesk se van.
- **Space Mono se queda con UN trabajo**: horas (`08:30`) y montos (`$45,200`),
  con `font-variant-numeric: tabular-nums` para que las cifras alineen en listas.
- **Escala fija de 7 pasos** (la de los tokens). Prohibido inventar tamaños:
  si un texto no cae en la escala, se rediseña el componente, no la escala.
- Display siempre tracking apretado (−0.03em) y pesos 700/800 — los títulos
  grandes y densos son el 50% del look "app cara".
- Jerarquía por PESO y COLOR (ink vs muted), no por multiplicar tamaños.

---

<a name="5-iconos"></a>
## 5. Iconografía: muerte al emoji

- **Set único: [Lucide](https://lucide.dev)** (MIT, stroke 2px, ~1500 íconos,
  estética moderna tipo Feather evolucionado). Se integra como **SVG sprite**
  (`app/icons.svg`) + helper `icon('map-pin')` → `<svg class="ic"><use href="#map-pin"/></svg>`.
  Sin dependencia de framework, colorea con `currentColor`, pesa ~6KB los 40 que usamos.
- Mapa de reemplazo (los principales):
  | Hoy (emoji) | v2 (Lucide) |
  |---|---|
  | 🗺️ Planner | `route` |
  | 💰 Gastos | `wallet` |
  | 🧭 Explore | `compass` |
  | 🤖 Claudia | orbe con `grad-bayu` (ver §7) + `sparkles` |
  | 👤 Perfil | `circle-user` |
  | ✏️ / 🗑️ / ▲▼ | `pencil` / `trash-2` / `chevron-up/down` |
  | 🍽️🏛️🚶🍷🎟️🛍️🚄🧳✨ categorías | `utensils` `landmark` `footprints` `wine` `ticket` `shopping-bag` `train-front` `luggage` `sparkles` |
  | ✈️🏨🚐 reservas | `plane` `bed-double` `bus` |
- **Dónde SÍ viven los emojis**: contenido del usuario (banderas de viaje 🇯🇵,
  texto de notas, mensajes de Claudia). Emojis = contenido; SVG = interfaz.
- Tamaños: 24px tabbar / 20px en botones / 16px inline. Siempre con área táctil ≥44px.

---

<a name="6-componentes"></a>
## 6. Sistema de componentes

### 6.1 Botones — TRES niveles, cero excepciones

```css
/* PRIMARIO — máx 1 por pantalla. La acción que Bayu quiere que hagas. */
.btn-primary {
  font: var(--t-h2); color: #fff; background: var(--grad-bayu);
  border: 0; border-radius: var(--r-m); min-height: 52px; width: 100%;
  box-shadow: var(--glow-accent);
  transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast);
}
.btn-primary:active { transform: scale(.98) translateY(1px); }

/* SECUNDARIO — acciones normales (editar, ver mapa, agregar) */
.btn-secondary {
  font: var(--t-sub); color: var(--ink); background: var(--card);
  border: 1.5px solid var(--line); border-radius: var(--r-m);
  min-height: var(--tap-min); padding: 0 var(--s4); box-shadow: var(--e1);
}

/* GHOST — terciario, navegación, cancelar */
.btn-ghost { font: var(--t-sub); color: var(--muted); background: none; border: 0; min-height: var(--tap-min); }

/* DESTRUCTIVO = secundario con tinte, NUNCA un bote de basura suelto de 20px */
.btn-danger { color: var(--neg); border-color: rgba(244,63,94,.25); }
```

Reglas: `.save/.addbtn/.pf-btn/.eb/.sadd/.chip-como-botón` migran a estos tres.
El "+ actividad" punteado se queda como variante `--dashed` del secundario (es
buen affordance), pero con ícono `plus` SVG.

### 6.2 Bottom sheets reemplazan a `confirm()`/`prompt()`/`alert()`

Un componente único `sheet({title, body, actions})` en JS (~40 líneas) con:
fondo blur, drag-handle, animación spring de entrada, **acción destructiva en
rojo a la derecha**, y swipe-down para cerrar. TODOS los `confirm('¿Borrar…')`
del código migran a esto. Es el cambio #1 en percepción de calidad.

### 6.3 Cards

- Un solo estilo base: `--card`, `--r-m`, `--e2`, borde `--line`. La elevación
  `--e3` se reserva para elementos "flotantes" (sheet, hero, popover).
- **Cards de lugar/actividad ganan imagen**: en v2 las actividades enriquecidas
  (con foto vía Explore/Places) muestran thumbnail 56×56 redondeado a la
  izquierda — las listas de solo-texto se ven a "todo list", las de foto a
  "app de viajes".

### 6.4 Inputs

Altura 52px, radio `--r-s`, label flotante o fija arriba en `--t-cap`, focus con
`--ring` (ya existe el patrón, se estandariza). Selects nativos se visten con
chevron SVG propio. Date pickers: nativos (son buenos en móvil), pero disparados
desde chips de fecha bonitos, no desde un `<input date>` pelón.

---

<a name="7-navegación"></a>
## 7. Navegación nueva: de 6 tabs a 5 con Claudia al centro

```
┌─────────────────────────────────────────────┐
│  [route]   [compass]   ( ✦ )   [wallet] [user]
│   Viaje     Explore   CLAUDIA   Gastos  Perfil
└─────────────────────────────────────────────┘
```

- **Claudia al CENTRO como orbe con `grad-bayu`** (56px, sobresale 8px de la
  tabbar, glow sutil). Es nuestro diferenciador #1 y hoy está escondida en un
  4º tab con emoji de robot. El orbe "respira" (pulso suave) cuando Claudia
  tiene una sugerencia proactiva.
- **El tab "Viajes" desaparece**: el switcher de viaje vive en el header del
  Planner (tocar el nombre del viaje → sheet con la lista de viajes estilo
  cards actuales + "Nuevo viaje"). Patrón estándar (Slack workspaces, Notion).
- **El FAB verde desaparece**: su lugar lo toma un botón contextual por pantalla
  (en Planner: "+" en el header del día; en Gastos: `.btn-primary` "Agregar
  gasto" fijo abajo). Un FAB genérico que cambia de significado es ambigüedad,
  no atajo.
- Labels en `--t-cap`, ícono activo con relleno suave `--ring` tipo píldora
  (Material 3) en vez de la rayita superior.

---

<a name="8-ux-viajes"></a>
## 8. UX de app de viajes: los patrones que nos faltan

Esto es lo que separa "lista de tareas con ciudades" de "app de viajes". Por
prioridad de impacto:

### 8.1 El viaje tiene CICLO DE VIDA — la home se adapta

| Estado | Detección | La pantalla "Viaje" muestra |
|---|---|---|
| **Soñando** | sin fechas | Hero inspiracional + CTA "Ponle fechas" + Explore sugerido |
| **Planeando** | fechas futuras | Countdown grande (`42 días ✈️`) + checklist de preparación (hotel por ciudad, vuelos, seguro, empaque) con % + planner |
| **EN VIVO** | hoy ∈ [start, end] | **MODO HOY** (8.2) — la app entera se acentúa con `--live` |
| **Recuerdo** | end < hoy | Portada tipo álbum: stats del viaje (días, ciudades, gastos, fotos), galería, "Compartir resumen" |

Hoy todo esto es la misma pantalla con un texto que cambia (`tripInfo()`).
El cambio de estado es EL momento emocional de una app de viajes — hay que
diseñarlo, no solo detectarlo.

### 8.2 MODO HOY (la feature de diseño más importante de v2)

Cuando estás de viaje, abrir la app debe responder en <1 segundo: **"¿qué sigue?"**

```
┌──────────────────────────────┐
│ MIÉ 21 OCT · San Sebastián   │  ← día + ciudad, ámbar --live
│ ☀️ 20°/13° · €142 hoy        │  ← clima + gasto del día
├──────────────────────────────┤
│ ▶ AHORA · 13:30              │
│   Pintxos en La Cuchara      │  ← card grande, foto, botones
│   [Cómo llegar] [✓ Hecho]    │     directos (1 tap, no 3)
├──────────────────────────────┤
│ Después: 16:00 Monte Igueldo │  ← timeline compacta del resto
│          20:30 Cena Gandarias│
└──────────────────────────────┘
```

- Timeline vertical **con conectores y horas**, actividad actual resaltada.
- Swipe → en una actividad = ✓ hecha (con haptic); swipe ← = posponer/mover.
- Day-pills horizontales arriba (`L M X J V S D` con fechas) para saltar de día
  — patrón Wanderlog/TripIt. El acordeón por ciudad se conserva como vista
  "Plan" (toggle Hoy/Plan), porque para PLANEAR la ciudad sí es la unidad mental.

### 8.3 Crear viaje = wizard conversacional, no formulario

El modal actual de "Nuevo viaje" (8 campos de golpe) se vuelve un flujo de
pantalla completa en 3 pasos, con Claudia como voz:

1. **"¿A dónde vas?"** — autocomplete de ciudades (geocoding ya planeado en
   Fase 1) con fotos de fondo; multi-destino con chips.
2. **"¿Cuándo?"** — range calendar grande (o "aún no sé" → estado Soñando).
3. **"¿Con quién y en qué moneda?"** — viajeros + currency.

Al terminar: confetti sutil, el viaje YA tiene ciudades con fechas repartidas,
clima, y Claudia saluda con 3 sugerencias del destino. **Time-to-wow < 60 seg.**

### 8.4 Chat de Claudia con superpoderes visibles

- **Action cards en el chat**: cuando Claudia agrega/edita algo, en vez de solo
  texto "✅ Anoté…", aparece una mini-card del objeto (actividad con su día,
  gasto con su monto) con botón "Ver" / "Deshacer". El usuario VE el poder.
- Sugerencias proactivas como chips contextuales (al abrir el chat en un viaje
  sin hotel: "Buscar hotel en Bilbao").
- Videos de YouTube embebidos en burbuja (ya planeado en Fase 3) con player
  in-app, y galerías de fotos en carrusel dentro de la burbuja.
- Indicador "Claudia está escribiendo" con el orbe animado (no "…").

### 8.5 Gastos que se sienten fintech

- Número del total con **animación count-up** y `tabular-nums`.
- Anillo de presupuesto (donut) como héroe en vez de solo barras; barras por
  categoría se quedan.
- Captura en 2 taps: botón grande "+ Gasto" → sheet con teclado numérico
  custom estilo calculadora (monto primero, categoría con íconos después).
- Tendencia: "vas $X bajo/sobre presupuesto al día Y" (línea simple, no chart lib).

### 8.6 Detalles de hospitalidad (baratos, alto impacto)

- **Countdown compartible**: card "Faltan 42 días para Japón 🇯🇵" exportable como
  imagen (canvas) para stories — loop viral gratuito.
- Header del planner con **parallax suave** en la foto del hero (ya hay `transition
  transform`, falta ligarlo a scroll).
- **Greeting por hora** en el header: "Buenos días, David" (del perfil, no hardcodeado).
- Pull-to-refresh con el logo de viento girando (asset ya existe: `app/logo.svg`).
- Modo avión friendly: banner "Sin conexión — mostrando tu plan guardado" en
  `--live` ámbar en vez de error.

---

<a name="9-motion"></a>
## 9. Microinteracciones y haptics

Presupuesto de movimiento (todo con `--dur-*`/`--ease-*`, nada inventado):

| Momento | Animación | Haptic (Capacitor `@capacitor/haptics`) |
|---|---|---|
| Completar actividad | check pop (ya existe) + línea que tacha en 200ms | `impact(light)` |
| Guardar (gasto/actividad) | sheet baja + toast sube + count-up del total | `notification(success)` |
| Swipe complete/posponer | card desliza con resistencia, fondo verde/ámbar revelado | `impact(medium)` al cruzar umbral |
| Cambiar de viaje | crossfade del hero (350ms) | — |
| Borrar | sheet de confirmación; al confirmar, colapso de altura 240ms | `notification(warning)` |
| Tab change | píldora del ícono se desliza entre tabs (no aparece/desaparece) | `selection()` |
| Orbe Claudia | breathing 3s loop (escala 1→1.04) solo cuando hay sugerencia | — |

Regla: **una animación por evento**. Se eliminan el `sheen` infinito de la barra
de progreso y el `fabpulse` permanente — el movimiento perpetuo sin significado
cansa y gasta batería. `prefers-reduced-motion` ya se respeta; se mantiene.

---

<a name="10-a11y"></a>
## 10. Accesibilidad (la vara mínima de store)

- [ ] Contraste AA (4.5:1) en TODO texto — el nuevo `--muted` ya cumple; auditar
      con axe/Lighthouse al cerrar cada sprint.
- [ ] Touch targets ≥ 44×44 (los íconos chicos viven dentro de áreas táctiles grandes).
- [ ] `aria-label` en todos los botones de solo-ícono (hoy: cero).
- [ ] Focus visible con `--ring` para teclado/switch control.
- [ ] `font-size` base respeta Dynamic Type (usar rem, nunca px en texto — ya casi).
- [ ] Dark mode auditado (hoy hay grises hardcodeados `#0f1420` regados; migrar a tokens).

---

<a name="11-sprints"></a>
## 11. Plan de implementación por sprints

> Independiente de las fases del master plan; ideal correrlo DESPUÉS de Fase 0
> (auth) y junto con Fase 1 (de-hardcodeo), porque ambos reescriben las mismas
> pantallas. D1-D2 son pre-requisito de todo lo visual.

### Sprint D1 — Fundación (1 semana)
- [ ] Crear `app/tokens.css` (§3) y cargar Plus Jakarta Sans.
- [ ] **Fusionar las 5 capas de CSS en una sola hoja organizada** por componente
      que consume tokens (borrar `!important`s, gradientes viejos y `#FF5A5F`).
- [ ] Sprite `app/icons.svg` con los ~40 Lucide + helper `icon()` + reemplazo
      de emojis de INTERFAZ (tabbar, botones, categorías).
- [ ] Componente `sheet()` y migración de TODOS los `confirm/prompt/alert`.
- [ ] Sistema de botones (§6.1) y limpieza de variantes.
- **Criterio**: cero emojis en chrome de UI, cero diálogos nativos, una sola
  fuente de color/espaciado/radio. La app ya se ve "de diseñador" sin tocar UX.

### Sprint D2 — Navegación + identidad (1 semana)
- [ ] Tabbar de 5 con orbe Claudia al centro (§7); morir tab Viajes y FAB.
- [ ] Switcher de viaje en header + sheet de viajes.
- [ ] Hero nuevo con parallax + estados de ciclo de vida básicos (§8.1: countdown
      planeando / portada recuerdo).
- [ ] Onboarding 3 pantallas con la identidad RÁFAGA (reemplaza el actual morado).

### Sprint D3 — Modo HOY + planner timeline (1-2 semanas)
- [ ] Toggle Hoy/Plan; MODO HOY completo (§8.2) con card "AHORA" y day-pills.
- [ ] Swipe gestures (✓ / posponer) + haptics (requiere Capacitor de Fase 2,
      con fallback web sin haptic).
- [ ] Timeline con conectores y thumbnails en actividades.

### Sprint D4 — Wizard + gastos fintech + chat cards (1-2 semanas)
- [ ] Wizard "Nuevo viaje" conversacional (§8.3).
- [ ] Gastos: donut + count-up + sheet de captura con teclado custom (§8.5).
- [ ] Action cards en el chat de Claudia (§8.4).
- [ ] Countdown compartible como imagen (§8.6).

**Total: ~5-6 semanas**, solapables con Fases 1-3 del master plan.

---

### Referencias de nivel (para calibrar el ojo, no para copiar)

- **Flighty** — modo "en vivo" y jerarquía de información de un solo vistazo.
- **Hopper** — color con actitud y personalidad juguetona sin verse infantil.
- **Wanderlog** — timeline de itinerario y day-pills.
- **Airbnb** — bottom sheets, búsqueda como wizard por pasos, fotografía como UI.
- **Arc / Linear** — disciplina de design tokens y un solo gradiente de firma.
