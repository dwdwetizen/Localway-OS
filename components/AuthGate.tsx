'use client';

import React, { createContext, FormEvent, useContext, useEffect, useState } from 'react';
import { LockKeyhole, Sparkles } from 'lucide-react';
import { supabase, supabaseConfigurationError } from '@/lib/supabase';

export type AuthProfile = {
  id: string;
  role: string | null;
  permissions: string[] | null;
};

const AuthProfileContext = createContext<AuthProfile | null>(null);

export function useAuthProfile() {
  const profile = useContext(AuthProfileContext);
  if (!profile) throw new Error('Perfil autenticado não disponível.');
  return profile;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(() => !supabase); const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState(''); const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const validate = async () => { const { data } = await client.auth.getSession(); if (!data.session) { setProfile(null); setAuthenticated(false); setReady(true); return; } const { data: currentProfile } = await client.from('profiles').select('id, role, permissions').eq('id', data.session.user.id).maybeSingle(); if (!currentProfile) { await client.auth.signOut(); setProfile(null); setMessage('Este e-mail não está autorizado a acessar o LocalWay OS.'); setAuthenticated(false); } else { setProfile(currentProfile as AuthProfile); setAuthenticated(true); } setReady(true); };
    void validate(); const { data: subscription } = client.auth.onAuthStateChange((_event, session) => { if (!session) { setProfile(null); setAuthenticated(false); } else window.setTimeout(() => void validate(), 0); }); return () => subscription.subscription.unsubscribe();
  }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!supabase) return setMessage(supabaseConfigurationError()); setSubmitting(true); setMessage(''); const { error } = await supabase.auth.signInWithPassword({ email, password }); setSubmitting(false); if (error) setMessage('Não foi possível entrar. Confira seu e-mail e senha.'); };
  const google = async () => { if (!supabase) return setMessage(supabaseConfigurationError()); setSubmitting(true); setMessage(''); const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }); if (error) { setSubmitting(false); setMessage('Não foi possível abrir o login com Google.'); } };
  if (!ready) return <div className="min-h-screen grid place-items-center text-sm text-[#727687]">Carregando…</div>;
  if (authenticated && profile) return <AuthProfileContext.Provider value={profile}>{children}</AuthProfileContext.Provider>;
  return <main className="min-h-screen grid place-items-center bg-[#fbf8ff] dark:bg-[#0a0e27] p-4"><form onSubmit={submit} className="w-full max-w-sm bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-xl p-7 space-y-5"><div className="text-center space-y-2"><div className="mx-auto w-11 h-11 grid place-items-center rounded-xl bg-[#0066ff] text-white"><Sparkles className="w-5 h-5"/></div><h1 className="font-bold text-xl">LocalWay OS</h1><p className="text-xs text-[#727687]">Acesso da equipe comercial</p></div>{!supabase && <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">{supabaseConfigurationError()}</p>}<label className="block text-xs font-semibold">E-mail<input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-[#c2c6d8]/40 bg-[#f4f2fd] text-sm"/></label><label className="block text-xs font-semibold">Senha<input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-[#c2c6d8]/40 bg-[#f4f2fd] text-sm"/></label>{message && <p className="text-xs text-rose-600">{message}</p>}<button disabled={submitting || !supabase} className="w-full flex justify-center items-center gap-2 p-2.5 rounded-xl bg-[#0066ff] hover:bg-[#0050cb] disabled:opacity-50 text-white text-xs font-bold"><LockKeyhole className="w-4 h-4"/>{submitting ? 'Entrando…' : 'Entrar'}</button><div className="flex items-center gap-2 text-[10px] text-[#727687]"><span className="h-px flex-1 bg-[#c2c6d8]/40"/>ou<span className="h-px flex-1 bg-[#c2c6d8]/40"/></div><button type="button" onClick={() => void google()} disabled={submitting || !supabase} className="w-full flex justify-center items-center gap-2 p-2.5 rounded-xl border border-[#c2c6d8]/50 hover:bg-[#f4f2fd] disabled:opacity-50 text-xs font-bold"><span className="font-black text-base text-[#4285F4]">G</span>Continuar com Google</button></form></main>;
}
