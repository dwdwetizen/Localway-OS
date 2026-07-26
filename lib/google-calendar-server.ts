import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  decryptSecret,
  serviceClient,
} from '@/lib/google-ads-server';

export type GoogleCalendarConfiguration = {
  id: number;
  oauth_client_id: string | null;
  oauth_client_secret_encrypted: string | null;
  refresh_token_encrypted: string | null;
  connected_email: string | null;
  calendar_id: string | null;
  connected_at: string | null;
};

function environment() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  };
}

export async function authorizeCalendarRequest(request: NextRequest, adminOnly = false) {
  const { url, anonKey } = environment();
  const accessToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!url || !anonKey || !accessToken) {
    return { error: NextResponse.json({ error: 'Sessão ausente.' }, { status: 401 }), userId: '' };
  }
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client.auth.getUser(accessToken);
  if (!data.user) {
    return { error: NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 }), userId: '' };
  }
  const { data: profile } = await client
    .from('profiles')
    .select('role,permissions,is_active')
    .eq('id', data.user.id)
    .maybeSingle();
  const role = String(profile?.role || '').toLocaleLowerCase('pt-BR');
  const permissions = (profile?.permissions || []).map((item: string) => item.toLocaleLowerCase('pt-BR'));
  const isAdmin = role === 'admin' || role === 'administrador';
  const hasCommercialAccess = permissions.some((item: string) =>
    ['prospecção', 'prospeccao', 'follow-up', 'followup', 'crm'].includes(item));
  if (!profile?.is_active || (adminOnly ? !isAdmin : !isAdmin && !hasCommercialAccess)) {
    return { error: NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 }), userId: '' };
  }
  return { error: null, userId: data.user.id };
}

export async function loadGoogleCalendarConfiguration() {
  const { data, error } = await serviceClient()
    .from('google_calendar_integrations')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(error.message);
  return (data || null) as GoogleCalendarConfiguration | null;
}

export function googleCalendarStatus(configuration: GoogleCalendarConfiguration | null) {
  const credentialsConfigured = Boolean(
    configuration?.oauth_client_id
    && configuration.oauth_client_secret_encrypted,
  );
  return {
    credentialsConfigured,
    connected: credentialsConfigured && Boolean(configuration?.refresh_token_encrypted),
    oauthClientId: configuration?.oauth_client_id || '',
    connectedEmail: configuration?.connected_email || '',
    calendarId: configuration?.calendar_id || 'primary',
    connectedAt: configuration?.connected_at || null,
  };
}

export function googleCalendarRedirectUri() {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim()
    || 'https://localway-os-2qwb.vercel.app/api/google-calendar/callback';
}

export async function googleCalendarAccessToken(configuration: GoogleCalendarConfiguration) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: configuration.oauth_client_id || '',
      client_secret: decryptSecret(configuration.oauth_client_secret_encrypted),
      refresh_token: decryptSecret(configuration.refresh_token_encrypted),
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || 'A autorização do Google Agenda expirou.');
  }
  return String(result.access_token);
}

