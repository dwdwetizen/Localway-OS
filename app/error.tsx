'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';

function isCachedDeploymentError(error: Error) {
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|module factory is not available|CSS_CHUNK_LOAD_FAILED/i
    .test(`${error.name} ${error.message}`);
}

async function clearTemporaryAppFiles() {
  try {
    window.sessionStorage.removeItem('localway-client-recovery');
  } catch {
    // Continue when temporary storage is unavailable.
  }
  try {
    if ('caches' in window) {
      const names = await window.caches.keys();
      await Promise.all(names.map(name => window.caches.delete(name)));
    }
  } catch {
    // A cache-busted navigation below is still safe.
  }
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }
  } catch {
    // The app currently does not require a service worker.
  }
}

async function hardRefresh() {
  await clearTemporaryAppFiles();
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('_versao', String(Date.now()));
  window.location.replace(nextUrl.toString());
}

function clearLocalSession() {
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // A reload will still allow recovery in restricted browsers.
  }
  window.location.replace(`/?_nova_sessao=${Date.now()}`);
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const cachedDeploymentError = isCachedDeploymentError(error);

  useEffect(() => {
    console.error('Localway OS client error', error);
  }, [error]);

  return (
    <main className="min-h-screen grid place-items-center bg-[#fbf8ff] dark:bg-[#0a0e27] p-5">
      <section className="w-full max-w-md rounded-2xl border border-[#c2c6d8]/40 dark:border-[#2e366b] bg-white dark:bg-[#141936] p-7 text-center shadow-xl">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold">
          {cachedDeploymentError ? 'O aplicativo precisa ser atualizado' : 'Não foi possível abrir esta tela'}
        </h1>
        <p className="mt-2 text-sm text-[#727687]">
          {cachedDeploymentError
            ? 'Uma versão antiga ficou guardada neste navegador. Seus dados continuam seguros.'
            : 'Seus dados continuam seguros. Atualize os arquivos temporários do aplicativo e tente novamente.'}
        </p>
        <div className="mt-6 grid gap-2">
          <button
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              reset();
              void hardRefresh();
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0066ff] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando…' : 'Atualizar aplicativo'}
          </button>
          <button
            onClick={clearLocalSession}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#c2c6d8]/50 px-4 py-3 text-sm font-semibold text-[#424656] dark:text-[#d9dcf0]"
          >
            <LogOut className="h-4 w-4" />
            Sair e entrar novamente
          </button>
        </div>
        {error.digest && <p className="mt-4 text-[10px] text-[#9296a8]">Código: {error.digest}</p>}
      </section>
    </main>
  );
}
