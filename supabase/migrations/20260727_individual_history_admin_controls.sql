-- Individual commercial history, primary-admin controls and weekly contract goals.

alter table public.user_goals
  add column if not exists target_contracts integer not null default 0;

alter table public.user_goals
  drop constraint if exists user_goals_target_contracts_check;

alter table public.user_goals
  add constraint user_goals_target_contracts_check
  check (target_contracts >= 0);

alter table public.leads
  add column if not exists crm_closed_at timestamptz;

update public.leads
set crm_closed_at = coalesce(crm_closed_at, updated_at)
where crm_stage = 'fechado'
  and crm_closed_at is null;

create or replace function public.track_crm_closed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.crm_stage = 'fechado' and old.crm_stage is distinct from 'fechado' then
    new.crm_closed_at = now();
  elsif new.crm_stage is distinct from 'fechado' then
    new.crm_closed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists track_crm_closed_at on public.leads;
create trigger track_crm_closed_at
before update of crm_stage on public.leads
for each row execute function public.track_crm_closed_at();

create or replace function public.is_primary_admin()
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
      and lower(coalesce(role, '')) in ('admin', 'administrador')
      and lower(coalesce(username, '')) = 'localway01'
  );
$$;

revoke all on function public.is_primary_admin() from public, anon;
grant execute on function public.is_primary_admin() to authenticated;

create or replace function public.is_crm_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_primary_admin();
$$;

revoke all on function public.is_crm_manager() from public, anon;
grant execute on function public.is_crm_manager() to authenticated;

-- CRM management belongs exclusively to LocalWay01. Collaborators keep CRM
-- page access so they can follow the opportunities they created.
update public.profiles
set permissions = array(
  select distinct permission
  from unnest(
    coalesce(permissions, '{}'::text[])
    || array['Análises', 'Mapa', 'Raio-X', 'Prospecção', 'Follow-up', 'CRM', 'Equipe']::text[]
  ) as permission
  where lower(permission) <> 'crm_gestao'
)
where is_active = true
  and lower(coalesce(username, '')) <> 'localway01';

drop policy if exists "commercial users read owned leads" on public.leads;
drop policy if exists "commercial users insert owned leads" on public.leads;
drop policy if exists "commercial users update owned leads" on public.leads;
drop policy if exists "commercial users delete owned leads" on public.leads;

create policy "commercial users read owned leads"
on public.leads for select
to authenticated
using (
  public.is_primary_admin()
  or (public.has_commercial_access() and created_by = (select auth.uid()))
);

create policy "commercial users insert owned leads"
on public.leads for insert
to authenticated
with check (
  public.is_primary_admin()
  or (public.has_commercial_access() and created_by = (select auth.uid()))
);

create policy "commercial users update owned leads"
on public.leads for update
to authenticated
using (
  public.is_primary_admin()
  or (public.has_commercial_access() and created_by = (select auth.uid()))
)
with check (
  public.is_primary_admin()
  or (public.has_commercial_access() and created_by = (select auth.uid()))
);

create policy "only primary admin deletes leads"
on public.leads for delete
to authenticated
using (public.is_primary_admin());

drop policy if exists "commercial users read owned interactions" on public.lead_interactions;
drop policy if exists "commercial users insert owned interactions" on public.lead_interactions;
drop policy if exists "commercial users update owned interactions" on public.lead_interactions;
drop policy if exists "commercial users delete owned interactions" on public.lead_interactions;

create policy "commercial users read owned interactions"
on public.lead_interactions for select
to authenticated
using (
  public.is_primary_admin()
  or (
    public.has_commercial_access()
    and exists (
      select 1
      from public.leads
      where leads.id = lead_interactions.lead_id
        and leads.created_by = (select auth.uid())
    )
  )
);

create policy "commercial users insert owned interactions"
on public.lead_interactions for insert
to authenticated
with check (
  public.is_primary_admin()
  or (
    public.has_commercial_access()
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.leads
      where leads.id = lead_interactions.lead_id
        and leads.created_by = (select auth.uid())
    )
  )
);

create policy "commercial users update owned interactions"
on public.lead_interactions for update
to authenticated
using (public.is_primary_admin() or created_by = (select auth.uid()))
with check (public.is_primary_admin() or created_by = (select auth.uid()));

create policy "only primary admin deletes interactions"
on public.lead_interactions for delete
to authenticated
using (public.is_primary_admin());

create index if not exists leads_owner_workflow_idx
  on public.leads(created_by, status, next_action_at, created_at desc);

create index if not exists leads_owner_crm_idx
  on public.leads(created_by, crm_stage, updated_at desc);

comment on function public.is_primary_admin() is
  'Restricts destructive team-wide operations and CRM movement to the LocalWay01 administrative profile.';
