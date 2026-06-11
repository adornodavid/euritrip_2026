-- ============================================================================
-- BAYU v2 · Fase 0 · BORRADOR de migración: auth + multi-usuario + RLS real
-- ============================================================================
-- ⚠️ DRAFT — NO APLICADO. Antes de ejecutar:
--   1. Verificar el esquema VIVO (algunas tablas tienen columnas agregadas por
--      migraciones que no están en este repo, ej. budget ganó trip_id después
--      de sql/2026-05-27). Usar: select * from information_schema.columns ...
--   2. Hacer backup (Supabase dashboard → Database → Backups).
--   3. Sustituir <DAVID_USER_ID> en la sección de migración de datos.
--   4. Ejecutar por SECCIONES en el SQL Editor, no todo de golpe.
-- Contexto completo: BAYU_V2_MASTER_PLAN.md (Fase 0).
-- ============================================================================

-- ============================================================================
-- SECCIÓN 1 · Renombrar tablas eurotrip_* → bayu_*
-- ============================================================================
alter table if exists public.eurotrip_trips         rename to bayu_trips;
alter table if exists public.eurotrip_trip_cities   rename to bayu_trip_cities;
alter table if exists public.eurotrip_activities    rename to bayu_activities;
alter table if exists public.eurotrip_expenses      rename to bayu_expenses;
alter table if exists public.eurotrip_budget        rename to bayu_budget;
alter table if exists public.eurotrip_notes         rename to bayu_notes;
alter table if exists public.eurotrip_bookmarks     rename to bayu_bookmarks;
alter table if exists public.eurotrip_reservations  rename to bayu_reservations;
alter table if exists public.eurotrip_hotel_choices rename to bayu_hotel_choices;
alter table if exists public.eurotrip_day_overrides rename to bayu_day_overrides;
alter table if exists public.eurotrip_media         rename to bayu_media;

-- ============================================================================
-- SECCIÓN 2 · Quitar hardcodeo a nivel DB (David/Paty/monedas fijas)
-- ============================================================================
-- El check constraint payer in ('David','Paty','Joint') bloquea multi-usuario:
alter table public.bayu_expenses drop constraint if exists eurotrip_expenses_payer_check;
-- Monedas: abrir a cualquier ISO-4217 (era MXN/EUR/USD fijo):
alter table public.bayu_expenses drop constraint if exists eurotrip_expenses_currency_check;
alter table public.bayu_expenses add constraint bayu_expenses_currency_check
  check (currency ~ '^[A-Z]{3}$');

-- ============================================================================
-- SECCIÓN 3 · Perfiles de usuario (1:1 con auth.users)
-- ============================================================================
create table if not exists public.bayu_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  plan_expires_at timestamptz,
  home_airport text,             -- IATA, para prellenar búsqueda de vuelos (Fase 5)
  locale text default 'es',
  created_at timestamptz default now()
);

-- Auto-crear perfil al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.bayu_profiles (id, display_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- SECCIÓN 4 · Viajes: dueño, moneda, miembros, viajeros
-- ============================================================================
alter table public.bayu_trips
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists home_currency text not null default 'MXN' check (home_currency ~ '^[A-Z]{3}$');

-- Membresía (colaboración: lo que hoy son David+Paty en el mismo viaje)
create table if not exists public.bayu_trip_members (
  trip_id uuid not null references public.bayu_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz default now(),
  primary key (trip_id, user_id)
);

-- Invitaciones pendientes (por email, se canjean al registrarse / abrir deep link)
create table if not exists public.bayu_trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.bayu_trips(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz default now()
);

-- Viajeros del viaje (reemplaza payer hardcodeado David/Paty/Joint).
-- Un viajero puede o no estar ligado a una cuenta (un niño no tiene cuenta).
create table if not exists public.bayu_trip_travelers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.bayu_trips(id) on delete cascade,
  name text not null,
  emoji text default '👤',
  user_id uuid references auth.users(id) on delete set null,
  sort_order int default 0,
  created_at timestamptz default now()
);
-- Gastos apuntan a viajero (payer text se conserva en la transición y se elimina
-- cuando el frontend ya use traveler_id; null = pagado "entre todos"):
alter table public.bayu_expenses
  add column if not exists traveler_id uuid references public.bayu_trip_travelers(id) on delete set null;

-- El dueño entra automático como member 'owner'
create or replace function public.handle_new_trip()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null then
    insert into public.bayu_trip_members (trip_id, user_id, role)
    values (new.id, new.owner_id, 'owner')
    on conflict (trip_id, user_id) do update set role = 'owner';
  end if;
  return new;
end $$;
drop trigger if exists on_trip_created on public.bayu_trips;
create trigger on_trip_created
  after insert on public.bayu_trips
  for each row execute function public.handle_new_trip();

-- ============================================================================
-- SECCIÓN 5 · Geocoding por ciudad (de-hardcodeo de WX_COORDS, Fase 1)
-- ============================================================================
alter table public.bayu_trip_cities
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists country_code text;   -- ISO-3166-1 alpha-2

-- ============================================================================
-- SECCIÓN 6 · Tablas nuevas v2
-- ============================================================================
-- Historial de chat persistente, aislado por (user, trip) — nunca se cruza
create table if not exists public.bayu_chat_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.bayu_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
create index if not exists bayu_chat_trip_user_idx
  on public.bayu_chat_messages (trip_id, user_id, created_at);

-- Empaque por viaje (sale de localStorage; sobrevive dispositivos)
create table if not exists public.bayu_packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.bayu_trips(id) on delete cascade,
  title text not null,
  checked boolean not null default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Quota de IA por usuario/mes (Fase 0/4 — checar ANTES de llamar a Claude)
create table if not exists public.bayu_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  period char(7) not null,           -- 'YYYY-MM'
  chat_messages int not null default 0,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  primary key (user_id, period)
);

-- Caché GLOBAL de guías de ciudad (Fase 3) — compartida entre todos los usuarios
create table if not exists public.bayu_city_guides (
  id uuid primary key default gen_random_uuid(),
  city_norm text not null,           -- lower(unaccent(nombre)), ej. 'kioto'
  country_code text,
  lang text not null default 'es',
  lat double precision,
  lng double precision,
  content jsonb,                     -- {intro, top_sights[], food[], tips[], emergency{}, phrases[]...}
  videos jsonb,                      -- [{videoId, title, channel}]
  photos jsonb,                      -- [urls]
  generated_at timestamptz default now(),
  unique (city_norm, lang)
);

-- Tracking de clicks de afiliado (Fase 5)
create table if not exists public.bayu_affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  trip_id uuid references public.bayu_trips(id) on delete set null,
  kind text not null check (kind in ('flight', 'hotel', 'tour')),
  network text not null,             -- 'travelpayouts' | 'getyourguide' | 'booking'...
  target text,                       -- ej. 'MTY-MAD 2026-10-15' o nombre del hotel
  url text,
  created_at timestamptz default now()
);

-- ============================================================================
-- SECCIÓN 7 · RLS REAL — membership-based en TODO
-- ============================================================================
-- Helper: ¿el usuario actual es miembro del viaje? (security definer para no
-- recursar las policies de trip_members)
create or replace function public.is_trip_member(p_trip uuid, p_min_role text default 'viewer')
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.bayu_trip_members m
    where m.trip_id = p_trip and m.user_id = auth.uid()
      and case p_min_role
            when 'owner'  then m.role = 'owner'
            when 'editor' then m.role in ('owner', 'editor')
            else true
          end
  );
$$;

-- ---- profiles: cada quien el suyo (lectura de display_name de co-miembros ok)
alter table public.bayu_profiles enable row level security;
drop policy if exists "profiles self" on public.bayu_profiles;
create policy "profiles self" on public.bayu_profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles co-members read" on public.bayu_profiles;
create policy "profiles co-members read" on public.bayu_profiles
  for select to authenticated using (
    exists (select 1 from public.bayu_trip_members a
            join public.bayu_trip_members b on a.trip_id = b.trip_id
            where a.user_id = auth.uid() and b.user_id = bayu_profiles.id)
  );

-- ---- trips
alter table public.bayu_trips enable row level security;
drop policy if exists "eurotrip_trips public read" on public.bayu_trips;   -- limpia v1 si existía
drop policy if exists "trips member read" on public.bayu_trips;
create policy "trips member read" on public.bayu_trips
  for select to authenticated using (public.is_trip_member(id));
drop policy if exists "trips owner insert" on public.bayu_trips;
create policy "trips owner insert" on public.bayu_trips
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "trips editor update" on public.bayu_trips;
create policy "trips editor update" on public.bayu_trips
  for update to authenticated using (public.is_trip_member(id, 'editor'));
drop policy if exists "trips owner delete" on public.bayu_trips;
create policy "trips owner delete" on public.bayu_trips
  for delete to authenticated using (public.is_trip_member(id, 'owner'));

-- ---- trip_members: miembros se ven entre sí; solo owner administra
alter table public.bayu_trip_members enable row level security;
drop policy if exists "members read" on public.bayu_trip_members;
create policy "members read" on public.bayu_trip_members
  for select to authenticated using (public.is_trip_member(trip_id));
drop policy if exists "members owner manage" on public.bayu_trip_members;
create policy "members owner manage" on public.bayu_trip_members
  for all to authenticated
  using (public.is_trip_member(trip_id, 'owner'))
  with check (public.is_trip_member(trip_id, 'owner'));

-- ---- Tablas hijas con trip_id: misma plantilla (lee member, escribe editor+).
-- Generador: aplica a todas de un jalón.
do $$
declare t text;
begin
  foreach t in array array[
    'bayu_trip_cities','bayu_activities','bayu_expenses','bayu_budget',
    'bayu_notes','bayu_bookmarks','bayu_reservations','bayu_hotel_choices',
    'bayu_day_overrides','bayu_media','bayu_trip_travelers',
    'bayu_packing_items','bayu_chat_messages','bayu_trip_invites'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- limpia policies v1 "public read"/"service write" (los nombres viejos
    -- llevaban prefijo eurotrip_; pueden no existir tras el rename — ignorar errores a mano)
    execute format('drop policy if exists "member read" on public.%I', t);
    execute format('create policy "member read" on public.%I for select to authenticated using (public.is_trip_member(trip_id))', t);
    execute format('drop policy if exists "editor write" on public.%I', t);
    execute format('create policy "editor write" on public.%I for all to authenticated using (public.is_trip_member(trip_id, ''editor'')) with check (public.is_trip_member(trip_id, ''editor''))', t);
  end loop;
end $$;

-- chat_messages además: cada quien SOLO su propio hilo dentro del viaje
drop policy if exists "member read" on public.bayu_chat_messages;
create policy "own chat read" on public.bayu_chat_messages
  for select to authenticated using (user_id = auth.uid() and public.is_trip_member(trip_id));
drop policy if exists "editor write" on public.bayu_chat_messages;
create policy "own chat write" on public.bayu_chat_messages
  for insert to authenticated with check (user_id = auth.uid() and public.is_trip_member(trip_id));

-- ai_usage: el usuario lee la suya; solo service_role escribe
alter table public.bayu_ai_usage enable row level security;
drop policy if exists "own usage read" on public.bayu_ai_usage;
create policy "own usage read" on public.bayu_ai_usage
  for select to authenticated using (user_id = auth.uid());

-- city_guides: lectura para todos los autenticados; escribe solo service_role
alter table public.bayu_city_guides enable row level security;
drop policy if exists "guides read" on public.bayu_city_guides;
create policy "guides read" on public.bayu_city_guides
  for select to authenticated using (true);

-- affiliate_clicks: insert propio, lectura solo service_role (dashboard)
alter table public.bayu_affiliate_clicks enable row level security;
drop policy if exists "own click insert" on public.bayu_affiliate_clicks;
create policy "own click insert" on public.bayu_affiliate_clicks
  for insert to authenticated with check (user_id = auth.uid());

-- ⚠️ IMPORTANTE: revocar los grants v1 de lectura pública
revoke select on all tables in schema public from anon;
grant select on table public.bayu_city_guides to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- (RLS limita lo efectivo; el grant solo habilita el canal)

-- ============================================================================
-- SECCIÓN 8 · Migración de datos existentes (EDITAR ANTES DE CORRER)
-- ============================================================================
-- 1. Crear la cuenta de David por Supabase Auth (dashboard o app) y pegar su id:
-- do $$
-- declare david uuid := '<DAVID_USER_ID>';
-- begin
--   update public.bayu_trips set owner_id = david where owner_id is null;
--   insert into public.bayu_trip_members (trip_id, user_id, role)
--     select id, david, 'owner' from public.bayu_trips
--     on conflict do nothing;
--   -- viajeros del Eurotrip a partir de los payers históricos:
--   insert into public.bayu_trip_travelers (trip_id, name, emoji, user_id)
--     select distinct trip_id, payer, '👤', case when payer = 'David' then david end
--     from public.bayu_expenses where payer in ('David', 'Paty');
--   -- ligar gastos a viajeros ('Joint' queda traveler_id = null = entre todos):
--   update public.bayu_expenses e
--     set traveler_id = t.id
--     from public.bayu_trip_travelers t
--     where t.trip_id = e.trip_id and t.name = e.payer;
-- end $$;

-- 2. Storage: crear bucket privado 'user-media' con policies por dueño
--    (path: <user_id>/<trip_id>/...) y migrar archivos del bucket 'eurotrip'.

notify pgrst, 'reload schema';
