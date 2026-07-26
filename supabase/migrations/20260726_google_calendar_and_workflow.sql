-- Central Google Calendar integration and meeting tracking.

create table if not exists public.google_calendar_integrations (
  id integer primary key default 1 check (id = 1),
  oauth_client_id text,
  oauth_client_secret_encrypted text,
  refresh_token_encrypted text,
  connected_email text,
  calendar_id text not null default 'primary',
  connected_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_integrations enable row level security;
revoke all on table public.google_calendar_integrations from anon, authenticated;

comment on table public.google_calendar_integrations is
  'Central Google Calendar OAuth credentials, accessible only through service-role backend routes.';

alter table public.leads
  add column if not exists calendar_event_id text,
  add column if not exists calendar_event_url text;

