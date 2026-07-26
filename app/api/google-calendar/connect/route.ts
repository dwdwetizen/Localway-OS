import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeCalendarRequest,
  googleCalendarRedirectUri,
  googleCalendarStatus,
  loadGoogleCalendarConfiguration,
} from '@/lib/google-calendar-server';
import {
  decryptSecret,
  signOAuthState,
} from '@/lib/google-ads-server';

export async function POST(request: NextRequest) {
  const authorization = await authorizeCalendarRequest(request, true);
  if (authorization.error) return authorization.error;
  const configuration = await loadGoogleCalendarConfiguration();
  if (!configuration || !googleCalendarStatus(configuration).credentialsConfigured) {
    return NextResponse.json({ error: 'Salve primeiro as credenciais OAuth do Google Agenda.' }, { status: 400 });
  }
  decryptSecret(configuration.oauth_client_secret_encrypted);
  const origin = new URL(request.url).origin;
  const redirectUri = googleCalendarRedirectUri();
  const state = signOAuthState({
    userId: authorization.userId,
    createdAt: Date.now(),
    origin,
  });
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.search = new URLSearchParams({
    client_id: configuration.oauth_client_id || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events openid email',
    access_type: 'offline',
    prompt: 'consent select_account',
    state,
  }).toString();
  return NextResponse.json({ authorizationUrl: authorizationUrl.toString(), redirectUri });
}

