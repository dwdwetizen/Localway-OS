'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole, Sparkles } from 'lucide-react';
import { supabase, supabaseConfigurationError } from '@/lib/supabase';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    void supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(Boolean(data.session));
      setReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => setAuthenticated(Boolean(session)));
    return () => subscription.subscription.unsubscribe();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return setMessage(supabaseConfigurationError());
    setSubmitting(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) setMessage('Não foi possível entrar. Confira seu e-mail e senha.');
  };

  if (!ready) return <div className="min-h-screen grid place-items-center text-sm text-[#727687]">Carregando…</div>;
  if (authenticated) return <>{children}</>;

  return <main className="min-h-screen grid place-items-center bg-[#fbf8ff] dark:bg-[#0a0e27] p-4">
    <form onSubmit={submit} className="w-full max-w-sm bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-xl p-7 space-y-5">
      <div className="text-center space-y-2"><div className="mx-auto w-11 h-11 grid place-items-center rounded-xl bg-[#0066ff] text-white"><Sparkles className="w-5 h-5" /></div><h1 className="font-bold text-xl">LocalWay OS</h1><p className="text-xs text-[#727687]">Acesso da equipe comercial</p></div>
      {!supabase && <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">{supabaseConfigurationError()}</p>}
      <label className="block text-xs font-semibold">E-mail<input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-[#c2c6d8]/40 bg-[#f4f2fd] text-sm" /></label>
      <label className="block text-xs font-semibold">Senha<input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-[#c2c6d8]/40 bg-[#f4f2fd] text-sm" /></label>
      {message && <p className="text-xs text-rose-600">{message}</p>}
      <button disabled={submitting || !supabase} className="w-full flex justify-center items-center gap-2 p-2.5 rounded-xl bg-[#0066ff] hover:bg-[#0050cb] disabled:opacity-50 text-white text-xs font-bold"><LockKeyhole className="w-4 h-4" />{submitting ? 'Entrando…' : 'Entrar'}</button>
    </form>
  </main>;
}
