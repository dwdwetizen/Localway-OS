'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

type Props = {
  children: React.ReactNode;
  moduleName: string;
};

type State = {
  error: Error | null;
};

export class ModuleErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`Falha no módulo ${this.props.moduleName}`, error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="min-h-[360px] rounded-2xl border border-amber-200 bg-white dark:bg-[#141936] p-6 sm:p-10 grid place-items-center text-center shadow-sm">
        <div className="max-w-md">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Não foi possível carregar {this.props.moduleName}</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#727687]">
            A tela principal continua funcionando. Tente abrir este módulo novamente.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0066ff] px-5 text-xs font-semibold text-white hover:bg-[#0050cb]"
          >
            <RotateCcw className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }
}
