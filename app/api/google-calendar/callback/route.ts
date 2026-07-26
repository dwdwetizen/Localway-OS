import { NextRequest, NextResponse } from 'next/server';
import {
  googleCalendarRedirectUri,
  loadGoogleCalendarConfiguration,
} from '@/lib/google-calendar-server';
import {
  decryptSecret,
  encryptSecret,
  serviceClient,
  verifyOAuthState,
} from '@/lib/google-ads-server';

function callbackPage(origin: string, success: boolean, message: string) {
  const safeMessage = message.replace(/[<>&"']/g, character => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
  })[character] || character);
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Google Agenda</title>
  <style>body{font-family:Inter,Arial,sans-serif;background:#f4f2fd;display:grid;place-items:center;min-height:100vh;margin:0;color:#171a2b}.card{background:#fff;border:1px solid #dfe2ec;border-radius:20px;padding:32px;max-width:440px;text-align:center;box-shadow:0 18px 45px #1b25591a}h1{font-size:20px;color:${success ? '#047857' : '#be123c'}}p{font-size:14px;line-height:1.5;color:#62677a}</style></head>
  <body><div class="card"><h1>${success ? 'Google Agenda conectado' : 'Não foi possível conectar'}</h1><p>${safeMessage}</p><p>Esta janela pode ser fechada.</p></div>
  <script>window.opener?.postMessage({type:'localway-google-calendar',success:${success}},${JSON.stringify(origin)});setTimeout(()=>window.close(),1800);</script></body></html>`;
  return new NextResponse(html, { status: success ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = verifyOAuthState(url.searchParams.get('state') || '');
  if (!state) return callbackPage(url.origin, false, 'A autorização expirou. Inicie a conexão novamente.');
  const googleError = url.searchParams.get('error');
  if (googleError) return callbackPage(state.origin, false, `O Google recusou a autorização: ${googleError}.`);
  const code = url.searchParams.get('code') || '';
  const configuration = await loadGoogleCalendarConfiguration();
  if (!configuration || !code) return callbackPage(state.origin, false, 'Configuração ou código de autorização ausente.');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: configuration.oauth_client_id || '',
      client_secret: decryptSecret(configuration.oauth_client_secret_encrypted),
      redirect_uri: googleCalendarRedirectUri(),
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.refresh_token) {
    return callbackPage(state.origin, false, token.error_description || 'O Google não retornou uma autorização permanente.');
  }
  let connectedEmail = '';
  if (token.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(String(token.id_token).split('.')[1], 'base64url').toString('utf8'));
      connectedEmail = String(payload.email || '');
    } catch {}
  }
  const { error } = await serviceClient()
    .from('google_calendar_integrations')
    .update({
      refresh_token_encrypted: encryptSecret(String(token.refresh_token)),
      connected_email: connectedEmail || null,
      connected_at: new Date().toISOString(),
      updated_by: state.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) return callbackPage(state.origin, false, error.message);
  return callbackPage(state.origin, true, `A agenda de ${connectedEmail || 'Google'} foi autorizada com sucesso.`);
}

