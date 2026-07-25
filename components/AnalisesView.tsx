'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Search,
  CheckCircle2,
  Star,
  Phone,
  Navigation,
  Globe,
  Eye,
  Sparkles,
  TrendingUp,
  AlertCircle,
  MessageSquare,
  Image as ImageIcon,
  ChevronRight,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AnalisesViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiReviewModal: (companyName: string, reviewerName: string, reviewText: string) => void;
}

export function AnalisesView({
  onShowToast,
  onOpenAiReviewModal,
}: AnalisesViewProps) {
  const [selectedCompany, setSelectedCompany] = useState('padaria');
  const [roiGrowth, setRoiGrowth] = useState(35);
  const [canSeeSolutions, setCanSeeSolutions] = useState(false);

  useEffect(() => {
    const loadPermission = async () => {
      if (!supabase) return;
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) return;
      const { data } = await supabase.from('profiles').select('role, permissions').eq('id', userId).single();
      setCanSeeSolutions(data?.role === 'Administrador' || (data?.permissions || []).includes('analises_solucoes'));
    };
    void loadPermission();
  }, []);

  const companiesData = {
    padaria: {
      name: 'Padaria & Confeitaria Silva',
      category: 'Padaria e Cafetaria',
      address: 'Rua das Flores, 450 - Centro, São Paulo - SP',
      rating: 4.2,
      totalReviews: 148,
      score: 72,
      scoreText: 'BOM',
      verified: true,
      calls: '842',
      routes: '3.1k',
      siteClicks: '1.2k',
      views: '12.4k',
      reviews: [
        {
          id: '1',
          name: 'Juliana Costa',
          rating: 2,
          date: 'Ontem',
          text: 'Pães deliciosos, porém o atendimento ao cliente no balcão pela manhã demorou mais de 20 minutos.',
          responded: false,
        },
        {
          id: '2',
          name: 'Marcos Vinicius',
          rating: 5,
          date: 'Há 3 dias',
          text: 'Melhor croissant da região! Recomendo muito o café especial.',
          responded: true,
        },
      ],
    },
    clinica: {
      name: 'Clínica OdontoSorriso',
      category: 'Dentista & Estética Oral',
      address: 'Av. Paulista, 1200 - Conjunto 42, São Paulo - SP',
      rating: 4.8,
      totalReviews: 312,
      score: 88,
      scoreText: 'EXCELENTE',
      verified: true,
      calls: '1.450',
      routes: '5.2k',
      siteClicks: '2.8k',
      views: '24.1k',
      reviews: [
        {
          id: '3',
          name: 'Renata Lemos',
          rating: 5,
          date: 'Há 1 dia',
          text: 'Atendimento impecável do Dr. Lucas. Pontual e muito atencioso!',
          responded: false,
        },
      ],
    },
  };

  const current = companiesData[selectedCompany as keyof typeof companiesData];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Search Company Dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center font-bold">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
              Auditoria & Check-up GBP
            </h2>
            <p className="text-xs text-[#727687]">
              Diagnóstico em tempo real da integridade do perfil no Google Maps
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-[#727687] whitespace-nowrap hidden sm:inline">
            Empresa Selecionada:
          </label>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 dark:border-[#2e366b] text-[#1a1b22] dark:text-[#f8f7ff] text-xs font-bold px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066ff]"
          >
            <option value="padaria">Padaria & Confeitaria Silva (Score: 72)</option>
            <option value="clinica">Clínica OdontoSorriso (Score: 88)</option>
          </select>
          <button
            onClick={() => onShowToast('Dados do Google Business Profile sincronizados em tempo real!')}
            className="p-2.5 bg-[#0066ff]/10 text-[#0066ff] hover:bg-[#0066ff] hover:text-white rounded-xl transition-colors"
            title="Sincronizar dados do Google"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Info Card & Health Score Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Overview (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-4 items-start">
                <Image
                  src="https://picsum.photos/seed/bakeryshop/160/160"
                  alt={current.name}
                  width={160}
                  height={160}
                  className="w-16 h-16 rounded-2xl object-cover border border-[#c2c6d8]/40 shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
                      {current.name}
                    </h3>
                    {current.verified && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verificado Google
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#727687] font-medium mt-1">{current.category} • {current.address}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-500/20">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{current.rating}</span>
                <span className="text-xs text-[#727687]">({current.totalReviews} avaliações)</span>
              </div>
            </div>

            {/* Performance Metrics Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#c2c6d8]/20 dark:border-[#2e366b]">
              <div className="bg-[#f4f2fd] dark:bg-[#10142e] p-3.5 rounded-xl border border-[#c2c6d8]/20 dark:border-[#2e366b]">
                <div className="flex items-center gap-2 text-[#0066ff] text-xs font-semibold">
                  <Phone className="w-4 h-4" /> Chamadas
                </div>
                <p className="text-lg font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff] mt-1">
                  {current.calls}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold">+18% este mês</span>
              </div>

              <div className="bg-[#f4f2fd] dark:bg-[#10142e] p-3.5 rounded-xl border border-[#c2c6d8]/20 dark:border-[#2e366b]">
                <div className="flex items-center gap-2 text-purple-600 text-xs font-semibold">
                  <Navigation className="w-4 h-4" /> Solicit. Rotas
                </div>
                <p className="text-lg font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff] mt-1">
                  {current.routes}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold">+24% este mês</span>
              </div>

              <div className="bg-[#f4f2fd] dark:bg-[#10142e] p-3.5 rounded-xl border border-[#c2c6d8]/20 dark:border-[#2e366b]">
                <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
                  <Globe className="w-4 h-4" /> Clicks Website
                </div>
                <p className="text-lg font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff] mt-1">
                  {current.siteClicks}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold">+12% este mês</span>
              </div>

              <div className="bg-[#f4f2fd] dark:bg-[#10142e] p-3.5 rounded-xl border border-[#c2c6d8]/20 dark:border-[#2e366b]">
                <div className="flex items-center gap-2 text-amber-600 text-xs font-semibold">
                  <Eye className="w-4 h-4" /> Views Maps
                </div>
                <p className="text-lg font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff] mt-1">
                  {current.views}
                </p>
                <span className="text-[10px] text-emerald-600 font-bold">+30% este mês</span>
              </div>
            </div>
          </div>
        </div>

        {/* Health Score Circular Gauge Card (1 Col) */}
        <div className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm flex flex-col items-center justify-between text-center">
          <h3 className="font-bold font-poppins text-base text-[#1a1b22] dark:text-[#f8f7ff]">
            GBP Health Score
          </h3>

          <div className="relative my-4 flex items-center justify-center">
            <svg className="w-40 h-40 gauge-svg" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="68" className="gauge-circle-bg" />
              <circle
                cx="80"
                cy="80"
                r="68"
                className="gauge-circle-progress stroke-[#0066ff]"
                style={{
                  strokeDashoffset: 440 - (440 * current.score) / 100,
                }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-black font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
                {current.score}
              </span>
              <span className="text-xs font-extrabold tracking-widest uppercase text-[#0066ff]">
                {current.scoreText}
              </span>
            </div>
          </div>

          {/* Breakdown progress bars */}
          <div className="w-full space-y-2 text-xs text-left">
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-[#424656] dark:text-[#b0b4ce]">Completude do Perfil</span>
                <span className="text-[#1a1b22] dark:text-[#f8f7ff]">95%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '95%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-[#424656] dark:text-[#b0b4ce]">Qualidade & Fotos</span>
                <span className="text-[#1a1b22] dark:text-[#f8f7ff]">60%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '60%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-[#424656] dark:text-[#b0b4ce]">Resposta a Avaliações</span>
                <span className="text-[#1a1b22] dark:text-[#f8f7ff]">45%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: '45%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <h3 className="font-bold font-poppins text-lg text-[#1a1b22] dark:text-[#f8f7ff] mb-4">Diagnóstico detalhado do perfil</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e]"><p className="font-bold text-[#0066ff]">Reputação</p><p className="mt-2 text-[#424656] dark:text-[#b0b4ce]">Nota {current.rating}/5 com {current.totalReviews} avaliações. O score considera volume, nota e respostas recentes.</p></div>
          <div className="p-4 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e]"><p className="font-bold text-[#0066ff]">Visibilidade local</p><p className="mt-2 text-[#424656] dark:text-[#b0b4ce]">{current.views} visualizações, {current.routes} rotas e {current.calls} chamadas no período analisado.</p></div>
          <div className="p-4 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e]"><p className="font-bold text-[#0066ff]">Presença digital</p><p className="mt-2 text-[#424656] dark:text-[#b0b4ce]">{current.siteClicks} acessos ao site. O score mostra a saúde geral do perfil e não expõe as soluções comerciais.</p></div>
        </div>
      </div>

      {/* ROI Simulator & Priority Recommendations */}
      {canSeeSolutions ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ROI Growth Projections */}
        <div className="bg-gradient-to-br from-[#0050cb] to-[#0066ff] text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              <h3 className="font-bold font-poppins text-lg">Simulador de ROI Otimizado por IA</h3>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">
              Arraste o slider para calcular o impacto previsto nas chamadas e conversões de clientes locais ao atingir um Score 95+ no Google Business Profile.
            </p>

            <div className="pt-4 space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span>Meta de Crescimento Local:</span>
                <span className="text-amber-300 font-extrabold text-sm">+{roiGrowth}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={roiGrowth}
                onChange={(e) => setRoiGrowth(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-2 bg-white/20 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70">Novas Chamadas Est.</span>
                <p className="text-xl font-bold font-poppins text-white">
                  +{Math.round(842 * (roiGrowth / 100))} / mês
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-white/70">Receita Adicional Est.</span>
                <p className="text-xl font-bold font-poppins text-amber-300">
                  +R$ {(roiGrowth * 180).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onShowToast('Apresentação de ROI gerada para envio ao cliente!')}
            className="mt-6 w-full py-2.5 bg-white text-[#0050cb] hover:bg-amber-300 hover:text-[#0050cb] font-bold text-xs rounded-xl shadow transition-all"
          >
            Gerar Apresentação de ROI para o Cliente
          </button>
        </div>

        {/* Priority Optimizations List */}
        <div className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold font-poppins text-lg text-[#1a1b22] dark:text-[#f8f7ff] mb-4">
              Recomendações Prioritárias
            </h3>

            <div className="space-y-3">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-500/20 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="flex justify-between items-center font-bold text-rose-900 dark:text-rose-200">
                    <span>Responder 3 Avaliações Sem Resposta</span>
                    <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded uppercase">Urgente</span>
                  </div>
                  <p className="text-rose-700 dark:text-rose-300 mt-1">
                    Avaliações sem resposta reduzem em 30% a taxa de conversão nas buscas locais.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-500/20 flex items-start gap-3">
                <ImageIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="flex justify-between items-center font-bold text-amber-900 dark:text-amber-200">
                    <span>Adicionar 5 Fotos de Alta Resolução</span>
                    <span className="bg-amber-600 text-white text-[9px] px-1.5 py-0.5 rounded uppercase">Alta</span>
                  </div>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    Perfis com fotos semanais recebem 42% mais pedidos de rota no Google Maps.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-500/20 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-[#0066ff] shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="flex justify-between items-center font-bold text-blue-900 dark:text-blue-200">
                    <span>Publicar Oferta da Semana GBP</span>
                    <span className="bg-[#0066ff] text-white text-[9px] px-1.5 py-0.5 rounded uppercase">Recomendado</span>
                  </div>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    Ative o botão de chamada para ação direto no card do Google.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> : <div className="p-4 bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/30 rounded-2xl text-xs text-[#727687]">Você está vendo o diagnóstico do perfil. As recomendações e simuladores comerciais foram reservados pelo administrador.</div>}

      {/* Reviews Section with AI Auto-respond Modal trigger */}
      <div className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#0066ff]" />
            <h3 className="font-bold font-poppins text-lg text-[#1a1b22] dark:text-[#f8f7ff]">
              Avaliações Recentes do Perfil
            </h3>
          </div>
          <span className="text-xs text-[#727687]">Monitored via Google Business Profile API</span>
        </div>

        <div className="space-y-4">
          {current.reviews.map((rev) => (
            <div
              key={rev.id}
              className="p-4 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b] bg-[#f4f2fd]/50 dark:bg-[#10142e]/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#1a1b22] dark:text-[#f8f7ff]">{rev.name}</span>
                  <div className="flex text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-[#727687]">{rev.date}</span>
                </div>
                <p className="text-xs text-[#424656] dark:text-[#b0b4ce]">&quot;{rev.text}&quot;</p>
              </div>

              <div>
                {!rev.responded && canSeeSolutions ? (
                  <button
                    onClick={() => onOpenAiReviewModal(current.name, rev.name, rev.text)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs rounded-xl shadow transition-all active:scale-95"
                  >
                    <Sparkles className="w-4 h-4" />
                    Responder com IA
                  </button>
                ) : rev.responded ? (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Respondida
                  </span>
                ) : <span className="text-[11px] text-[#727687]">Ação de resposta reservada</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
