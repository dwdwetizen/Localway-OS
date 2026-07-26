'use client';

import React, { createContext, FormEvent, useContext, useEffect, useRef, useState } from 'react';
import { LockKeyhole, Sparkles, UserRound, X } from 'lucide-react';
import { supabase, supabaseConfigurationError } from '@/lib/supabase';

export type AuthProfile = {
  id: string;
  email: string;
  username: string;
  nome: string | null;
  role: string | null;
  permissions: string[] | null;
  is_active: boolean;
  photo_url: string | null;
};

type RememberedAccount = {
  username: string;
  nome: string | null;
};

const rememberedAccountsKey = 'localway-remembered-usernames';
const AuthProfileContext = createContext<AuthProfile | null>(null);

function readRememberedAccounts(): RememberedAccount[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(rememberedAccountsKey) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter(item => item && typeof item.username === 'string').slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

export function useAuthProfile() {
  const profile = useContext(AuthProfileContext);
  if (!profile) throw new Error('Perfil autenticado não disponível.');
  return profile;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(() => !supabase);
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>([]);
  const passwordInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setRememberedAccounts(readRememberedAccounts()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const validate = async () => {
      const { data } = await client.auth.getSession();
      if (!data.session) {
        setProfile(null);
        setAuthenticated(false);
        setReady(true);
        return;
      }

      const { data: currentProfile } = await client
        .from('profiles')
        .select('id, email, username, nome, role, permissions, is_active, photo_url')
        .eq('id', data.session.user.id)
        .maybeSingle();
      if (!currentProfile?.is_active) {
        await client.auth.signOut({ scope: 'local' });
        setProfile(null);
        setMessage('Este usuário não está autorizado a acessar o Localway OS.');
        setAuthenticated(false);
        setReady(true);
        return;
      }

      let photoUrl: string | null = null;
      if (currentProfile.photo_url) {
        const signed = await client.storage.from('profile-photos').createSignedUrl(currentProfile.photo_url, 3600);
        photoUrl = signed.data?.signedUrl || null;
      }

      const nextProfile = { ...currentProfile, photo_url: photoUrl } as AuthProfile;
      setProfile(nextProfile);
      setAuthenticated(true);
      setPassword('');

      const account = { username: currentProfile.username, nome: currentProfile.nome };
      setRememberedAccounts(current => {
        const next = [
          account,
          ...current.filter(item => item.username.toLowerCase() !== account.username.toLowerCase()),
        ].slice(0, 6);
        window.localStorage.setItem(rememberedAccountsKey, JSON.stringify(next));
        return next;
      });
      setReady(true);
    };

    const refreshOnFocus = () => void validate();
    void validate();
    window.addEventListener('focus', refreshOnFocus);
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setProfile(null);
        setAuthenticated(false);
        setReady(true);
      } else {
        window.setTimeout(() => void validate(), 0);
      }
    });

    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      subscription.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return setMessage(supabaseConfigurationError());
    setSubmitting(true);
    setMessage('');

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    const result = await response.json().catch(() => ({ error: 'Não foi possível entrar.' }));
    if (!response.ok) {
      setSubmitting(false);
      setMessage(result.error || 'Usuário ou senha incorretos.');
      return;
    }

    const { error } = await supabase.auth.setSession({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });
    setSubmitting(false);
    if (error) setMessage('Não foi possível iniciar sua sessão. Tente novamente.');
  };

  const chooseAccount = (accountUsername: string) => {
    setUsername(accountUsername);
    setPassword('');
    setMessage('');
    window.setTimeout(() => passwordInput.current?.focus(), 0);
  };

  const forgetAccount = (accountUsername: string) => {
    setRememberedAccounts(current => {
      const next = current.filter(item => item.username.toLowerCase() !== accountUsername.toLowerCase());
      window.localStorage.setItem(rememberedAccountsKey, JSON.stringify(next));
      return next;
    });
    if (username.toLowerCase() === accountUsername.toLowerCase()) {
      setUsername('');
      setPassword('');
    }
  };

  if (!ready) {
    return <div className="min-h-screen grid place-items-center text-sm text-[#727687]">Carregando…</div>;
  }
  if (authenticated && profile) {
    return <AuthProfileContext.Provider value={profile}>{children}</AuthProfileContext.Provider>;
  }

  return (
    <main className="min-h-screen grid place-items-center bg-[#fbf8ff] dark:bg-[#0a0e27] p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-xl p-7 space-y-5">
        <div className="text-center space-y-2">
          <div className="mx-auto w-11 h-11 grid place-items-center rounded-xl bg-[#0066ff] text-white"><Sparkles className="w-5 h-5" /></div>
          <h1 className="font-bold text-xl">Localway OS</h1>
          <p className="text-xs text-[#727687]">Acesso da equipe comercial</p>
        </div>

        {!!rememberedAccounts.length && (
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-[#727687] mb-2">Contas recentes</p>
            <div className="space-y-2">
              {rememberedAccounts.map(account => (
                <div key={account.username} className={`flex items-center gap-2 rounded-xl border p-2 ${username.toLowerCase() === account.username.toLowerCase() ? 'border-[#0066ff] bg-[#0066ff]/5' : 'border-[#c2c6d8]/30'}`}>
                  <button type="button" onClick={() => chooseAccount(account.username)} className="flex flex-1 min-w-0 items-center gap-2 text-left">
                    <span className="w-8 h-8 rounded-full bg-[#0066ff]/10 text-[#0066ff] grid place-items-center font-bold text-xs"><UserRound className="w-4 h-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold truncate">{account.nome || 'Usuário'}</span>
                      <span className="block text-[10px] text-[#727687] truncate">@{account.username}</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => forgetAccount(account.username)} className="p-1.5 text-[#727687] hover:text-rose-600 rounded-lg" title="Esquecer esta conta" aria-label={`Esquecer ${account.username}`}><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!supabase && <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">{supabaseConfigurationError()}</p>}
        <label className="block text-xs font-semibold">
          Nome de usuário
          <input required autoComplete="username" value={username} onChange={event => setUsername(event.target.value.toLowerCase())} className="mt-1 w-full p-2.5 rounded-xl border border-[#c2c6d8]/40 bg-[#f4f2fd] text-sm" />
        </label>
        <label className="block text-xs font-semibold">
          Senha
          <input ref={passwordInput} required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-[#c2c6d8]/40 bg-[#f4f2fd] text-sm" />
        </label>
        <p className="text-[10px] text-[#727687]">O nome de usuário fica lembrado. A senha nunca é exibida nem armazenada pelo aplicativo.</p>
        {message && <p className="text-xs text-rose-600">{message}</p>}
        <button disabled={submitting || !supabase} className="w-full flex justify-center items-center gap-2 p-2.5 rounded-xl bg-[#0066ff] hover:bg-[#0050cb] disabled:opacity-50 text-white text-xs font-bold">
          <LockKeyhole className="w-4 h-4" />{submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
