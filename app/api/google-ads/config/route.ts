import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeGoogleAdsRequest,
  encryptSecret,
  googleAdsStatus,
  loadGoogleAdsConfiguration,
  serviceClient,
} from '@/lib/google-ads-server';

export async function GET(request: NextRequest) {
  const authorization = await authorizeGoogleAdsRequest(request, true);
  if (authorization.error) return authorization.error;
  try {
    return NextResponse.json(googleAdsStatus(await loadGoogleAdsConfiguration()));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Não foi possível consultar o Google Ads.',
      migrationRequired: true,
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authorization = await authorizeGoogleAdsRequest(request, true);
  if (authorization.error) return authorization.error;
  const body = await request.json();
  const developerToken = String(body.developerToken || '').trim();
  const customerId = String(body.customerId || '').replace(/\D/g, '');
  const loginCustomerId = String(body.loginCustomerId || '').replace(/\D/g, '');
  const oauthClientId = String(body.oauthClientId || '').trim();
  const oauthClientSecret = String(body.oauthClientSecret || '').trim();
  if (customerId && customerId.length !== 10) {
    return NextResponse.json({ error: 'O ID da conta Google Ads precisa ter 10 números.' }, { status: 400 });
  }
  if (loginCustomerId && loginCustomerId.length !== 10) {
    return NextResponse.json({ error: 'O ID da conta administradora precisa ter 10 números.' }, { status: 400 });
  }
  const existing = await loadGoogleAdsConfiguration();
  const payload = {
    id: 1,
    customer_id: customerId || existing?.customer_id || null,
    login_customer_id: loginCustomerId || null,
    oauth_client_id: oauthClientId || existing?.oauth_client_id || null,
    developer_token_encrypted: developerToken
      ? encryptSecret(developerToken)
      : existing?.developer_token_encrypted || null,
    oauth_client_secret_encrypted: oauthClientSecret
      ? encryptSecret(oauthClientSecret)
      : existing?.oauth_client_secret_encrypted || null,
    updated_by: authorization.userId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await serviceClient()
    .from('google_ads_integrations')
    .upsert(payload, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(googleAdsStatus(await loadGoogleAdsConfiguration()));
}
