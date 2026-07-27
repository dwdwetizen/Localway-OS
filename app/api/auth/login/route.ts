import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !publishableKey || !secretKey) {
    return NextResponse.json(
      { error: 'Configuração interna de autenticação incompleta.' },
      { status: 500, headers: noStoreHeaders },
    );
  }

  let payload: { username?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Informe o nome de usuário e a senha.' },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const login = payload.username?.trim().toLowerCase() || '';
  const password = payload.password || '';
  if (!login || !password) {
    return NextResponse.json(
      { error: 'Informe o nome de usuário e a senha.' },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const profileQuery = admin
    .from('profiles')
    .select('email, is_active');
  const { data: profile, error: profileError } = login.includes('@')
    ? await profileQuery.ilike('email', login).maybeSingle()
    : await profileQuery.ilike('username', login).maybeSingle();

  if (profileError || !profile?.is_active) {
    return NextResponse.json(
      { error: 'Usuário ou senha incorretos.' },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const authClient = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: 'Usuário ou senha incorretos.' },
      { status: 401, headers: noStoreHeaders },
    );
  }

  return NextResponse.json(
    {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
    { headers: noStoreHeaders },
  );
}
