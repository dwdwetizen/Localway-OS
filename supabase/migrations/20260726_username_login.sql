-- Human-friendly usernames replace e-mail addresses in the Localway OS login.

alter table public.profiles
  add column if not exists username text;

with candidates as (
  select
    id,
    case
      when length(left(lower(regexp_replace(
        coalesce(nullif(trim(nome), ''), split_part(email, '@', 1)),
        '[^a-zA-Z0-9._-]',
        '',
        'g'
      )), 27)) >= 3
        then left(lower(regexp_replace(
          coalesce(nullif(trim(nome), ''), split_part(email, '@', 1)),
          '[^a-zA-Z0-9._-]',
          '',
          'g'
        )), 27)
      else 'usuario_' || left(replace(id::text, '-', ''), 8)
    end as base_username
  from public.profiles
  where username is null or trim(username) = ''
),
ranked as (
  select
    id,
    base_username,
    row_number() over (partition by base_username order by id) as duplicate_number
  from candidates
)
update public.profiles p
set username = case
  when ranked.duplicate_number = 1 then ranked.base_username
  else left(ranked.base_username, 27) || '_' || ranked.duplicate_number::text
end
from ranked
where p.id = ranked.id;

alter table public.profiles
  alter column username set not null;

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

alter table public.profiles
  drop constraint if exists profiles_username_format_check;

alter table public.profiles
  add constraint profiles_username_format_check
  check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');

drop function if exists public.team_performance();
create function public.team_performance()
returns table (
  user_id uuid,
  name text,
  username text,
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
    coalesce(nullif(trim(p.nome), ''), p.username),
    p.username,
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
    coalesce(p.nome, p.username);
$$;

revoke all on function public.team_performance() from public, anon;
grant execute on function public.team_performance() to authenticated;
