-- Google Places analysis snapshots and geographic lead data.

alter table public.leads
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists analysis_data jsonb not null default '{}'::jsonb,
  add column if not exists analysed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_latitude_check'
  ) then
    alter table public.leads
      add constraint leads_latitude_check
      check (latitude is null or latitude between -90 and 90);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'leads_longitude_check'
  ) then
    alter table public.leads
      add constraint leads_longitude_check
      check (longitude is null or longitude between -180 and 180);
  end if;
end $$;

create index if not exists leads_coordinates_idx
  on public.leads(latitude, longitude)
  where latitude is not null and longitude is not null;

create table if not exists public.lead_analyses (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  summary text not null,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  recommendations jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  source text not null default 'google_places',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists lead_analyses_lead_created_idx
  on public.lead_analyses(lead_id, created_at desc);
create index if not exists lead_analyses_created_by_idx
  on public.lead_analyses(created_by, created_at desc);

alter table public.lead_analyses enable row level security;
grant select, insert on public.lead_analyses to authenticated;

drop policy if exists "authorized users read lead analyses" on public.lead_analyses;
create policy "authorized users read lead analyses"
on public.lead_analyses for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_active = true
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array['Análises', 'analises', 'Prospecção', 'prospeccao']::text[]
      )
  )
);

drop policy if exists "authorized users create lead analyses" on public.lead_analyses;
create policy "authorized users create lead analyses"
on public.lead_analyses for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_active = true
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array['Análises', 'analises']::text[]
      )
  )
);

-- Photos are uploaded by an administrator, so ownership belongs to the uploader.
-- Authorize the employee by the first folder segment, which is always their user id.
drop policy if exists "users see authorized profile photos" on storage.objects;
create policy "users see authorized profile photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = (select auth.uid())::text
  )
);
