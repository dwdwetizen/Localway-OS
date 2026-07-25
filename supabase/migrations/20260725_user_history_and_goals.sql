-- Per-user activity history, archived profiles and individual commercial goals.

alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz;

alter table public.lead_interactions
  alter column created_by set default auth.uid(),
  add column if not exists event_type text not null default 'contact',
  add column if not exists previous_status text,
  add column if not exists new_status text,
  add column if not exists actor_name text,
  add column if not exists actor_email text;

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads
  add constraint leads_status_check check (
    status in (
      'novo',
      'ligacao_realizada',
      'contato_realizado',
      'nao_atendeu',
      'ligar_depois',
      'retornar_depois',
      'reuniao_marcada',
      'qualificado',
      'sem_interesse',
      'perdido'
    )
  );

create index if not exists lead_interactions_created_by_idx
  on public.lead_interactions(created_by, occurred_at desc);
create index if not exists leads_created_by_idx
  on public.leads(created_by, created_at desc);

create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  period_start date not null,
  period_end date not null,
  target_leads integer not null default 0 check (target_leads >= 0),
  target_contacts integer not null default 0 check (target_contacts >= 0),
  target_meetings integer not null default 0 check (target_meetings >= 0),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_goals_valid_period check (period_end >= period_start),
  constraint user_goals_user_period_key unique (user_id, period_start, period_end)
);

alter table public.user_goals enable row level security;
grant select, insert, update, delete on public.user_goals to authenticated;
create index if not exists user_goals_created_by_idx on public.user_goals(created_by);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public';
    execute 'revoke all on function public.rls_auto_enable() from anon';
    execute 'revoke all on function public.rls_auto_enable() from authenticated';
  end if;
end;
$$;

drop policy if exists "admin le todos perfis" on public.profiles;
drop policy if exists "usuario le proprio perfil" on public.profiles;
create policy "users read authorized profiles"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or public.is_admin());

drop policy if exists "users read own goals" on public.user_goals;
drop policy if exists "admins manage goals" on public.user_goals;
drop policy if exists "admins insert goals" on public.user_goals;
drop policy if exists "admins update goals" on public.user_goals;
drop policy if exists "admins delete goals" on public.user_goals;

create policy "users read own goals"
on public.user_goals for select
to authenticated
using ((select auth.uid()) = user_id or public.is_admin());

create policy "admins insert goals"
on public.user_goals for insert
to authenticated
with check (public.is_admin());

create policy "admins update goals"
on public.user_goals for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins delete goals"
on public.user_goals for delete
to authenticated
using (public.is_admin());

create or replace function public.log_new_lead_interaction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor record;
begin
  select nome, email
    into actor
  from public.profiles
  where id = auth.uid();

  insert into public.lead_interactions (
    lead_id,
    outcome,
    notes,
    occurred_at,
    created_by,
    event_type,
    previous_status,
    new_status,
    actor_name,
    actor_email
  ) values (
    new.id,
    case
      when new.source = 'google_places' then 'Lead gerado pelo Google Maps'
      when new.source = 'presencial' then 'Lead presencial cadastrado'
      else 'Lead cadastrado'
    end,
    new.notes,
    now(),
    auth.uid(),
    'lead_created',
    null,
    new.status,
    actor.nome,
    actor.email
  );

  return new;
end;
$$;

revoke all on function public.log_new_lead_interaction() from public, anon, authenticated;

drop trigger if exists on_lead_created_history on public.leads;
create trigger on_lead_created_history
after insert on public.leads
for each row execute function public.log_new_lead_interaction();

drop policy if exists "authorized modules manage leads" on public.leads;
create policy "authorized modules manage leads"
on public.leads for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_active = true
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array['Prospecção', 'Follow-up', 'CRM', 'prospeccao', 'followup', 'crm']::text[]
      )
  )
)
with check (
  exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_active = true
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array['Prospecção', 'Follow-up', 'CRM', 'prospeccao', 'followup', 'crm']::text[]
      )
  )
);

drop policy if exists "authorized modules manage interactions" on public.lead_interactions;
create policy "authorized modules manage interactions"
on public.lead_interactions for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_active = true
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array['Prospecção', 'Follow-up', 'CRM', 'prospeccao', 'followup', 'crm']::text[]
      )
  )
)
with check (
  exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and is_active = true
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array['Prospecção', 'Follow-up', 'CRM', 'prospeccao', 'followup', 'crm']::text[]
      )
  )
);
