'use client';

import React from 'react';
import {
  Building2,
  UserPlus,
  CalendarCheck,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Phone,
  Calendar,
  FileCheck,
  Search,
  Plus,
  ChevronRight,
  Download,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { TabType } from './Sidebar';

interface DashboardViewProps {
  setActiveTab: (tab: TabType) => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiPitchModal: (companyName: string) => void;
}

export function DashboardView({
  setActiveTab,
  onShowToast,
  onOpenAiPitchModal,
}: DashboardViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Welcome Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
            Visão Geral
          </h2>
          <p className="text-sm text-[#424656] dark:text-[#b0b4ce] mt-0.5">
            Bem-vindo de volta, Ricardo. Aqui está o desempenho atual da sua agência.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select className="bg-white dark:bg-[#141936] border border-[#c2c6d8]/40 dark:border-[#2e366b] text-[#1a1b22] dark:text-[#f8f7ff] text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066ff]">
            <option>Últimos 30 Dias</option>
            <option>Este Mês</option>
            <option>Último Trimestre</option>
          </select>

          <button
            onClick={() => onShowToast('Relatório executivo gerado em PDF!')}
            className="flex items-center gap-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            Exportar Relatório
          </button>
        </div>
      </div>

      {/* KPI Grid - 4 Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1 */}
        <div className="bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm hover:border-[#0066ff]/40 transition-all group">
          <div className="flex justify-between items-start">
            <div className="w-11 h-11 rounded-xl bg-[#0066ff]/10 text-[#0066ff] dark:text-[#3b82f6] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
              +12% <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-[#727687] uppercase tracking-wider">
              Empresas Analisadas
            </p>
            <p className="text-2xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff] mt-1">
              1.240
            </p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm hover:border-[#0066ff]/40 transition-all group">
          <div className="flex justify-between items-start">
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
              +8% <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-[#727687] uppercase tracking-wider">
              Leads Prospectados
            </p>
            <p className="text-2xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff] mt-1">
              450
            </p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm hover:border-[#0066ff]/40 transition-all group">
          <div className="flex justify-between items-start">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-full">
              -2% <TrendingDown className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-[#727687] uppercase tracking-wider">
              Reuniões Marcadas
            </p>
            <p className="text-2xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff] mt-1">
              32
            </p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm hover:border-[#0066ff]/40 transition-all group">
          <div className="flex justify-between items-start">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
              +15% <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-[#727687] uppercase tracking-wider">
              Faturamento Mês
            </p>
            <p className="text-2xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff] mt-1">
              R$ 45.000
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart Card */}
        <div className="lg:col-span-2 bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold font-poppins text-lg text-[#1a1b22] dark:text-[#f8f7ff]">
                Performance Semanal
              </h3>
              <p className="text-xs text-[#727687]">Ligações de Prospecção vs Reuniões Realizadas</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#0066ff]" />
                Ligações
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-purple-500" />
                Reuniões
              </span>
            </div>
          </div>

          {/* Weekly Bars Simulation */}
          <div className="h-56 flex items-end justify-between gap-3 pt-6 border-b border-gray-100 dark:border-gray-800">
            {[
              { day: 'Seg', calls: 60, meetings: 30 },
              { day: 'Ter', calls: 85, meetings: 45 },
              { day: 'Qua', calls: 70, meetings: 25 },
              { day: 'Qui', calls: 90, meetings: 60 },
              { day: 'Sex', calls: 95, meetings: 70 },
              { day: 'Sáb', calls: 40, meetings: 15 },
            ].map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="w-full flex justify-center items-end gap-1.5 h-full">
                  <div
                    style={{ height: `${item.calls}%` }}
                    className="w-full max-w-[20px] bg-[#0066ff] rounded-t-md group-hover:bg-[#0050cb] transition-all relative"
                    title={`${item.day}: ${item.calls} ligações`}
                  />
                  <div
                    style={{ height: `${item.meetings}%` }}
                    className="w-full max-w-[20px] bg-purple-500 rounded-t-md group-hover:bg-purple-600 transition-all relative"
                    title={`${item.day}: ${item.meetings} reuniões`}
                  />
                </div>
                <span className="text-xs text-[#727687] font-medium">{item.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights Card */}
        <div className="bg-[#0066ff]/5 dark:bg-[#0066ff]/10 p-6 rounded-2xl border border-[#0066ff]/20 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2 text-[#0066ff] dark:text-[#3b82f6]">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <h3 className="font-bold font-poppins text-lg text-[#1a1b22] dark:text-[#f8f7ff]">
                Insights da IA
              </h3>
            </div>

            <div className="p-3.5 bg-white dark:bg-[#141936] rounded-xl shadow-sm border-l-4 border-rose-500 space-y-1">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4" /> Alerta de Rating Concorrente
              </div>
              <p className="text-xs text-[#424656] dark:text-[#b0b4ce]">
                O concorrente da <strong className="text-[#1a1b22] dark:text-[#f8f7ff]">Padaria Silva</strong> caiu de 4.5 para 3.8 estrelas. Oportunidade perfeita de abordagem!
              </p>
              <button
                onClick={() => onOpenAiPitchModal('Padaria Silva')}
                className="mt-1 text-[11px] font-bold text-[#0066ff] hover:underline"
              >
                Gerar Pitch IA →
              </button>
            </div>

            <div className="p-3.5 bg-white dark:bg-[#141936] rounded-xl shadow-sm border-l-4 border-[#0066ff] space-y-1">
              <div className="flex items-center gap-2 text-[#0066ff] dark:text-[#3b82f6] font-semibold text-xs">
                <Clock className="w-4 h-4" /> Lead Estagnado no CRM
              </div>
              <p className="text-xs text-[#424656] dark:text-[#b0b4ce]">
                O lead <strong className="text-[#1a1b22] dark:text-[#f8f7ff]">Imobiliária Central</strong> está sem contato há 5 dias. Envie a proposta personalizada.
              </p>
              <button
                onClick={() => setActiveTab('crm')}
                className="mt-1 text-[11px] font-bold text-[#0066ff] hover:underline"
              >
                Ver no CRM →
              </button>
            </div>
          </div>

          <button
            onClick={() => onShowToast('Novos alertas de IA processados com sucesso!')}
            className="mt-4 w-full py-2.5 bg-white dark:bg-[#141936] hover:bg-[#0066ff]/10 text-[#0066ff] dark:text-[#3b82f6] font-bold text-xs rounded-xl border border-[#0066ff]/30 flex items-center justify-center gap-1 transition-all"
          >
            Ver todos os alertas IA
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Secondary Section - Sales Funnel & Actions & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Quick Actions (1 Col) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#727687]">
            Ações Rápidas
          </h3>
          <button
            onClick={() => setActiveTab('analises')}
            className="w-full flex items-center gap-3 p-3.5 bg-white dark:bg-[#141936] border border-[#c2c6d8]/30 dark:border-[#2e366b] rounded-xl hover:border-[#0066ff] hover:shadow-md transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center group-hover:bg-[#0066ff] group-hover:text-white transition-colors">
              <Search className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">Nova Análise GBP</span>
          </button>

          <button
            onClick={() => setActiveTab('prospeccao')}
            className="w-full flex items-center gap-3 p-3.5 bg-white dark:bg-[#141936] border border-[#c2c6d8]/30 dark:border-[#2e366b] rounded-xl hover:border-[#0066ff] hover:shadow-md transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <UserPlus className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">Buscar Novos Leads</span>
          </button>

          <button
            onClick={() => setActiveTab('crm')}
            className="w-full flex items-center gap-3 p-3.5 bg-white dark:bg-[#141936] border border-[#c2c6d8]/30 dark:border-[#2e366b] rounded-xl hover:border-[#0066ff] hover:shadow-md transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Phone className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">Registrar Follow-up</span>
          </button>

          <button
            onClick={() => setActiveTab('propostas')}
            className="w-full flex items-center gap-3 p-3.5 bg-white dark:bg-[#141936] border border-[#c2c6d8]/30 dark:border-[#2e366b] rounded-xl hover:border-[#0066ff] hover:shadow-md transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <FileCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">Criar Proposta</span>
          </button>
        </div>

        {/* Funnel Donut Chart Representation (1 Col) */}
        <div className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm flex flex-col justify-between">
          <h3 className="font-bold font-poppins text-lg text-[#1a1b22] dark:text-[#f8f7ff] mb-4">
            Funil de Vendas
          </h3>
          <div className="relative flex items-center justify-center my-2">
            <svg className="w-36 h-36" viewBox="0 0 36 36">
              <path
                className="text-gray-200 dark:text-gray-800"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="text-[#0066ff]"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray="40, 100"
                strokeWidth="4"
              />
              <path
                className="text-purple-500"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray="25, 100"
                strokeDashoffset="-40"
                strokeWidth="4"
              />
              <path
                className="text-emerald-500"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray="15, 100"
                strokeDashoffset="-65"
                strokeWidth="4"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">450</span>
              <span className="text-[10px] uppercase font-bold text-[#727687]">Total Leads</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs mt-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#0066ff]" /> Prospecção</span>
              <span className="font-bold">40%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Qualificação</span>
              <span className="font-bold">25%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Proposta / Fechado</span>
              <span className="font-bold">20%</span>
            </div>
          </div>
        </div>

        {/* Timeline Atividade Recente (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold font-poppins text-lg text-[#1a1b22] dark:text-[#f8f7ff]">
              Atividade Recente
            </h3>
            <button
              onClick={() => onShowToast('Histórico completo de auditorias exibido.')}
              className="text-xs text-[#0066ff] font-bold hover:underline"
            >
              Ver Histórico
            </button>
          </div>

          <div className="space-y-5 relative pl-4 border-l-2 border-gray-100 dark:border-gray-800">
            <div className="relative pl-4">
              <div className="absolute -left-[23px] top-0 w-4 h-4 rounded-full bg-[#0066ff] ring-4 ring-white dark:ring-[#141936]" />
              <p className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">
                Nova proposta enviada
              </p>
              <p className="text-xs text-[#424656] dark:text-[#b0b4ce]">
                Restaurante Sabor Mineiro • Enviado por Ricardo Silva
              </p>
              <span className="text-[10px] text-[#727687] font-semibold">HÁ 15 MINUTOS</span>
            </div>

            <div className="relative pl-4">
              <div className="absolute -left-[23px] top-0 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-[#141936]" />
              <p className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">
                Reunião de apresentação agendada
              </p>
              <p className="text-xs text-[#424656] dark:text-[#b0b4ce]">
                Clínica Sorriso • Confirmado para amanhã às 14:00
              </p>
              <span className="text-[10px] text-[#727687] font-semibold">HÁ 2 HORAS</span>
            </div>

            <div className="relative pl-4">
              <div className="absolute -left-[23px] top-0 w-4 h-4 rounded-full bg-purple-500 ring-4 ring-white dark:ring-[#141936]" />
              <p className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">
                Auditoria de raio-x local concluída
              </p>
              <p className="text-xs text-[#424656] dark:text-[#b0b4ce]">
                Setor Automotivo - Zona Sul • 45 novas empresas auditadas
              </p>
              <span className="text-[10px] text-[#727687] font-semibold">HÁ 4 HORAS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
