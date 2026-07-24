alter table public.profiles
  add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "admins manage profile photos" on storage.objects;
create policy "admins manage profile photos"
on storage.objects for all
to authenticated
using (bucket_id = 'profile-photos' and public.is_admin())
with check (bucket_id = 'profile-photos' and public.is_admin());

drop policy if exists "users see authorized profile photos" on storage.objects;
create policy "users see authorized profile photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and (public.is_admin() or owner_id = (select auth.uid()::text))
);
