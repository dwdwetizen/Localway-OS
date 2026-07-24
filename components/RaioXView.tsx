'use client';

import React, { useState } from 'react';
import { Crosshair, Star, CheckCircle2, XCircle, Sparkles, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';

interface RaioXViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiPitchModal: (companyName: string) => void;
}

export function RaioXView({ onShowToast, onOpenAiPitchModal }: RaioXViewProps) {
  const [radius, setRadius] = useState('3km');

  const competitors = [
    { name: 'Padaria & Confeitaria Silva (Sua Empresa)', rating: 4.2, reviews: 148, photos: 32, postsMonth: 2, responseRate: '45%', isUs: true },
    { name: 'Panificadora Bella Moinho', rating: 4.8, reviews: 420, photos: 110, postsMonth: 8, responseRate: '98%', isUs: false },
    { name: 'Padaria Real Centro', rating: 4.5, reviews: 290, photos: 85, postsMonth: 5, responseRate: '82%', isUs: false },
    { name: 'Empório & Pães Gourmet', rating: 3.8, reviews: 65, photos: 14, postsMonth: 0, responseRate: '15%', isUs: false },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center font-bold">
            <Crosshair className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
              Raio-X Local & Radar Competitivo
            </h2>
            <p className="text-xs text-[#727687]">
              Comparativo direto frente aos principais concorrentes em um raio de {radius}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#727687]">Raio de Análise:</span>
          {['1km', '3km', '5km'].map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                radius === r
                  ? 'bg-[#0066ff] text-white shadow-sm'
                  : 'bg-[#f4f2fd] dark:bg-[#10142e] text-[#727687] hover:text-[#1a1b22]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Side-by-side Comparative Table */}
      <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] overflow-hidden shadow-sm">
        <div className="p-4 bg-[#f4f2fd] dark:bg-[#10142e] border-b border-[#c2c6d8]/30 font-bold text-xs text-[#1a1b22] dark:text-[#f8f7ff]">
          Matriz de Benchmark GBP na Região
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/40 text-[#727687] font-bold border-b border-[#c2c6d8]/20">
              <tr>
                <th className="p-4">Empresa</th>
                <th className="p-4">Rating Google</th>
                <th className="p-4">Avaliações</th>
                <th className="p-4">Qtd. Fotos</th>
                <th className="p-4">Posts / Mês</th>
                <th className="p-4">% Resp. Reviews</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c2c6d8]/20 dark:divide-[#2e366b]">
              {competitors.map((comp, idx) => (
                <tr
                  key={idx}
                  className={comp.isUs ? 'bg-[#0066ff]/10 dark:bg-[#0066ff]/20 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}
                >
                  <td className="p-4 font-bold text-[#1a1b22] dark:text-[#f8f7ff] flex items-center gap-2">
                    {comp.name}
                    {comp.isUs && (
                      <span className="text-[9px] bg-[#0066ff] text-white px-2 py-0.5 rounded font-extrabold uppercase">
                        Sua Empresa
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="flex items-center gap-1 font-bold text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-amber-400" /> {comp.rating}
                    </span>
                  </td>
                  <td className="p-4">{comp.reviews}</td>
                  <td className="p-4">{comp.photos}</td>
                  <td className="p-4 font-bold">{comp.postsMonth}</td>
                  <td className="p-4 font-bold text-[#0066ff]">{comp.responseRate}</td>
                  <td className="p-4 text-right">
                    {!comp.isUs ? (
                      <button
                        onClick={() => onOpenAiPitchModal(comp.name)}
                        className="px-3 py-1.5 bg-[#0066ff] text-white rounded-lg font-bold text-[11px] hover:bg-[#0050cb]"
                      >
                        Atacar com Pitch IA
                      </button>
                    ) : (
                      <span className="text-emerald-600 font-bold">Monitorando</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
