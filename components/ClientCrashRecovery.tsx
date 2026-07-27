'use client';

import { useEffect } from 'react';

const recoveryKey = 'localway-client-recovery';

function isDeploymentAssetError(reason: unknown) {
  const message = reason instanceof Error
    ? `${reason.name} ${reason.message}`
    : String(reason || '');

  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|module factory is not available|CSS_CHUNK_LOAD_FAILED/i.test(message);
}

function recoverOnce() {
  try {
    const lastRecovery = Number(window.sessionStorage.getItem(recoveryKey) || 0);
    if (Date.now() - lastRecovery < 30_000) return;
    window.sessionStorage.setItem(recoveryKey, String(Date.now()));
  } catch {
    // Some privacy modes block sessionStorage. Reloading is still safe.
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('_atualizado', String(Date.now()));
  window.location.replace(nextUrl.toString());
}

export function ClientCrashRecovery() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (isDeploymentAssetError(event.error || event.message)) recoverOnce();
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isDeploymentAssetError(event.reason)) recoverOnce();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
