import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeGoogleAdsRequest,
  decryptSecret,
  googleAdsStatus,
  loadGoogleAdsConfiguration,
  signOAuthState,
} from '@/lib/google-ads-server';

export async function POST(request: NextRequest) {
  const authorization = await authorizeGoogleAdsRequest(request, true);
  if (authorization.error) return authorization.error;
  const configuration = await loadGoogleAdsConfiguration();
  const status = googleAdsStatus(configuration);
  if (!configuration || !status.credentialsConfigured) {
    return NextResponse.json({ error: 'Salve primeiro o token, os IDs e as credenciais OAuth.' }, { status: 400 });
  }
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/google-ads/callback`;
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
    scope: 'https://www.googleapis.com/auth/adwords openid email',
    access_type: 'offline',
    prompt: 'consent select_account',
    state,
  }).toString();
  // Validate that the stored secret can be decrypted before opening Google.
  decryptSecret(configuration.oauth_client_secret_encrypted);
  return NextResponse.json({ authorizationUrl: authorizationUrl.toString(), redirectUri });
}
