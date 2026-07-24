'use client';

import React from 'react';
import { Briefcase, Plus, Check, Sparkles, Zap, ShieldCheck } from 'lucide-react';

interface ServicosViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export function ServicosView({ onShowToast }: ServicosViewProps) {
  const services = [
    {
      title: 'Setup & Otimização Completa GBP',
      price: 'R$ 1.500,00',
      period: 'Taxa Única',
      description: 'Auditamos 100% dos campos, categorias secundárias, geotag de fotos e produtos no perfil do Google.',
      features: ['Diagnóstico de Raio-X Geográfico', 'Cadastro de Produtos e Serviços', 'Geotagging de 20 Fotos HD', 'Verificação e Categoria Otimizada'],
      badge: 'MAIS POPULAR',
    },
    {
      title: 'Gestão de Reputação & Avaliações IA',
      price: 'R$ 890,00',
      period: '/mês',
      description: 'IA treinada responde avaliações públicas em segundos com tom humanizado e otimizado com palavras-chave.',
      features: ['Respostas Automáticas com Gemini 3.6', 'Aviso em Tempo Real de Nota Baixa', 'Geração de QR Code Inteligente para Loja', 'Relatório Mensal de Sentimento'],
      badge: 'IA EXCLUSIVO',
    },
    {
      title: 'Escala Local Total (GBP + Tráfego Maps)',
      price: 'R$ 2.900,00',
      period: '/mês',
      description: 'Combinação potente de SEO Local contínuo e anúncios patrocinados no topo do Google Maps.',
      features: ['Anúncios no Topo do Google Maps', 'Otimização Contínua Semanal', 'Gestor de Contas Dedicado', 'Garantia de Crescimento no Top 3'],
      badge: 'VIP PREMIUM',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
            Catálogo de Serviços da Agência
          </h2>
          <p className="text-xs text-[#727687]">
            Pacotes pré-configurados prontos para inserção em propostas comerciais e contratos
          </p>
        </div>

        <button
          onClick={() => onShowToast('Formulário de novo pacote de serviço aberto.')}
          className="flex items-center gap-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> Cadastrar Novo Serviço
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {services.map((s, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm flex flex-col justify-between hover:border-[#0066ff] transition-all relative overflow-hidden group"
          >
            {s.badge && (
              <span className="absolute top-4 right-4 text-[9px] font-extrabold uppercase px-2 py-1 bg-[#0066ff]/10 text-[#0066ff] rounded-md">
                {s.badge}
              </span>
            )}

            <div className="space-y-4">
              <h3 className="font-bold font-poppins text-lg text-[#1a1b22] dark:text-[#f8f7ff]">
                {s.title}
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black font-poppins text-[#0066ff]">{s.price}</span>
                <span className="text-xs text-[#727687]">{s.period}</span>
              </div>
              <p className="text-xs text-[#424656] dark:text-[#b0b4ce] leading-relaxed">
                {s.description}
              </p>

              <div className="pt-4 border-t border-[#c2c6d8]/20 dark:border-[#2e366b] space-y-2 text-xs">
                {s.features.map((f, fIdx) => (
                  <div key={fIdx} className="flex items-center gap-2 text-[#1a1b22] dark:text-[#f8f7ff]">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => onShowToast(`Pacote "${s.title}" selecionado para inclusão na proposta!`)}
              className="mt-6 w-full py-2.5 bg-[#f4f2fd] dark:bg-[#10142e] hover:bg-[#0066ff] hover:text-white text-[#0066ff] font-bold text-xs rounded-xl border border-[#0066ff]/20 transition-all"
            >
              Usar em Proposta Comercial
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
