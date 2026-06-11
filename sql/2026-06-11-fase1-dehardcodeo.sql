-- Fase 1 · De-hardcodeo total (BAYU_V2_MASTER_PLAN §Fase 1)
-- Columnas por-viaje + tablas trip_travelers / packing_items / chat_messages
-- + seeds del Eurotrip (los datos específicos del viaje viven en DB, no en código)

-- 1) trips: moneda base del viaje + link a guía editorial (solo el Eurotrip la tiene)
alter table public.eurotrip_trips add column if not exists home_currency text not null default 'MXN';
alter table public.eurotrip_trips add column if not exists guide_url text;
update public.eurotrip_trips set guide_url = '/guia' where id = 'e0000000-0000-4000-8000-000000000001';

-- 2) trip_cities: coordenadas + país (geocoding Open-Meteo al guardar; backfill del Eurotrip aquí)
alter table public.eurotrip_trip_cities add column if not exists lat double precision;
alter table public.eurotrip_trip_cities add column if not exists lng double precision;
alter table public.eurotrip_trip_cities add column if not exists country_code text;

update public.eurotrip_trip_cities set lat=48.857,  lng=2.352,  country_code='FR' where trip_id='e0000000-0000-4000-8000-000000000001' and name='Paris';
update public.eurotrip_trip_cities set lat=44.838,  lng=-0.579, country_code='FR' where trip_id='e0000000-0000-4000-8000-000000000001' and name='Bordeaux';
update public.eurotrip_trip_cities set lat=43.318,  lng=-1.981, country_code='ES' where trip_id='e0000000-0000-4000-8000-000000000001' and name='San Sebastián';
update public.eurotrip_trip_cities set lat=43.364,  lng=-1.792, country_code='ES' where trip_id='e0000000-0000-4000-8000-000000000001' and name='Hondarribia';
update public.eurotrip_trip_cities set lat=43.263,  lng=-2.935, country_code='ES' where trip_id='e0000000-0000-4000-8000-000000000001' and name='Bilbao';
update public.eurotrip_trip_cities set lat=42.555,  lng=-2.585, country_code='ES' where trip_id='e0000000-0000-4000-8000-000000000001' and name='La guardia';
update public.eurotrip_trip_cities set lat=40.417,  lng=-3.703, country_code='ES' where trip_id='e0000000-0000-4000-8000-000000000001' and name='Madrid';

-- 3) Viajeros por viaje (pagadores dinámicos de gastos)
create table if not exists public.eurotrip_trip_travelers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.eurotrip_trips(id) on delete cascade,
  name text not null,
  emoji text,
  sort_order int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  unique (trip_id, name)
);

-- 4) Empaque por viaje (antes vivía en localStorage = se perdía entre dispositivos)
create table if not exists public.eurotrip_packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.eurotrip_trips(id) on delete cascade,
  title text not null,
  checked boolean not null default false,
  sort_order int not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

-- 5) Historial de chat de Claudia por viaje (sobrevive reinstalaciones, no se cruza entre viajes)
create table if not exists public.eurotrip_chat_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.eurotrip_trips(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists eurotrip_chat_messages_trip_idx on public.eurotrip_chat_messages (trip_id, created_at);

-- RLS (mismo patrón que el resto: SELECT pública, escrituras solo via service_role)
alter table public.eurotrip_trip_travelers enable row level security;
alter table public.eurotrip_packing_items enable row level security;
alter table public.eurotrip_chat_messages enable row level security;
drop policy if exists public_read_eurotrip_trip_travelers on public.eurotrip_trip_travelers;
create policy public_read_eurotrip_trip_travelers on public.eurotrip_trip_travelers for select to anon, authenticated using (true);
drop policy if exists public_read_eurotrip_packing_items on public.eurotrip_packing_items;
create policy public_read_eurotrip_packing_items on public.eurotrip_packing_items for select to anon, authenticated using (true);
drop policy if exists public_read_eurotrip_chat_messages on public.eurotrip_chat_messages;
create policy public_read_eurotrip_chat_messages on public.eurotrip_chat_messages for select to anon, authenticated using (true);

-- GRANTs explícitos (tablas creadas via SQL no heredan grants — lección 2026-05)
grant all on table public.eurotrip_trip_travelers to anon, authenticated, service_role;
grant all on table public.eurotrip_packing_items to anon, authenticated, service_role;
grant all on table public.eurotrip_chat_messages to anon, authenticated, service_role;

-- 6) Seeds del Eurotrip (datos del viaje → DB, fuera del código)
insert into public.eurotrip_trip_travelers (trip_id, name, emoji, sort_order, created_by) values
  ('e0000000-0000-4000-8000-000000000001', 'David', '👤', 1, 'migracion-fase1'),
  ('e0000000-0000-4000-8000-000000000001', 'Paty',  '👤', 2, 'migracion-fase1')
on conflict (trip_id, name) do nothing;

-- Conocimiento útil que vivía hardcodeado en el prompt de Claudia → notas del viaje
insert into public.eurotrip_notes (trip_id, text, category, created_by)
select 'e0000000-0000-4000-8000-000000000001', t.text, 'general', 'migracion-fase1'
from (values
  ('Logística del viaje: 3 maletas total entre los dos. Sin visa Schengen (mexicanos <90 días); ETIAS posible Q4 2026. eSIM Holafly ~€80. Tax-free DIVA en Barajas antes de volar el 31. Pasaporte con 6+ meses de vigencia.'),
  ('Restaurantes de referencia — Paris: Bistrot Paul Bert, Bouillon Chartier, Café de Flore, L''As du Fallafel · Bordeaux: La Tupina, Le Petit Commerce, Garopapilles · San Sebastián pintxos: La Cuchara de San Telmo, Gandarias, Bar Néstor, Borda Berri; alta cocina: Arzak, Mugaritz, Akelarre · Bilbao: Mercado de la Ribera, Café Iruña, La Viña del Ensanche; alta cocina: Azurmendi, Nerua · Madrid: Casa Botín, Casa Lucio, La Bola, Mercado de San Miguel.'),
  ('Traslados típicos: Paris→Bordeaux TGV ~2h · Bordeaux→San Sebastián tren a Hendaya + Euskotren o bus ~3-4h · San Sebastián→Bilbao bus ~1h15 · Bilbao→Madrid Renfe ~4.5h o vuelo. Contexto: Hondarribia = pueblo fronterizo vasco (day trip desde SS). La Guardia/Laguardia = pueblo medieval de Rioja Alavesa (vino, bodegas) entre Bilbao y Madrid.')
) as t(text)
where not exists (select 1 from public.eurotrip_notes where created_by='migracion-fase1');

-- PostgREST: recargar schema para que las tablas nuevas existan en la API
notify pgrst, 'reload schema';
