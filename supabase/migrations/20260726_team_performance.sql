-- Real team directory and performance ranking.

alter table public.profiles
  add column if not exists job_title text;

update public.profiles
set job_title = case
  when lower(coalesce(role, '')) in ('admin', 'administrador') then 'Administrador'
  else 'SDR / Colaborador'
end
where nullif(trim(job_title), '') is null;

create or replace function public.team_performance()
returns table (
  user_id uuid,
  name text,
  email text,
  job_title text,
  role text,
  leads_approached bigint,
  meetings_scheduled bigint
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
    coalesce(a.meetings_scheduled, 0)
  from caller_access
  cross join public.profiles p
  left join activity a on a.user_id = p.id
  where p.is_active = true
  order by
    coalesce(a.meetings_scheduled, 0) desc,
    coalesce(a.leads_approached, 0) desc,
    coalesce(p.nome, p.email);
$$;

revoke all on function public.team_performance() from public, anon;
grant execute on function public.team_performance() to authenticated;

