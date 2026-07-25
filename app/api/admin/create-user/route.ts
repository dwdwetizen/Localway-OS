import { NextRequest, NextResponse } from 'next/server';

type CreatedUser = {
  id: string;
  email?: string;
};

type CreatedUserResponse = CreatedUser | {
  user: CreatedUser;
};

function serviceHeaders(serviceKey: string, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set('apikey', serviceKey);
  headers.set('Content-Type', 'application/json');

  // Legacy service_role keys are JWTs. Modern sb_secret keys must be sent
  // only as apikey so the Supabase gateway can authenticate them correctly.
  if (!serviceKey.startsWith('sb_secret_')) {
    headers.set('Authorization', `Bearer ${serviceKey}`);
  }

  return headers;
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.msg || body?.message || body?.error_description || body?.error || fallback;
}

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !publishableKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !serviceKey && 'SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY',
    !token && 'sessão de administrador',
  ].filter(Boolean);

  if (missing.length) {
    return NextResponse.json(
      { error: `Falta: ${missing.join(', ')}.` },
      { status: 500 }
    );
  }

  // Validate the logged-in administrator with their real user JWT.
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: publishableKey!,
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!userResponse.ok) {
    return NextResponse.json(
      { error: 'Sua sessão expirou. Saia do aplicativo, entre novamente e tente criar o usuário.' },
      { status: 401 }
    );
  }

  const currentUser = (await userResponse.json()) as CreatedUser;

  // Use only the server key to read the caller's role.
  const profileResponse = await fetch(
    `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(currentUser.id)}&select=role`,
    {
      headers: serviceHeaders(serviceKey!),
      cache: 'no-store',
    }
  );

  if (!profileResponse.ok) {
    return NextResponse.json(
      { error: await responseError(profileResponse, 'Não foi possível validar o administrador.') },
      { status: profileResponse.status }
    );
  }

  const profiles = (await profileResponse.json()) as Array<{ role?: string | null }>;
  const normalizedRole = profiles[0]?.role?.trim().toLowerCase();

  if (normalizedRole !== 'administrador' && normalizedRole !== 'admin') {
    return NextResponse.json(
      { error: 'Apenas administradores podem criar usuários.' },
      { status: 403 }
    );
  }

  const { email, password, nome, role, permissions } = await request.json();

  if (!email || !password || !nome || !role) {
    return NextResponse.json(
      { error: 'Preencha nome, e-mail, senha e cargo.' },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'A senha deve ter pelo menos 8 caracteres.' },
      { status: 400 }
    );
  }

  const createResponse = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceHeaders(serviceKey!),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
    cache: 'no-store',
  });

  if (!createResponse.ok) {
    return NextResponse.json(
      { error: await responseError(createResponse, 'Não foi possível criar o login.') },
      { status: createResponse.status }
    );
  }

  const createdBody = (await createResponse.json()) as CreatedUserResponse;
  const createdUser = 'user' in createdBody ? createdBody.user : createdBody;
  const profileUpsertResponse = await fetch(
    `${url}/rest/v1/profiles?on_conflict=id`,
    {
      method: 'POST',
      headers: serviceHeaders(serviceKey!, {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify({
        id: createdUser.id,
        email,
        nome,
        role,
        permissions,
      }),
      cache: 'no-store',
    }
  );

  if (!profileUpsertResponse.ok) {
    // Avoid leaving an unusable Auth account when profile creation fails.
    await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(createdUser.id)}`, {
      method: 'DELETE',
      headers: serviceHeaders(serviceKey!),
      cache: 'no-store',
    });

    return NextResponse.json(
      { error: await responseError(profileUpsertResponse, 'O login foi revertido porque o perfil não pôde ser criado.') },
      { status: profileUpsertResponse.status }
    );
  }

  return NextResponse.json({ ok: true });
}
