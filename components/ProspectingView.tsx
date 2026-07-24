'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Sparkles,
  PhoneCall,
  UserPlus,
  Trash2,
  CheckSquare,
  Square,
  Globe,
  MapPin,
  Star,
  Zap,
  Building2,
  Download,
} from 'lucide-react';

interface ProspectingViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiPitchModal: (companyName: string) => void;
}

export function ProspectingView({
  onShowToast,
  onOpenAiPitchModal,
}: ProspectingViewProps) {
  const [cityFilter, setCityFilter] = useState('São Paulo - SP');
  const [categoryFilter, setCategoryFilter] = useState('Restaurantes');
  const [missingWebOnly, setMissingWebOnly] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  const [prospects, setProspects] = useState([
    {
      id: 'p1',
      name: 'Restaurante Sabor da Roça',
      category: 'Gastronomia',
      address: 'Rua Augusta, 890 - Consolação',
      rating: 3.9,
      reviews: 42,
      hasWebsite: false,
      claimed: true,
      healthScore: 54,
      aiProb: 92,
    },
    {
      id: 'p2',
      name: 'Oficina AutoTech Express',
      category: 'Automotivo',
      address: 'Av. Santo Amaro, 2100 - Vila Nova',
      rating: 4.1,
      reviews: 28,
      hasWebsite: true,
      claimed: false,
      healthScore: 48,
      aiProb: 88,
    },
    {
      id: 'p3',
      name: 'Clínica Odonto Estética',
      category: 'Saúde',
      address: 'Rua Vergueiro, 1500 - Paraíso',
      rating: 4.6,
      reviews: 110,
      hasWebsite: true,
      claimed: true,
      healthScore: 68,
      aiProb: 75,
    },
    {
      id: 'p4',
      name: 'Pizzaria Napolitana Tradicional',
      category: 'Gastronomia',
      address: 'Rua Moema, 320 - Moema',
      rating: 3.7,
      reviews: 19,
      hasWebsite: false,
      claimed: false,
      healthScore: 38,
      aiProb: 96,
    },
  ]);

  const toggleSelectLead = (id: string) => {
    setSelectedLeads(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === prospects.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(prospects.map(p => p.id));
    }
  };

  const handleBatchPitch = () => {
    if (selectedLeads.length === 0) {
      onShowToast('Selecione ao menos um lead para auditar!', 'error');
      return;
    }
    onShowToast(`Disparando auditoria e geração de pitch IA para ${selectedLeads.length} leads selecionados!`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
            Prospecção Ativa & Auditoria em Lote
          </h2>
          <p className="text-xs text-[#727687]">
            Encontre estabelecimentos locais com cadastro falho no Google e gere abordagens de alto impacto
          </p>
        </div>

        {/* Batch Action Buttons */}
        {selectedLeads.length > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in">
            <span className="text-xs font-bold text-[#0066ff]">
              {selectedLeads.length} Selecionado(s)
            </span>
            <button
              onClick={handleBatchPitch}
              className="flex items-center gap-1.5 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition-all"
            >
              <Sparkles className="w-4 h-4" /> Pitch em Lote
            </button>
            <button
              onClick={() => {
                onShowToast(`${selectedLeads.length} leads importados para o CRM!`);
                setSelectedLeads([]);
              }}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition-all"
            >
              <UserPlus className="w-4 h-4" /> Mover para CRM
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#141936] p-4 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
        <div>
          <label className="text-[10px] font-bold uppercase text-[#727687] block mb-1">Cidade / Região:</label>
          <input
            type="text"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] text-[#1a1b22] dark:text-[#f8f7ff] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066ff]"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-[#727687] block mb-1">Categoria:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] text-[#1a1b22] dark:text-[#f8f7ff] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066ff]"
          >
            <option value="Gastronomia">Gastronomia / Restaurantes</option>
            <option value="Automotivo">Oficinas / Automotivo</option>
            <option value="Saúde">Clínicas & Saúde</option>
            <option value="Beleza">Salões de Beleza & Estética</option>
          </select>
        </div>

        <div className="flex items-center gap-2 pt-4">
          <input
            type="checkbox"
            id="missingWeb"
            checked={missingWebOnly}
            onChange={(e) => setMissingWebOnly(e.target.checked)}
            className="w-4 h-4 text-[#0066ff] rounded border-gray-300 focus:ring-[#0066ff]"
          />
          <label htmlFor="missingWeb" className="text-xs font-semibold text-[#1a1b22] dark:text-[#f8f7ff] cursor-pointer">
            Apenas sem Website cadastrado
          </label>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={() => onShowToast(`Prospecção realizada em ${cityFilter}!`)}
            className="w-full sm:w-auto px-5 py-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" /> Buscar Empresas no Google
          </button>
        </div>
      </div>

      {/* Lead Table */}
      <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] overflow-hidden shadow-sm">
        <div className="p-4 bg-[#f4f2fd] dark:bg-[#10142e] border-b border-[#c2c6d8]/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={toggleSelectAll} className="text-[#0066ff]">
              {selectedLeads.length === prospects.length ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5 text-gray-400" />
              )}
            </button>
            <span className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">
              Resultados da Busca ({prospects.length} empresas encontradas)
            </span>
          </div>
          <span className="text-[11px] text-[#727687]">Dados em tempo real via Google Maps Places API</span>
        </div>

        <div className="divide-y divide-[#c2c6d8]/20 dark:divide-[#2e366b]">
          {prospects.map((p) => {
            const isSelected = selectedLeads.includes(p.id);

            return (
              <div
                key={p.id}
                className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  isSelected ? 'bg-[#0066ff]/5 dark:bg-[#0066ff]/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleSelectLead(p.id)} className="mt-1 text-[#0066ff]">
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    )}
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-[#1a1b22] dark:text-[#f8f7ff]">{p.name}</h4>
                      {!p.hasWebsite && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/20">
                          Sem Website
                        </span>
                      )}
                      {!p.claimed && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20">
                          Não Reclamado
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#727687]">{p.address} • {p.category}</p>

                    <div className="flex items-center gap-3 text-xs font-semibold pt-1">
                      <span className="flex items-center gap-1 text-amber-500">
                        <Star className="w-3.5 h-3.5 fill-amber-400" /> {p.rating} ({p.reviews})
                      </span>
                      <span className="text-rose-500 font-bold">
                        Health Score Est.: {p.healthScore}/100
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Action Trigger */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] text-[#727687] font-bold block uppercase">Chance de Fechamento IA</span>
                    <span className="text-xs font-bold text-purple-600 flex items-center justify-end gap-1">
                      <Zap className="w-3.5 h-3.5 fill-purple-600" /> {p.aiProb}%
                    </span>
                  </div>

                  <button
                    onClick={() => onOpenAiPitchModal(p.name)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs rounded-xl shadow transition-all active:scale-95"
                  >
                    <Sparkles className="w-4 h-4" /> Gerar Pitch IA
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
