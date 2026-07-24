'use client';

import React, { useState } from 'react';
import {
  Kanban,
  Table as TableIcon,
  MapPin,
  Plus,
  Zap,
  Sparkles,
  DollarSign,
  TrendingUp,
  Phone,
  Calendar,
  MoreVertical,
  ChevronRight,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';

interface CrmViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiPitchModal: (companyName: string) => void;
}

export interface Deal {
  id: string;
  companyName: string;
  contactName: string;
  category: string;
  value: number;
  stage: 'prospeccao' | 'qualificacao' | 'proposta' | 'negociacao' | 'fechado' | 'perdido';
  aiScore: number;
  daysInStage: number;
}

export function CrmView({ onShowToast, onOpenAiPitchModal }: CrmViewProps) {
  const [viewMode, setViewMode] = useState<'kanban' | 'tabela'>('kanban');

  const [deals, setDeals] = useState<Deal[]>([
    {
      id: '1',
      companyName: 'Padaria & Confeitaria Silva',
      contactName: 'Carlos Silva',
      category: 'Alimentação',
      value: 1800,
      stage: 'prospeccao',
      aiScore: 88,
      daysInStage: 2,
    },
    {
      id: '2',
      companyName: 'Clínica Sorriso Premium',
      contactName: 'Dra. Patricia',
      category: 'Saúde & Odonto',
      value: 3500,
      stage: 'qualificacao',
      aiScore: 94,
      daysInStage: 1,
    },
    {
      id: '3',
      companyName: 'Auto Center Radial',
      contactName: 'Roberto Mello',
      category: 'Automotivo',
      value: 2400,
      stage: 'proposta',
      aiScore: 78,
      daysInStage: 4,
    },
    {
      id: '4',
      companyName: 'Imobiliária Central Norte',
      contactName: 'Fernanda Lima',
      category: 'Imóveis',
      value: 4800,
      stage: 'negociacao',
      aiScore: 91,
      daysInStage: 3,
    },
    {
      id: '5',
      companyName: 'Restaurante Sabor & Arte',
      contactName: 'Chef Henrique',
      category: 'Gastronomia',
      value: 2200,
      stage: 'fechado',
      aiScore: 98,
      daysInStage: 7,
    },
  ]);

  const stages = [
    { id: 'prospeccao', label: 'Prospecção', color: 'border-blue-500 text-blue-600' },
    { id: 'qualificacao', label: 'Qualificação', color: 'border-purple-500 text-purple-600' },
    { id: 'proposta', label: 'Proposta Enviada', color: 'border-amber-500 text-amber-600' },
    { id: 'negociacao', label: 'Em Negociação', color: 'border-orange-500 text-orange-600' },
    { id: 'fechado', label: 'Fechado (Ganho)', color: 'border-emerald-500 text-emerald-600' },
  ] as const;

  const moveDealNext = (dealId: string) => {
    setDeals(prev =>
      prev.map(d => {
        if (d.id !== dealId) return d;
        const currentIdx = stages.findIndex(s => s.id === d.stage);
        if (currentIdx < stages.length - 1) {
          const nextStage = stages[currentIdx + 1].id;
          onShowToast(`Lead "${d.companyName}" movido para ${stages[currentIdx + 1].label}!`);
          return { ...d, stage: nextStage };
        }
        return d;
      })
    );
  };

  const totalPipeline = deals.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Summary Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
            CRM & Pipeline de Vendas
          </h2>
          <p className="text-xs text-[#727687]">
            Gestão inteligente de oportunidades com scoring preditivo de fechamento por IA
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="flex items-center bg-[#f4f2fd] dark:bg-[#10142e] p-1 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b]">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-[#1d234a] text-[#0066ff] shadow-sm'
                  : 'text-[#727687] hover:text-[#1a1b22]'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              onClick={() => setViewMode('tabela')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'tabela'
                  ? 'bg-white dark:bg-[#1d234a] text-[#0066ff] shadow-sm'
                  : 'text-[#727687] hover:text-[#1a1b22]'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" /> Tabela
            </button>
          </div>

          <button
            onClick={() => {
              const newName = prompt('Nome da empresa para novo negócio:');
              if (newName) {
                setDeals(prev => [
                  ...prev,
                  {
                    id: String(Date.now()),
                    companyName: newName,
                    contactName: 'Contato Geral',
                    category: 'Comércio Local',
                    value: 2000,
                    stage: 'prospeccao',
                    aiScore: 82,
                    daysInStage: 0,
                  },
                ]);
                onShowToast(`Novo negócio para "${newName}" adicionado ao pipeline!`);
              }
            }}
            className="flex items-center gap-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Novo Negócio
          </button>
        </div>
      </div>

      {/* Funnel Pipeline Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#141936] p-4 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b]">
          <span className="text-[10px] font-bold text-[#727687] uppercase">Pipeline Total</span>
          <p className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff] mt-0.5">
            R$ {totalPipeline.toLocaleString('pt-BR')},00
          </p>
        </div>

        <div className="bg-white dark:bg-[#141936] p-4 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b]">
          <span className="text-[10px] font-bold text-[#727687] uppercase">Taxa de Conversão</span>
          <p className="text-xl font-bold font-poppins text-emerald-600 mt-0.5">28.4%</p>
        </div>

        <div className="bg-white dark:bg-[#141936] p-4 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b]">
          <span className="text-[10px] font-bold text-[#727687] uppercase">Ticket Médio GBP</span>
          <p className="text-xl font-bold font-poppins text-[#0066ff] mt-0.5">R$ 2.450,00</p>
        </div>

        <div className="bg-white dark:bg-[#141936] p-4 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-[#727687] uppercase">Score Médio IA</span>
            <p className="text-xl font-bold font-poppins text-purple-600 mt-0.5">87%</p>
          </div>
          <Sparkles className="w-6 h-6 text-purple-500 animate-pulse" />
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-6 pt-1">
          {stages.map((stg) => {
            const stageDeals = deals.filter(d => d.stage === stg.id);
            const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0);

            return (
              <div
                key={stg.id}
                className="w-72 shrink-0 bg-[#f4f2fd]/60 dark:bg-[#10142e]/60 p-3 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] flex flex-col max-h-[600px]"
              >
                {/* Stage Header */}
                <div className={`p-3 rounded-xl bg-white dark:bg-[#141936] border-l-4 ${stg.color} shadow-sm mb-3 flex items-center justify-between`}>
                  <div>
                    <h3 className="font-bold font-poppins text-xs text-[#1a1b22] dark:text-[#f8f7ff]">
                      {stg.label}
                    </h3>
                    <p className="text-[10px] text-[#727687]">
                      {stageDeals.length} negócios • R$ {stageTotal.toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>

                {/* Column Deal Cards */}
                <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className="p-4 bg-white dark:bg-[#141936] rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm hover:border-[#0066ff] transition-all space-y-3 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#0066ff] bg-[#0066ff]/10 px-2 py-0.5 rounded">
                            {deal.category}
                          </span>
                          <h4 className="font-bold text-xs text-[#1a1b22] dark:text-[#f8f7ff] mt-1">
                            {deal.companyName}
                          </h4>
                          <p className="text-[11px] text-[#727687]">{deal.contactName}</p>
                        </div>

                        {/* Predictive Closure Score Badge */}
                        <div
                          className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold text-[10px] px-2 py-1 rounded-lg border border-purple-500/20"
                          title="Probabilidade preditiva de fechamento calculada por IA"
                        >
                          <Zap className="w-3 h-3 text-purple-500 fill-purple-500" />
                          {deal.aiScore}%
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#c2c6d8]/20 dark:border-[#2e366b]">
                        <span className="font-bold text-xs font-poppins text-emerald-600">
                          R$ {deal.value.toLocaleString('pt-BR')},00
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onOpenAiPitchModal(deal.companyName)}
                            className="p-1.5 text-[#0066ff] hover:bg-[#0066ff]/10 rounded-lg text-[10px] font-bold flex items-center gap-1"
                            title="Gerar Pitch IA"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Pitch
                          </button>

                          {stg.id !== 'fechado' && (
                            <button
                              onClick={() => moveDealNext(deal.id)}
                              className="p-1.5 bg-[#0066ff] text-white hover:bg-[#0050cb] rounded-lg"
                              title="Avançar Estágio"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div className="p-6 text-center text-xs text-[#727687] italic border-2 border-dashed border-[#c2c6d8]/30 rounded-xl">
                      Nenhum negócio neste estágio
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f2fd] dark:bg-[#10142e] text-[#727687] font-bold uppercase border-b border-[#c2c6d8]/30">
              <tr>
                <th className="p-4">Empresa / Negócio</th>
                <th className="p-4">Contato</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Estágio</th>
                <th className="p-4">Score IA</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c2c6d8]/20 dark:divide-[#2e366b]">
              {deals.map((d) => (
                <tr key={d.id} className="hover:bg-[#f4f2fd]/50 dark:hover:bg-[#10142e]/50 transition-colors">
                  <td className="p-4 font-bold text-[#1a1b22] dark:text-[#f8f7ff]">{d.companyName}</td>
                  <td className="p-4 text-[#727687]">{d.contactName}</td>
                  <td className="p-4 font-bold text-emerald-600 font-poppins">R$ {d.value.toLocaleString('pt-BR')}</td>
                  <td className="p-4">
                    <span className="capitalize px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#0066ff]/10 text-[#0066ff]">
                      {d.stage}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-purple-600">{d.aiScore}%</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => onOpenAiPitchModal(d.companyName)}
                      className="px-3 py-1.5 bg-[#0066ff] text-white rounded-lg font-bold text-[11px] hover:bg-[#0050cb]"
                    >
                      Pitch IA
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
