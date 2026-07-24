'use client';

import React from 'react';
import { HelpCircle, X, ExternalLink, Mail, PhoneCall, BookOpen } from 'lucide-react';

interface SupportModalProps {
  onClose: () => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export function SupportModal({ onClose, onShowToast }: SupportModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/40 dark:border-[#2e366b] max-w-md w-full p-6 shadow-2xl space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-[#0066ff]">
          <HelpCircle className="w-5 h-5" />
          <h3 className="font-bold font-poppins text-lg text-[#1a1b22] dark:text-[#f8f7ff]">
            Suporte & Central de Ajuda
          </h3>
        </div>

        <p className="text-xs text-[#727687]">
          Precisa de auxílio na gestão dos seus perfis Google Business Profile ou na configuração das chaves de IA?
        </p>

        <div className="space-y-3 pt-2">
          <div className="p-3 bg-[#f4f2fd] dark:bg-[#10142e] rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0066ff]" />
              <span className="font-bold text-[#1a1b22] dark:text-[#f8f7ff]">Documentação das APIs</span>
            </div>
            <a
              href="https://developers.google.com/my-business"
              target="_blank"
              rel="noreferrer"
              className="text-[#0066ff] font-bold flex items-center gap-1 hover:underline"
            >
              Acessar <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="p-3 bg-[#f4f2fd] dark:bg-[#10142e] rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-[#1a1b22] dark:text-[#f8f7ff]">Atendimento via E-mail</span>
            </div>
            <span className="text-[#727687]">suporte@localway.com.br</span>
          </div>
        </div>

        <button
          onClick={() => {
            onShowToast('Solicitação de suporte priorizada aberta com sucesso!');
            onClose();
          }}
          className="w-full py-2.5 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs rounded-xl shadow"
        >
          Abrir Chamado Prioritário
        </button>
      </div>
    </div>
  );
}
