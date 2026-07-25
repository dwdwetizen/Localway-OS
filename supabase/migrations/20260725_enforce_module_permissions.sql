-- Enforce the module permissions stored in public.profiles.
-- The UI uses these same labels when the administrator creates a login.

drop policy if exists "registered team members manage leads" on public.leads;
create policy "authorized modules manage leads"
on public.leads
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array['Prospecção', 'Follow-up', 'CRM', 'prospeccao', 'followup', 'crm']::text[]
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array['Prospecção', 'Follow-up', 'CRM', 'prospeccao', 'followup', 'crm']::text[]
      )
  )
);

drop policy if exists "registered team members manage interactions" on public.lead_interactions;
create policy "authorized modules manage interactions"
on public.lead_interactions
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array['Prospecção', 'Follow-up', 'CRM', 'prospeccao', 'followup', 'crm']::text[]
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and (
        lower(coalesce(role, '')) in ('admin', 'administrador')
        or permissions && array['Prospecção', 'Follow-up', 'CRM', 'prospeccao', 'followup', 'crm']::text[]
      )
  )
);
