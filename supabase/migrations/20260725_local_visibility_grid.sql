-- Estimated local visibility grids generated with Google Places Text Search.

create table if not exists public.local_visibility_scans (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  keyword text not null check (char_length(keyword) between 2 and 120),
  grid_size integer not null default 5 check (grid_size in (3, 5, 7)),
  radius_m integer not null default 2000 check (radius_m between 250 and 10000),
  center_latitude double precision not null check (center_latitude between -90 and 90),
  center_longitude double precision not null check (center_longitude between -180 and 180),
  visibility_percentage numeric(5,2) not null default 0 check (visibility_percentage between 0 and 100),
  average_position numeric(5,2),
  best_position integer check (best_position between 1 and 20),
  points jsonb not null default '[]'::jsonb,
  source text not null default 'google_places_estimate',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists local_visibility_scans_lead_created_idx
  on public.local_visibility_scans(lead_id, created_at desc);
create index if not exists local_visibility_scans_created_by_idx
  on public.local_visibility_scans(created_by, created_at desc);

alter table public.local_visibility_scans enable row level security;

grant select, insert on public.local_visibility_scans to authenticated;
revoke update, delete on public.local_visibility_scans from authenticated;

drop policy if exists "users read authorized visibility scans" on public.local_visibility_scans;
create policy "users read authorized visibility scans"
on public.local_visibility_scans for select
to authenticated
using ((select auth.uid()) = created_by or public.is_admin());

drop policy if exists "authorized users create visibility scans" on public.local_visibility_scans;
create policy "authorized users create visibility scans"
on public.local_visibility_scans for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_active = true
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array['Mapa', 'mapa']::text[]
      )
  )
);
