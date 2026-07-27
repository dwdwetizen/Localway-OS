-- Leads enter CRM only after a meeting is scheduled. The primary admin then
-- controls the commercial pipeline from meeting scheduled through payment.

alter table public.leads
  drop constraint if exists leads_crm_stage_check;

update public.leads
set crm_stage = 'reuniao_marcada'
where crm_stage = 'qualificacao';

alter table public.leads
  add constraint leads_crm_stage_check
  check (
    crm_stage in (
      'reuniao_marcada',
      'reuniao_realizada',
      'proposta',
      'negociacao',
      'fechado',
      'perdido'
    )
  );

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
    and new.crm_stage = 'reuniao_marcada'
    and new.created_by = auth.uid()
    and new.status = 'reuniao_marcada' then
    return new;
  end if;

  raise exception 'Somente a gestão pode movimentar oportunidades no CRM.'
    using errcode = '42501';
end;
$$;

revoke all on function public.protect_crm_stage_changes() from public, anon, authenticated;

comment on column public.leads.crm_stage is
  'Management-only CRM stage. Collaborators may initialize it as reuniao_marcada when scheduling a meeting.';
