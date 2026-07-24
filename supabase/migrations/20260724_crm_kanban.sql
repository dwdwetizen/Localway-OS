alter table public.leads
  add column if not exists crm_stage text check (crm_stage in ('qualificacao', 'proposta', 'negociacao', 'fechado', 'perdido')),
  add column if not exists estimated_value numeric(12, 2);

update public.leads
set crm_stage = 'qualificacao'
where status = 'qualificado' and crm_stage is null;

create index if not exists leads_crm_stage_idx on public.leads (crm_stage);
