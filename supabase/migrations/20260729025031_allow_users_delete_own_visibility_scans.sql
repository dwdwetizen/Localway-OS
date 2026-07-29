-- Users may remove only the local visibility scans that they created.

grant delete on public.local_visibility_scans to authenticated;

drop policy if exists "users delete own visibility scans" on public.local_visibility_scans;
create policy "users delete own visibility scans"
on public.local_visibility_scans for delete
to authenticated
using ((select auth.uid()) = created_by);
