-- Keep every employee's commercial data private while administrators retain
-- team-wide visibility. The application uses the same leads table for
-- Prospecting, Follow-up and CRM, so ownership follows the lead across stages.

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
          'Prospecção', 'Follow-up', 'CRM',
          'prospeccao', 'followup', 'crm'
        ]::text[]
      )
  );
$$;

revoke all on function public.has_commercial_access() from public, anon;
grant execute on function public.has_commercial_access() to authenticated;

drop policy if exists "registered team members manage leads" on public.leads;
drop policy if exists "authorized modules manage leads" on public.leads;
drop policy if exists "commercial users read owned leads" on public.leads;
drop policy if exists "commercial users insert owned leads" on public.leads;
drop policy if exists "commercial users update owned leads" on public.leads;
drop policy if exists "commercial users delete owned leads" on public.leads;

create policy "commercial users read owned leads"
on public.leads for select
to authenticated
using (
  public.is_admin()
  or (
    public.has_commercial_access()
    and created_by = (select auth.uid())
  )
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
  or (
    public.has_commercial_access()
    and created_by = (select auth.uid())
  )
)
with check (
  public.is_admin()
  or (
    public.has_commercial_access()
    and created_by = (select auth.uid())
  )
);

create policy "commercial users delete owned leads"
on public.leads for delete
to authenticated
using (
  public.is_admin()
  or (
    public.has_commercial_access()
    and created_by = (select auth.uid())
  )
);

drop policy if exists "registered team members manage interactions" on public.lead_interactions;
drop policy if exists "authorized modules manage interactions" on public.lead_interactions;
drop policy if exists "commercial users read owned interactions" on public.lead_interactions;
drop policy if exists "commercial users insert owned interactions" on public.lead_interactions;
drop policy if exists "commercial users update owned interactions" on public.lead_interactions;
drop policy if exists "commercial users delete owned interactions" on public.lead_interactions;

create policy "commercial users read owned interactions"
on public.lead_interactions for select
to authenticated
using (
  public.is_admin()
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
using (public.is_admin() or created_by = (select auth.uid()))
with check (public.is_admin() or created_by = (select auth.uid()));

create policy "commercial users delete owned interactions"
on public.lead_interactions for delete
to authenticated
using (public.is_admin() or created_by = (select auth.uid()));

drop policy if exists "authorized users read lead analyses" on public.lead_analyses;
drop policy if exists "authorized users create lead analyses" on public.lead_analyses;
drop policy if exists "users read owned lead analyses" on public.lead_analyses;
drop policy if exists "users create owned lead analyses" on public.lead_analyses;

create policy "users read owned lead analyses"
on public.lead_analyses for select
to authenticated
using (
  public.is_admin()
  or (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and is_active = true
        and permissions && array['Análises', 'analises', 'Prospecção', 'prospeccao']::text[]
    )
  )
);

create policy "users create owned lead analyses"
on public.lead_analyses for insert
to authenticated
with check (
  public.is_admin()
  or (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.leads
      where leads.id = lead_analyses.lead_id
        and leads.created_by = (select auth.uid())
    )
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid())
        and is_active = true
        and permissions && array['Análises', 'analises']::text[]
    )
  )
);
