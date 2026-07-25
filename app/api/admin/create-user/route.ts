import { NextRequest, NextResponse } from 'next/server';

async function proxyUserManagement(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get('authorization') || '';

  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !publishableKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !authorization && 'sessão de administrador',
  ].filter(Boolean);

  if (missing.length) {
    return NextResponse.json(
      { error: `Falta: ${missing.join(', ')}.` },
      { status: 500 }
    );
  }

  const response = await fetch(`${url}/functions/v1/admin-create-user`, {
    method: request.method,
    headers: {
      apikey: publishableKey!,
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: await request.text(),
    cache: 'no-store',
  });

  const result = await response.json().catch(() => ({
    error: 'A função de criação de usuários não respondeu corretamente.',
  }));

  return NextResponse.json(result, { status: response.status });
}

export async function POST(request: NextRequest) {
  return proxyUserManagement(request);
}

export async function DELETE(request: NextRequest) {
  return proxyUserManagement(request);
}
