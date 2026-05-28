-- Eurotrip 2026 · Migration · Expenses + Budget tracking
-- Ejecutar en Supabase SQL Editor del proyecto qflyzgbsufvwrfkrrpfo

-- =============================================================================
-- TABLA: eurotrip_budget
-- Presupuesto proyectado por categoria (rango min/max en MXN)
-- =============================================================================
create table if not exists public.eurotrip_budget (
  category text primary key,
  label text not null,
  emoji text,
  projected_min_mxn numeric(10, 2) not null default 0,
  projected_max_mxn numeric(10, 2) not null default 0,
  sort_order int default 0,
  notes text,
  updated_at timestamptz default now()
);

alter table public.eurotrip_budget enable row level security;

drop policy if exists "eurotrip_budget public read" on public.eurotrip_budget;
create policy "eurotrip_budget public read" on public.eurotrip_budget
  for select to anon, authenticated using (true);

drop policy if exists "eurotrip_budget service write" on public.eurotrip_budget;
create policy "eurotrip_budget service write" on public.eurotrip_budget
  for all to service_role using (true) with check (true);

grant select on table public.eurotrip_budget to anon, authenticated;
grant all on table public.eurotrip_budget to service_role;

-- =============================================================================
-- TABLA: eurotrip_expenses
-- Gastos reales del viaje (David + Paty)
-- Convencion: amount_mxn es la fuente de verdad para sumas.
--             amount_original + currency + fx_rate se guardan por trazabilidad.
-- =============================================================================
create table if not exists public.eurotrip_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null references public.eurotrip_budget(category) on update cascade,
  description text not null,
  amount_mxn numeric(10, 2) not null check (amount_mxn >= 0),
  amount_original numeric(10, 2),
  currency text default 'MXN' check (currency in ('MXN', 'EUR', 'USD')),
  fx_rate numeric(10, 4),
  payer text not null default 'Joint' check (payer in ('David', 'Paty', 'Joint')),
  expense_date date,
  city text,
  notes text,
  receipt_url text,
  created_by text default 'manual',
  created_at timestamptz default now()
);

create index if not exists eurotrip_expenses_category_idx on public.eurotrip_expenses(category);
create index if not exists eurotrip_expenses_date_idx on public.eurotrip_expenses(expense_date);
create index if not exists eurotrip_expenses_payer_idx on public.eurotrip_expenses(payer);

alter table public.eurotrip_expenses enable row level security;

drop policy if exists "eurotrip_expenses public read" on public.eurotrip_expenses;
create policy "eurotrip_expenses public read" on public.eurotrip_expenses
  for select to anon, authenticated using (true);

drop policy if exists "eurotrip_expenses service write" on public.eurotrip_expenses;
create policy "eurotrip_expenses service write" on public.eurotrip_expenses
  for all to service_role using (true) with check (true);

grant select on table public.eurotrip_expenses to anon, authenticated;
grant all on table public.eurotrip_expenses to service_role;

-- =============================================================================
-- SEED: presupuesto default basado en $145K economico / $156K premium del viaje
-- Vuelos transatlanticos ($30K MXN pareja AM44 + AM35) entran como gasto YA pagado.
-- Los rangos suman ~$145K-156K MXN para los 15 dias en Europa.
-- =============================================================================
insert into public.eurotrip_budget (category, label, emoji, projected_min_mxn, projected_max_mxn, sort_order, notes) values
  ('flights',     'Vuelos transatlanticos', '✈️',  30000, 30000,  1, 'AM44 MTY-CDG + AM35 MAD-MTY · ya pagados $30K pareja'),
  ('hotels',      'Hoteles (15 noches)',    '🏨',  48000, 56000,  2, 'Paris 4N + Bordeaux 2N + Toulouse 1N + BCN 3N + Valencia 1N + Madrid 4N'),
  ('trains',      'Trenes entre ciudades',  '🚄',  10000, 14000,  3, 'Paris-Bordeaux, Bordeaux-Toulouse, Toulouse-BCN, BCN-Valencia, Valencia-Madrid (€470-660 pareja)'),
  ('food',        'Comidas y restaurantes', '🍽️',  20000, 24000,  4, '~€60-80/dia pareja en bistros, tapas, mercados'),
  ('attractions', 'Museos y atracciones',   '🎟️',   7000,  9000,  5, 'Louvre, Sagrada Familia, day trips, Cite du Vin, Versalles'),
  ('transport',   'Transporte local',       '🚇',   4500,  6000,  6, 'Metro, taxi, Uber, traslados aeropuerto'),
  ('shopping',    'Compras y regalos',      '🛍️',   8000, 10000,  7, 'Vinos, perfumes, ropa, suvenires'),
  ('misc',        'Varios y contingencia',  '💰',   3500,  5000,  8, 'eSIM Holafly €80, propinas, imprevistos')
on conflict (category) do update set
  label = excluded.label,
  emoji = excluded.emoji,
  projected_min_mxn = excluded.projected_min_mxn,
  projected_max_mxn = excluded.projected_max_mxn,
  sort_order = excluded.sort_order,
  notes = excluded.notes,
  updated_at = now();

-- =============================================================================
-- Verificacion post-migration
-- =============================================================================
-- select category, label, projected_min_mxn, projected_max_mxn from public.eurotrip_budget order by sort_order;
-- select sum(projected_min_mxn) as total_min, sum(projected_max_mxn) as total_max from public.eurotrip_budget;
-- Esperado: total_min ~131K, total_max ~154K (sin vuelos ya pagados son 101-124K + 30K vuelos = 131-154K)

-- NOTIFY pgrst para refrescar el schema cache de PostgREST
notify pgrst, 'reload schema';
