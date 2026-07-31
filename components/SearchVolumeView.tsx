'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Building2, CheckCircle2 } from 'lucide-react';
import { useAuthProfile } from '@/components/AuthGate';
import { GooglePlaceSearch, GooglePlaceSuggestion } from '@/components/GooglePlaceSearch';
import { KeywordOpportunityPanel } from '@/components/KeywordOpportunityPanel';
import { useLeads } from '@/hooks/use-leads';
import { Lead } from '@/lib/leads';
import { supabase } from '@/lib/supabase';

type SearchVolumeViewProps = {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
};

type ScanPosition = {
  keyword: string;
  average_position: number | null;
  created_at: string;
};

function keywordKey(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR');
}

export function SearchVolumeView({ onShowToast }: SearchVolumeViewProps) {
  const profile = useAuthProfile();
  const { leads, loading, error, createLead, updateLead } = useLeads();
  const [selectedId, setSelectedId] = useState('');
  const [positions, setPositions] = useState<Record<string, number | null>>({});
  const selected = leads.find(lead => lead.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId || !supabase) {
      return;
    }
    let active = true;
    const loadPositions = async () => {
      const { data, error: requestError } = await supabase!
        .from('local_visibility_scans')
        .select('keyword,average_position,created_at')
        .eq('lead_id', selectedId)
        .eq('created_by', profile.id)
        .order('created_at', { ascending: false });
      if (!active) return;
      if (requestError) {
        setPositions({});
        return;
      }
      const next = ((data || []) as ScanPosition[]).reduce<Record<string, number | null>>((result, scan) => {
        const key = keywordKey(scan.keyword);
        if (!Object.prototype.hasOwnProperty.call(result, key)) {
          result[key] = scan.average_position ?? 21;
        }
        return result;
      }, {});
      setPositions(next);
    };
    void loadPositions();
    return () => { active = false; };
  }, [profile.id, selectedId]);

  const measuredKeywords = useMemo(
    () => Object.keys(positions).length,
    [positions],
  );

  const chooseSuggestion = async (place: GooglePlaceSuggestion) => {
    const existing = leads.find(lead => lead.google_place_id === place.google_place_id);
    if (existing) {
      setPositions({});
      setSelectedId(existing.id);
      return;
    }
    const result = await createLead({
      company_name: place.company_name,
      category: place.category,
      address: place.address,
      city: place.city || null,
      decision_maker_name: null,
      receptionist_name: null,
      phone: place.phone || null,
      whatsapp: place.whatsapp || place.phone || null,
      email: null,
      notes: null,
      google_place_id: place.google_place_id,
      google_maps_url: place.google_maps_url,
      website_url: place.website_url || null,
      rating: place.rating,
      review_count: place.review_count,
      photo_count: place.photo_count ?? null,
      has_website: place.has_website ?? Boolean(place.website_url),
      health_score: place.health_score ?? null,
      opportunity: place.opportunity || null,
      latitude: place.latitude ?? null,
      longitude: place.longitude ?? null,
      analysis_data: place.analysis_data && typeof place.analysis_data === 'object'
        ? place.analysis_data as Lead['analysis_data']
        : {},
      analysed_at: place.analysed_at || null,
      source: 'manual',
      status: 'novo',
      next_action_at: null,
    });
    if (result.error || !result.data) {
      onShowToast(result.error || 'Não foi possível salvar a empresa.', 'error');
      return;
    }
    setPositions({});
    setSelectedId(result.data.id);
    onShowToast('Empresa carregada para a análise de volume.', 'success');
  };

  const useKeyword = async (keyword: string) => {
    if (!selected) return;
    const current = Array.isArray(selected.analysis_data?.visibility_keywords)
      ? selected.analysis_data!.visibility_keywords!
      : [];
    if (current.some(item => keywordKey(item) === keywordKey(keyword))) {
      onShowToast('Essa palavra-chave já está disponível no Mapa de Calor.', 'info');
      return;
    }
    const result = await updateLead(selected.id, {
      analysis_data: {
        ...(selected.analysis_data || {}),
        visibility_keywords: [...current, keyword],
      },
    });
    if (result.error) onShowToast(result.error, 'error');
    else onShowToast('Palavra-chave adicionada ao Mapa de Calor.', 'success');
  };

  return (
    <div className="lw-page space-y-3">
      <div>
        <p className="lw-kicker mb-1.5">Inteligência de mercado</p>
        <h2 className="lw-title">Volume de Busca</h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Descubra as palavras mais procuradas e estime a receita potencial não capturada.
        </p>
      </div>

      <section className="lw-panel p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="lw-icon-box"><Building2 className="h-4 w-4" /></span>
          <div>
            <p className="text-xs font-semibold">Escolha a empresa</p>
            <p className="text-[10px] text-[var(--text-secondary)]">Busque pelo nome, bairro ou cidade.</p>
          </div>
        </div>
        <GooglePlaceSearch module="mapa" disabled={loading} onSelect={chooseSuggestion} />

        {selected && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-[#1268ff]/20 bg-[#1268ff]/5 p-3 sm:flex-row sm:items-center">
            <span className="lw-icon-box"><CheckCircle2 className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{selected.company_name}</p>
              <p className="truncate text-[10px] text-[var(--text-secondary)]">
                {selected.category || 'Segmento a confirmar'} · {selected.city || selected.address || 'Localização identificada pelo Google'}
              </p>
            </div>
            <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-[var(--primary-main)] shadow-sm dark:bg-[#202737]">
              {measuredKeywords} palavra{measuredKeywords === 1 ? '' : 's'} medida{measuredKeywords === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </section>

      {selected ? (
        <KeywordOpportunityPanel
          key={selected.id}
          selectedLead={selected}
          leads={leads}
          currentPosition={null}
          rankedKeyword=""
          keywordPositions={positions}
          onUseKeyword={useKeyword}
          onShowToast={onShowToast}
        />
      ) : (
        <section className="lw-panel grid min-h-64 place-items-center p-8 text-center">
          <div>
            <BarChart3 className="mx-auto h-8 w-8 text-[var(--primary-main)]/70" />
            <p className="mt-3 text-sm font-semibold">Pronto para consultar</p>
            <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
              Selecione uma empresa para gerar palavras-chave e consultar dados reais do Google Ads.
            </p>
          </div>
        </section>
      )}

      {error && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{error}</p>}
    </div>
  );
}
