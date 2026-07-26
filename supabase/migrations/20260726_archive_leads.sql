-- Soft archive for leads. Archived records keep their history and can be
-- restored; permanent deletion remains protected by the existing ownership RLS.

alter table public.leads
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

create index if not exists leads_created_by_archived_at_idx
  on public.leads (created_by, archived_at, created_at desc);

comment on column public.leads.archived_at is
  'When set, hides the lead from active Prospecting, Follow-up and CRM lists.';

comment on column public.leads.archived_by is
  'User who archived the lead.';
