import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeCalendarRequest,
  googleCalendarStatus,
  loadGoogleCalendarConfiguration,
} from '@/lib/google-calendar-server';
import {
  encryptSecret,
  loadGoogleAdsConfiguration,
  serviceClient,
} from '@/lib/google-ads-server';

export async function GET(request: NextRequest) {
  const authorization = await authorizeCalendarRequest(request, true);
  if (authorization.error) return authorization.error;
  try {
    return NextResponse.json(googleCalendarStatus(await loadGoogleCalendarConfiguration()));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Não foi possível consultar o Google Agenda.',
      migrationRequired: true,
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authorization = await authorizeCalendarRequest(request, true);
  if (authorization.error) return authorization.error;
  const body = await request.json();
  const existing = await loadGoogleCalendarConfiguration();
  let oauthClientId = String(body.oauthClientId || '').trim();
  let oauthClientSecretEncrypted = String(body.oauthClientSecret || '').trim()
    ? encryptSecret(String(body.oauthClientSecret).trim())
    : existing?.oauth_client_secret_encrypted || null;

  if (body.reuseGoogleAds) {
    const ads = await loadGoogleAdsConfiguration();
    if (!ads?.oauth_client_id || !ads.oauth_client_secret_encrypted) {
      return NextResponse.json({ error: 'As credenciais OAuth do Google Ads ainda não estão salvas.' }, { status: 400 });
    }
    oauthClientId = ads.oauth_client_id;
    oauthClientSecretEncrypted = ads.oauth_client_secret_encrypted;
  }
  if (!oauthClientId) oauthClientId = existing?.oauth_client_id || '';
  if (!oauthClientId || !oauthClientSecretEncrypted) {
    return NextResponse.json({ error: 'Informe o OAuth Client ID e o Client Secret.' }, { status: 400 });
  }

  const calendarId = String(body.calendarId || '').trim() || existing?.calendar_id || 'primary';
  const { error } = await serviceClient()
    .from('google_calendar_integrations')
    .upsert({
      id: 1,
      oauth_client_id: oauthClientId,
      oauth_client_secret_encrypted: oauthClientSecretEncrypted,
      calendar_id: calendarId,
      updated_by: authorization.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(googleCalendarStatus(await loadGoogleCalendarConfiguration()));
}

