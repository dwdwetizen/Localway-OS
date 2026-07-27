'use client';

import React, { useState } from 'react';
import { MessageSquare, Star, Sparkles, Filter, CheckCircle2 } from 'lucide-react';

interface AvaliacoesViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiReviewModal: (companyName: string, reviewerName: string, reviewText: string) => void;
}

export function AvaliacoesView({ onShowToast, onOpenAiReviewModal }: AvaliacoesViewProps) {
  const [filterRating, setFilterRating] = useState('all');

  const reviewsList = [
    {
      id: 'r1',
      company: 'Padaria & Confeitaria Silva',
      reviewer: 'Juliana Costa',
      rating: 2,
      date: 'Ontem',
      text: 'Pães deliciosos, porém o atendimento ao cliente no balcão pela manhã demorou mais de 20 minutos.',
      responded: false,
    },
    {
      id: 'r2',
      company: 'Clínica Sorriso Premium',
      reviewer: 'Ricardo Alencar',
      rating: 5,
      date: 'Há 2 dias',
      text: 'Experiência perfeita no clareamento dental. Equipe atenciosa e ambiente limpo.',
      responded: true,
    },
    {
      id: 'r3',
      company: 'Auto Center Radial',
      reviewer: 'Carlos Eduardo',
      rating: 1,
      date: 'Há 3 dias',
      text: 'Atrasou a entrega do alinhamento do carro em 2 horas sem aviso prévio.',
      responded: false,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
            Gestão Unificada de Avaliações Google
          </h2>
          <p className="text-xs text-[#727687]">
            Centralização de reviews recebidos com resposta automatizada via IA em tempo real
          </p>
        </div>

        <button
          onClick={() => onShowToast('Regras de auto-resposta por IA ativadas para todas as contas GBP!')}
          className="w-full md:w-auto min-h-11 flex items-center justify-center gap-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all"
        >
          <Sparkles className="w-4 h-4" /> Ativar Auto-Resposta IA em Lote
        </button>
      </div>

      <div className="space-y-4">
        {reviewsList.map((rev) => (
          <div
            key={rev.id}
            className="p-5 bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#0066ff] bg-[#0066ff]/10 px-2 py-0.5 rounded uppercase">
                {rev.company}
              </span>
              <div className="flex items-center gap-2 pt-1">
                <span className="font-bold text-xs text-[#1a1b22] dark:text-[#f8f7ff]">{rev.reviewer}</span>
                <div className="flex text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-amber-400' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-[#727687]">{rev.date}</span>
              </div>
              <p className="text-xs text-[#424656] dark:text-[#b0b4ce]">&quot;{rev.text}&quot;</p>
            </div>

            <div>
              {!rev.responded ? (
                <button
                  onClick={() => onOpenAiReviewModal(rev.company, rev.reviewer, rev.text)}
                  className="w-full md:w-auto min-h-11 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs rounded-xl shadow transition-all"
                >
                  <Sparkles className="w-4 h-4" /> Responder com IA
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Respondida
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
