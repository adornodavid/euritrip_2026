-- ============================================================================
-- BAYU v2 · FASE 0 · Auth real + RLS por membresía (reconciliada con Fase 1)
-- Aplicada el 2026-06-11 vía MCP. Reemplaza al draft v2-draft-2026-06-11.
-- Estrategia zero-downtime: rename + VIEWS de compatibilidad eurotrip_* (solo
-- service_role) hasta que el código nuevo (prefijo bayu_) esté en producción.
-- DB COMPARTIDA con Stream Match y Healthy Lab: cero triggers en auth.users.
-- ============================================================================

-- SECCIÓN 1 · Archivar tablas de BAYU v1 (datos de prueba, ya exportados a backups/)
alter table if exists public.bayu_trips           rename to v1_bayu_trips;
alter table if exists public.bayu_trip_days       rename to v1_bayu_trip_days;
alter table if exists public.bayu_activities      rename to v1_bayu_activities;
alter table if exists public.bayu_expenses        rename to v1_bayu_expenses;
alter table if exists public.bayu_flights         rename to v1_bayu_flights;
alter table if exists public.bayu_hotels          rename to v1_bayu_hotels;
alter table if exists public.bayu_chat_messages   rename to v1_bayu_chat_messages;
alter table if exists public.bayu_checklists      rename to v1_bayu_checklists;
alter table if exists public.bayu_checklist_items rename to v1_bayu_checklist_items;
alter table if exists public.bayu_documents       rename to v1_bayu_documents;

-- SECCIÓN 2 · Renombrar eurotrip_* → bayu_* (14 tablas)
alter table public.eurotrip_trips          rename to bayu_trips;
alter table public.eurotrip_trip_cities    rename to bayu_trip_cities;
alter table public.eurotrip_trip_travelers rename to bayu_trip_travelers;
alter table public.eurotrip_activities     rename to bayu_activities;
alter table public.eurotrip_expenses       rename to bayu_expenses;
alter table public.eurotrip_budget         rename to bayu_budget;
alter table public.eurotrip_hotel_choices  rename to bayu_hotel_choices;
alter table public.eurotrip_day_overrides  rename to bayu_day_overrides;
alter table public.eurotrip_notes          rename to bayu_notes;
alter table public.eurotrip_bookmarks      rename to bayu_bookmarks;
alter table public.eurotrip_reservations   rename to bayu_reservations;
alter table public.eurotrip_packing_items  rename to bayu_packing_items;
alter table public.eurotrip_chat_messages  rename to bayu_chat_messages;
alter table public.eurotrip_media          rename to bayu_media;

-- SECCIÓN 3 · Vistas de compatibilidad (TRANSITORIAS — borrar tras deploy v2)
-- security_invoker + grants SOLO a service_role: el API viejo sigue funcionando
-- y el acceso público anónimo queda CERRADO desde ya.
do $$
declare t text;
begin
  foreach t in array array['trips','trip_cities','trip_travelers','activities','expenses','budget','hotel_choices','day_overrides','notes','bookmarks','reservations','packing_items','chat_messages','media']
  loop
    execute format('create view public.eurotrip_%I with (security_invoker=true) as select * from public.bayu_%I', t, t);
    execute format('revoke all on public.eurotrip_%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.eurotrip_%I to service_role', t);
  end loop;
end $$;

-- SECCIÓN 4 · Quitar hardcodeo a nivel DB
alter table public.bayu_expenses drop constraint if exists eurotrip_expenses_payer_check;
alter table public.bayu_expenses drop constraint if exists eurotrip_expenses_currency_check;
alter table public.bayu_expenses add constraint bayu_expenses_currency_check
  check (currency ~ '^[A-Z]{3}$');

-- SECCIÓN 5 · Identidad: perfiles, membresías, quotas IA
create table if not exists public.bayu_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free','pro')),
  created_at timestamptz not null default now()
);

alter table public.bayu_trips add column if not exists owner_id uuid references auth.users(id);

create table if not exists public.bayu_trip_members (
  trip_id uuid not null references public.bayu_trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.bayu_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,           -- 'YYYY-MM'
  msgs int not null default 0,
  primary key (user_id, month)
);

-- Al crear un viaje, el owner queda como member automáticamente
create or replace function public.bayu_trip_owner_membership() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null then
    insert into public.bayu_trip_members (trip_id, user_id, role)
    values (new.id, new.owner_id, 'owner') on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists bayu_trips_owner_membership on public.bayu_trips;
create trigger bayu_trips_owner_membership after insert on public.bayu_trips
  for each row execute function public.bayu_trip_owner_membership();

-- SECCIÓN 6 · Helpers RLS (security definer evita recursión en policies)
create or replace function public.bayu_can_read(t uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from bayu_trip_members where trip_id = t and user_id = auth.uid()
  ) or exists (
    select 1 from bayu_trips where id = t and owner_id = auth.uid()
  );
$$;

create or replace function public.bayu_can_edit(t uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from bayu_trip_members where trip_id = t and user_id = auth.uid() and role in ('owner','editor')
  ) or exists (
    select 1 from bayu_trips where id = t and owner_id = auth.uid()
  );
$$;

create or replace function public.bayu_is_owner(t uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from bayu_trips where id = t and owner_id = auth.uid())
      or exists (select 1 from bayu_trip_members where trip_id = t and user_id = auth.uid() and role = 'owner');
$$;

-- SECCIÓN 7 · RLS por membresía (cierra el acceso público de Fase ≤1)
do $$
declare t text;
begin
  -- Tablas de datos por-viaje: leer = member; escribir = editor/owner
  foreach t in array array['trip_cities','trip_travelers','activities','expenses','budget','hotel_choices','day_overrides','notes','bookmarks','reservations','packing_items','chat_messages','media']
  loop
    execute format('drop policy if exists public_read_eurotrip_%I on public.bayu_%I', t, t);
    execute format('alter table public.bayu_%I enable row level security', t);
    execute format('drop policy if exists bayu_member_read_%I on public.bayu_%I', t, t);
    execute format('create policy bayu_member_read_%I on public.bayu_%I for select to authenticated using (public.bayu_can_read(trip_id))', t, t);
    execute format('drop policy if exists bayu_editor_write_%I on public.bayu_%I', t, t);
    execute format('create policy bayu_editor_write_%I on public.bayu_%I for all to authenticated using (public.bayu_can_edit(trip_id)) with check (public.bayu_can_edit(trip_id))', t, t);
    execute format('revoke all on public.bayu_%I from anon', t);
    execute format('grant select, insert, update, delete on public.bayu_%I to authenticated', t);
  end loop;
end $$;

-- trips: leer = owner o member; crear = dueño de sí mismo; editar = editor+; borrar = owner
drop policy if exists public_read_eurotrip_trips on public.bayu_trips;
alter table public.bayu_trips enable row level security;
drop policy if exists bayu_trips_read on public.bayu_trips;
create policy bayu_trips_read on public.bayu_trips for select to authenticated
  using (owner_id = auth.uid() or public.bayu_can_read(id));
drop policy if exists bayu_trips_insert on public.bayu_trips;
create policy bayu_trips_insert on public.bayu_trips for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists bayu_trips_update on public.bayu_trips;
create policy bayu_trips_update on public.bayu_trips for update to authenticated
  using (public.bayu_can_edit(id)) with check (public.bayu_can_edit(id));
drop policy if exists bayu_trips_delete on public.bayu_trips;
create policy bayu_trips_delete on public.bayu_trips for delete to authenticated
  using (public.bayu_is_owner(id));
revoke all on public.bayu_trips from anon;
grant select, insert, update, delete on public.bayu_trips to authenticated;

-- members: ver los de tus viajes; administrar = owner del viaje
alter table public.bayu_trip_members enable row level security;
drop policy if exists bayu_members_read on public.bayu_trip_members;
create policy bayu_members_read on public.bayu_trip_members for select to authenticated
  using (user_id = auth.uid() or public.bayu_can_read(trip_id));
drop policy if exists bayu_members_admin on public.bayu_trip_members;
create policy bayu_members_admin on public.bayu_trip_members for all to authenticated
  using (public.bayu_is_owner(trip_id)) with check (public.bayu_is_owner(trip_id));
grant select, insert, update, delete on public.bayu_trip_members to authenticated;

-- profiles: tu propio perfil completo; lookup por email para invitar (solo authenticated)
alter table public.bayu_profiles enable row level security;
drop policy if exists bayu_profiles_read on public.bayu_profiles;
create policy bayu_profiles_read on public.bayu_profiles for select to authenticated using (true);
drop policy if exists bayu_profiles_self on public.bayu_profiles;
create policy bayu_profiles_self on public.bayu_profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
grant select, insert, update on public.bayu_profiles to authenticated;

-- ai_usage: solo lectura del propio; escrituras vía service_role (API)
alter table public.bayu_ai_usage enable row level security;
drop policy if exists bayu_ai_usage_read on public.bayu_ai_usage;
create policy bayu_ai_usage_read on public.bayu_ai_usage for select to authenticated
  using (user_id = auth.uid());
grant select on public.bayu_ai_usage to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- POST-DEPLOY (ejecutar cuando el código v2 esté en producción y verificado):
--   1. drop view public.eurotrip_<cada una>;
--   2. Ownership: update bayu_trips set owner_id = (select id from auth.users where email='<email-david>');
--      insert into bayu_trip_members (trip_id,user_id,role) ... Paty como editor del Eurotrip.
--   3. (opcional, semanas después) drop table v1_bayu_*;
-- ============================================================================

-- FIX post-aplicación: policies públicas viejas con nombres no estandarizados
-- (de migraciones v7/v8) que sobrevivieron al rename — eliminadas.
-- activities_select_public/write_service · eurotrip_budget public read/service write
-- · eurotrip_expenses public read/service write · media_select_public/write_service
-- · tc_select_public/tc_write_service
