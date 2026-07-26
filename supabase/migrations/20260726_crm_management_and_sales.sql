-- Managers control the CRM while each converted sale is credited to the
-- collaborator who originally created the lead.

create or replace function public.is_crm_manager()
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
        or permissions && array['crm_gestao']::text[]
      )
  );
$$;

revoke all on function public.is_crm_manager() from public, anon;
grant execute on function public.is_crm_manager() to authenticated;

-- Every active collaborator can follow their own opportunities and see the
-- team ranking. Only crm_gestao/admin can move opportunities after entry.
update public.profiles
set permissions = array(
  select distinct permission
  from unnest(coalesce(permissions, '{}'::text[]) || array['CRM', 'Equipe']::text[]) as permission
)
where is_active = true
  and lower(coalesce(role, '')) not in ('admin', 'administrador');

create or replace function public.protect_crm_stage_changes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.crm_stage is not distinct from new.crm_stage then
    return new;
  end if;

  if public.is_crm_manager() then
    return new;
  end if;

  if old.crm_stage is null
    and new.crm_stage = 'qualificacao'
    and new.created_by = auth.uid()
    and new.status in ('reuniao_marcada', 'qualificado') then
    return new;
  end if;

  raise exception 'Somente a gestão pode movimentar oportunidades no CRM.'
    using errcode = '42501';
end;
$$;

revoke all on function public.protect_crm_stage_changes() from public, anon, authenticated;

drop trigger if exists protect_crm_stage_changes on public.leads;
create trigger protect_crm_stage_changes
before update of crm_stage on public.leads
for each row execute function public.protect_crm_stage_changes();

drop policy if exists "commercial users read owned leads" on public.leads;
drop policy if exists "commercial users insert owned leads" on public.leads;
drop policy if exists "commercial users update owned leads" on public.leads;
drop policy if exists "commercial users delete owned leads" on public.leads;

create policy "commercial users read owned leads"
on public.leads for select
to authenticated
using (
  public.is_admin()
  or public.is_crm_manager()
  or (public.has_commercial_access() and created_by = (select auth.uid()))
);

create policy "commercial users insert owned leads"
on public.leads for insert
to authenticated
with check (
  public.is_admin()
  or (
    public.has_commercial_access()
    and created_by = (select auth.uid())
  )
);

create policy "commercial users update owned leads"
on public.leads for update
to authenticated
using (
  public.is_admin()
  or public.is_crm_manager()
  or (public.has_commercial_access() and created_by = (select auth.uid()))
)
with check (
  public.is_admin()
  or public.is_crm_manager()
  or (public.has_commercial_access() and created_by = (select auth.uid()))
);

create policy "commercial users delete owned leads"
on public.leads for delete
to authenticated
using (
  public.is_admin()
  or (public.has_commercial_access() and created_by = (select auth.uid()))
);

drop policy if exists "commercial users read owned interactions" on public.lead_interactions;
drop policy if exists "commercial users insert owned interactions" on public.lead_interactions;
drop policy if exists "commercial users update owned interactions" on public.lead_interactions;
drop policy if exists "commercial users delete owned interactions" on public.lead_interactions;

create policy "commercial users read owned interactions"
on public.lead_interactions for select
to authenticated
using (
  public.is_admin()
  or public.is_crm_manager()
  or (
    public.has_commercial_access()
    and (
      created_by = (select auth.uid())
      or exists (
        select 1 from public.leads
        where leads.id = lead_interactions.lead_id
          and leads.created_by = (select auth.uid())
      )
    )
  )
);

create policy "commercial users insert owned interactions"
on public.lead_interactions for insert
to authenticated
with check (
  public.is_admin()
  or (
    public.is_crm_manager()
    and created_by = (select auth.uid())
  )
  or (
    public.has_commercial_access()
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.leads
      where leads.id = lead_interactions.lead_id
        and leads.created_by = (select auth.uid())
    )
  )
);

create policy "commercial users update owned interactions"
on public.lead_interactions for update
to authenticated
using (public.is_admin() or public.is_crm_manager() or created_by = (select auth.uid()))
with check (public.is_admin() or public.is_crm_manager() or created_by = (select auth.uid()));

create policy "commercial users delete owned interactions"
on public.lead_interactions for delete
to authenticated
using (public.is_admin() or public.is_crm_manager() or created_by = (select auth.uid()));

drop function if exists public.team_performance();
create function public.team_performance()
returns table (
  user_id uuid,
  name text,
  email text,
  job_title text,
  role text,
  leads_approached bigint,
  meetings_scheduled bigint,
  sales_converted bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with caller_access as (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array['Equipe', 'equipe']::text[]
      )
  ),
  activity as (
    select
      li.created_by as user_id,
      count(distinct li.lead_id) filter (
        where li.event_type in ('prospecting_contact', 'follow_up')
          or li.new_status in (
            'nao_atendeu',
            'ligar_depois',
            'retornar_depois',
            'reuniao_marcada',
            'qualificado',
            'sem_interesse'
          )
      ) as leads_approached,
      count(distinct li.lead_id) filter (
        where li.new_status = 'reuniao_marcada'
          or lower(li.outcome) = 'reunião marcada'
      ) as meetings_scheduled
    from public.lead_interactions li
    where li.created_by is not null
    group by li.created_by
  ),
  sales as (
    select created_by as user_id, count(*) as sales_converted
    from public.leads
    where crm_stage = 'fechado'
      and created_by is not null
    group by created_by
  )
  select
    p.id,
    coalesce(nullif(trim(p.nome), ''), split_part(p.email, '@', 1)),
    p.email,
    coalesce(
      nullif(trim(p.job_title), ''),
      case
        when lower(coalesce(p.role, '')) in ('admin', 'administrador') then 'Administrador'
        else 'SDR / Colaborador'
      end
    ),
    p.role,
    coalesce(a.leads_approached, 0),
    coalesce(a.meetings_scheduled, 0),
    coalesce(s.sales_converted, 0)
  from caller_access
  cross join public.profiles p
  left join activity a on a.user_id = p.id
  left join sales s on s.user_id = p.id
  where p.is_active = true
  order by
    coalesce(s.sales_converted, 0) desc,
    coalesce(a.meetings_scheduled, 0) desc,
    coalesce(a.leads_approached, 0) desc,
    coalesce(p.nome, p.email);
$$;

revoke all on function public.team_performance() from public, anon;
grant execute on function public.team_performance() to authenticated;

