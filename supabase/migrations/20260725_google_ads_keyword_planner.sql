-- Server-only Google Ads integration. Secrets are encrypted by the application
-- before storage and are never exposed through the authenticated REST role.

create table if not exists public.google_ads_integrations (
  id integer primary key default 1 check (id = 1),
  developer_token_encrypted text,
  customer_id text,
  login_customer_id text,
  oauth_client_id text,
  oauth_client_secret_encrypted text,
  refresh_token_encrypted text,
  connected_email text,
  connected_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.google_ads_integrations enable row level security;
revoke all on table public.google_ads_integrations from anon, authenticated;

comment on table public.google_ads_integrations is
  'Google Ads API credentials, accessible only through service-role backend routes.';
