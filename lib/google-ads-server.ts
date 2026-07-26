import 'server-only';

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export type GoogleAdsConfiguration = {
  id: number;
  developer_token_encrypted: string | null;
  customer_id: string | null;
  login_customer_id: string | null;
  oauth_client_id: string | null;
  oauth_client_secret_encrypted: string | null;
  refresh_token_encrypted: string | null;
  connected_email: string | null;
  connected_at: string | null;
};

function environment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { url, anonKey, serviceKey };
}

export function serviceClient() {
  const { url, serviceKey } = environment();
  if (!url || !serviceKey) throw new Error('Supabase não configurado no servidor.');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authorizeGoogleAdsRequest(request: NextRequest, adminOnly = false) {
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
  const hasMapAccess = permissions.includes('mapa');
  if (!profile?.is_active || (adminOnly ? !isAdmin : !isAdmin && !hasMapAccess)) {
    return { error: NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 }), userId: '' };
  }
  return { error: null, userId: data.user.id };
}

function encryptionKey() {
  const { serviceKey } = environment();
  if (!serviceKey) throw new Error('Chave segura do servidor ausente.');
  return createHash('sha256').update(serviceKey).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return '';
  const [ivValue, tagValue, encryptedValue] = value.split('.');
  if (!ivValue || !tagValue || !encryptedValue) return '';
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export async function loadGoogleAdsConfiguration() {
  const { data, error } = await serviceClient()
    .from('google_ads_integrations')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(error.message);
  return (data || null) as GoogleAdsConfiguration | null;
}

export function googleAdsStatus(configuration: GoogleAdsConfiguration | null) {
  const credentialsConfigured = Boolean(
    configuration?.developer_token_encrypted
    && configuration.customer_id
    && configuration.oauth_client_id
    && configuration.oauth_client_secret_encrypted,
  );
  return {
    credentialsConfigured,
    connected: credentialsConfigured && Boolean(configuration?.refresh_token_encrypted),
    customerId: configuration?.customer_id || '',
    loginCustomerId: configuration?.login_customer_id || '',
    oauthClientId: configuration?.oauth_client_id || '',
    connectedEmail: configuration?.connected_email || '',
    connectedAt: configuration?.connected_at || null,
  };
}

export function googleAdsRedirectUri() {
  return process.env.GOOGLE_ADS_REDIRECT_URI?.trim()
    || 'https://localway-os-2qwb.vercel.app/api/google-ads/callback';
}

export function signOAuthState(payload: object) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', encryptionKey()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(value: string) {
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature) return null;
  const expected = createHmac('sha256', encryptionKey()).update(encoded).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
    userId: string;
    createdAt: number;
    origin: string;
  };
  if (Date.now() - payload.createdAt > 10 * 60 * 1000) return null;
  return payload;
}

export async function googleAdsAccessToken(configuration: GoogleAdsConfiguration) {
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
    throw new Error(result.error_description || 'A autorização do Google Ads expirou.');
  }
  return String(result.access_token);
}

export function googleAdsHeaders(configuration: GoogleAdsConfiguration, accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'developer-token': decryptSecret(configuration.developer_token_encrypted),
    ...(configuration.login_customer_id
      ? { 'login-customer-id': configuration.login_customer_id.replace(/\D/g, '') }
      : {}),
  };
}
