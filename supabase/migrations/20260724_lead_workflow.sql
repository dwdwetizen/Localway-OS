-- LocalWay OS: fluxo de Prospecção, Follow-up e CRM.
-- Execute este arquivo uma vez no SQL Editor do MESMO projeto Supabase já usado pelo app antigo.

create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  category text,
  address text,
  city text,
  decision_maker_name text,
  receptionist_name text,
  phone text,
  whatsapp text,
  email text,
  notes text,
  google_place_id text,
  google_maps_url text,
  website_url text,
  rating numeric,
  review_count integer,
  photo_count integer,
  has_website boolean,
  health_score integer,
  opportunity text,
  source text not null default 'manual' check (source in ('presencial', 'google_places', 'manual')),
  status text not null default 'novo' check (status in ('novo', 'ligar_depois', 'retornar_depois', 'reuniao_marcada', 'qualificado', 'sem_interesse', 'perdido')),
  next_action_at timestamptz,
  last_contact_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_next_action_at_idx on public.leads(next_action_at);
create index if not exists leads_status_idx on public.leads(status);
create unique index if not exists leads_google_place_id_key on public.leads (google_place_id) where google_place_id is not null;

create table if not exists public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  outcome text not null,
  notes text,
  occurred_at timestamptz not null default now(),
  next_action_at timestamptz,
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists lead_interactions_lead_id_idx on public.lead_interactions(lead_id);

alter table public.leads enable row level security;
alter table public.lead_interactions enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
grant select, insert, update, delete on public.lead_interactions to authenticated;

drop policy if exists "registered team members manage leads" on public.leads;
create policy "registered team members manage leads" on public.leads
  for all to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid())))
  with check (exists (select 1 from public.profiles where id = (select auth.uid())));

drop policy if exists "registered team members manage interactions" on public.lead_interactions;
create policy "registered team members manage interactions" on public.lead_interactions
  for all to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid())))
  with check (exists (select 1 from public.profiles where id = (select auth.uid())));
