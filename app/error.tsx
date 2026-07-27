'use client';

import { useEffect } from 'react';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';

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
  useEffect(() => {
    console.error('Localway OS client error', error);
  }, [error]);

  return (
    <main className="min-h-screen grid place-items-center bg-[#fbf8ff] dark:bg-[#0a0e27] p-5">
      <section className="w-full max-w-md rounded-2xl border border-[#c2c6d8]/40 dark:border-[#2e366b] bg-white dark:bg-[#141936] p-7 text-center shadow-xl">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold">O aplicativo precisa ser atualizado</h1>
        <p className="mt-2 text-sm text-[#727687]">
          Uma versão antiga ficou guardada neste navegador. Seus dados continuam seguros.
        </p>
        <div className="mt-6 grid gap-2">
          <button
            onClick={() => {
              reset();
              window.location.replace(`/?_atualizado=${Date.now()}`);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0066ff] px-4 py-3 text-sm font-bold text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar aplicativo
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
