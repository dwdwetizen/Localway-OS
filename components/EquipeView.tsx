'use client';

import React from 'react';
import { Users, Award, TrendingUp, Phone, CalendarCheck, DollarSign } from 'lucide-react';

interface EquipeViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export function EquipeView({ onShowToast }: EquipeViewProps) {
  const teamMembers = [
    { name: 'Ricardo Silva', role: 'Diretor Comercial', leads: 140, meetings: 18, sales: 'R$ 22.500,00', rank: 1 },
    { name: 'Ana Martins', role: 'SDR Senior', leads: 185, meetings: 24, sales: 'R$ 18.000,00', rank: 2 },
    { name: 'Felipe Prates', role: 'Executivo de Vendas', leads: 95, meetings: 12, sales: 'R$ 14.500,00', rank: 3 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
            Performance da Equipe de Vendas
          </h2>
          <p className="text-xs text-[#727687]">
            Métricas individuais de prospecção, agendamentos e fechamento por vendedor
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#f4f2fd] dark:bg-[#10142e] text-[#727687] font-bold uppercase border-b border-[#c2c6d8]/30">
            <tr>
              <th className="p-4">Rank</th>
              <th className="p-4">Vendedor / Colaborador</th>
              <th className="p-4">Cargo</th>
              <th className="p-4">Leads Abordados</th>
              <th className="p-4">Reuniões Marcadas</th>
              <th className="p-4">Vendas Convertidas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#c2c6d8]/20 dark:divide-[#2e366b]">
            {teamMembers.map((m) => (
              <tr key={m.rank} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                <td className="p-4 font-bold">
                  <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-white font-black text-xs ${
                    m.rank === 1 ? 'bg-amber-500' : m.rank === 2 ? 'bg-gray-400' : 'bg-amber-700'
                  }`}>
                    #{m.rank}
                  </span>
                </td>
                <td className="p-4 font-bold text-[#1a1b22] dark:text-[#f8f7ff]">{m.name}</td>
                <td className="p-4 text-[#727687]">{m.role}</td>
                <td className="p-4 font-bold">{m.leads}</td>
                <td className="p-4 font-bold text-purple-600">{m.meetings}</td>
                <td className="p-4 font-bold text-emerald-600 font-poppins">{m.sales}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
