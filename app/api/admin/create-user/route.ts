import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !anon && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !service && 'SUPABASE_SERVICE_ROLE_KEY',
    !token && 'sessão de administrador',
  ].filter(Boolean);
  if (missing.length) return NextResponse.json({ error: `Falta: ${missing.join(', ')}.` }, { status: 500 });
  const caller = createClient(url!, anon!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: current } = await caller.auth.getUser(token!);
  if (!current.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  const admin = createClient(url!, service!);
  const { data: profile } = await admin.from('profiles').select('role').eq('id', current.user.id).single();
  const normalizedRole = profile?.role?.trim().toLowerCase();
  if (normalizedRole !== 'administrador' && normalizedRole !== 'admin') return NextResponse.json({ error: 'Apenas administradores podem criar usuários.' }, { status: 403 });
  const { email, password, nome, role, permissions } = await request.json();
  if (!email || !password || !nome || !role) return NextResponse.json({ error: 'Preencha nome, e-mail, senha e cargo.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return NextResponse.json({ error: error?.message || 'Não foi possível criar o login.' }, { status: 400 });
  const { error: profileError } = await admin.from('profiles').upsert({ id: data.user.id, email, nome, role, permissions });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
