-- Allow every grid size offered by the local visibility interface.
alter table public.local_visibility_scans
  drop constraint if exists local_visibility_scans_grid_size_check;

alter table public.local_visibility_scans
  add constraint local_visibility_scans_grid_size_check
  check (grid_size in (3, 4, 5, 6, 7));
