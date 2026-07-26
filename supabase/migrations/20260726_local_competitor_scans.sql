-- Real Google Places competitor comparisons for the Local Radar module.

create table if not exists public.local_competitor_scans (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  radius_m integer not null check (radius_m in (1000, 3000, 5000)),
  category text not null check (char_length(category) between 2 and 120),
  center_latitude double precision not null check (center_latitude between -90 and 90),
  center_longitude double precision not null check (center_longitude between -180 and 180),
  target jsonb not null default '{}'::jsonb,
  competitors jsonb not null default '[]'::jsonb,
  source text not null default 'google_places',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists local_competitor_scans_lead_created_idx
  on public.local_competitor_scans(lead_id, created_at desc);
create index if not exists local_competitor_scans_created_by_idx
  on public.local_competitor_scans(created_by, created_at desc);

alter table public.local_competitor_scans enable row level security;

grant select, insert on public.local_competitor_scans to authenticated;
revoke update, delete on public.local_competitor_scans from authenticated;

drop policy if exists "users read authorized competitor scans" on public.local_competitor_scans;
create policy "users read authorized competitor scans"
on public.local_competitor_scans for select
to authenticated
using ((select auth.uid()) = created_by or public.is_admin());

drop policy if exists "authorized users create competitor scans" on public.local_competitor_scans;
create policy "authorized users create competitor scans"
on public.local_competitor_scans for insert
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
        or permissions && array['Raio-X', 'raiox']::text[]
      )
  )
);

-- Analysis-only users also need to own the profile they are comparing.
create or replace function public.has_commercial_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array[
          'Prospecção', 'Follow-up', 'CRM', 'Análises', 'Mapa', 'Raio-X',
          'prospeccao', 'followup', 'crm', 'analises', 'mapa', 'raiox'
        ]::text[]
      )
  );
$$;

revoke all on function public.has_commercial_access() from public, anon;
grant execute on function public.has_commercial_access() to authenticated;
