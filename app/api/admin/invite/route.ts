import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!url || !anon || !service || !token) return NextResponse.json({ error: 'Configuração de convite incompleta.' }, { status: 500 });
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: current } = await caller.auth.getUser(token);
  if (!current.user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  const admin = createClient(url, service);
  const { data: profile } = await admin.from('profiles').select('role').eq('id', current.user.id).single();
  if (profile?.role !== 'Administrador') return NextResponse.json({ error: 'Apenas administradores podem criar usuários.' }, { status: 403 });
  const body = await request.json();
  const { email, nome, role, permissions } = body;
  if (!email || !nome || !role) return NextResponse.json({ error: 'Preencha e-mail, nome e cargo.' }, { status: 400 });
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error || !data.user) return NextResponse.json({ error: error?.message || 'Não foi possível enviar o convite.' }, { status: 400 });
  const { error: profileError } = await admin.from('profiles').upsert({ id: data.user.id, email, nome, role, permissions });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
