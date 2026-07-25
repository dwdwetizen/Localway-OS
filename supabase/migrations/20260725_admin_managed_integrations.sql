-- Allow the administrator to configure Google integrations inside the app.
-- The secret Places key remains readable only by the backend service role.

alter table public.settings
  add column if not exists google_maps_browser_key text;

alter table public.settings enable row level security;

drop policy if exists "usuarios autenticados leem settings" on public.settings;
drop policy if exists "admin atualiza settings" on public.settings;
drop policy if exists "admin insere settings" on public.settings;
drop policy if exists "admins read integration settings" on public.settings;
drop policy if exists "admins insert integration settings" on public.settings;
drop policy if exists "admins update integration settings" on public.settings;

revoke all on table public.settings from anon, authenticated;
grant select, insert, update on table public.settings to authenticated;

create policy "admins read integration settings"
on public.settings for select
to authenticated
using (public.is_admin());

create policy "admins insert integration settings"
on public.settings for insert
to authenticated
with check (public.is_admin());

create policy "admins update integration settings"
on public.settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
