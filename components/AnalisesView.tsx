'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Link2,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useAuthProfile } from '@/components/AuthGate';
import { useLeads } from '@/hooks/use-leads';
import { Lead, LeadAnalysisData } from '@/lib/leads';
import { supabase } from '@/lib/supabase';

interface AnalisesViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiReviewModal: (companyName: string, reviewerName: string, reviewText: string) => void;
}

const metricLabels: Record<string, string> = {
  reputation: 'Reputação',
  visibility: 'Visibilidade',
  completeness: 'Completude',
  conversion: 'Conversão',
};

function scoreLabel(score: number) {
  if (score >= 80) return 'FORTE';
  if (score >= 60) return 'REGULAR';
  return 'OPORTUNIDADE';
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : 'Ainda não atualizada';
}

export function AnalisesView({ onShowToast }: AnalisesViewProps) {
  const profile = useAuthProfile();
  const { leads, loading, error, createLead, updateLead } = useLeads();
  const analyzable = useMemo(
    () => leads.filter(lead => Boolean(lead.google_place_id)),
    [leads],
  );
  const [selectedId, setSelectedId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [analyzingUrl, setAnalyzingUrl] = useState(false);
  const [roiGrowth, setRoiGrowth] = useState(30);

  const selected = analyzable.find(lead => lead.id === selectedId) || analyzable[0] || null;
  const analysis = selected?.analysis_data || {};
  const score = selected?.health_score ?? 0;
  const canSeeSolutions = ['admin', 'administrador'].includes((profile.role || '').toLowerCase())
    || (profile.permissions || []).includes('analises_solucoes');

  const refreshAnalysis = async () => {
    if (!selected || !supabase) return;
    setRefreshing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
        },
        body: JSON.stringify({ action: 'analyze', placeId: selected.google_place_id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar a análise.');
      const place = result.place as Partial<Lead>;
      const nextAnalysis = (place.analysis_data || {}) as LeadAnalysisData;
      const updateResult = await updateLead(
        selected.id,
        {
          company_name: place.company_name || selected.company_name,
          category: place.category || selected.category,
          address: place.address || selected.address,
          phone: place.phone || selected.phone,
          whatsapp: place.whatsapp || selected.whatsapp,
          google_maps_url: place.google_maps_url || selected.google_maps_url,
          website_url: place.website_url || selected.website_url,
          latitude: place.latitude ?? selected.latitude,
          longitude: place.longitude ?? selected.longitude,
          rating: place.rating ?? selected.rating,
          review_count: place.review_count ?? selected.review_count,
          photo_count: place.photo_count ?? selected.photo_count,
          has_website: place.has_website ?? selected.has_website,
          health_score: place.health_score ?? selected.health_score,
          opportunity: place.opportunity || selected.opportunity,
          analysis_data: nextAnalysis,
          analysed_at: place.analysed_at || new Date().toISOString(),
        },
        {
          outcome: 'Análise do perfil atualizada',
          notes: `Score ${place.health_score ?? selected.health_score ?? 0}`,
          event_type: 'profile_analysis',
        },
      );
      if (updateResult.error) throw new Error(updateResult.error);

      const { error: snapshotError } = await supabase.from('lead_analyses').insert({
        lead_id: selected.id,
        score: place.health_score ?? selected.health_score ?? 0,
        summary: nextAnalysis.summary || place.opportunity || 'Análise atualizada',
        strengths: nextAnalysis.strengths || [],
        weaknesses: nextAnalysis.weaknesses || [],
        recommendations: nextAnalysis.recommendations || [],
        metrics: nextAnalysis.metrics || {},
        source: 'google_places',
      });
      if (snapshotError) throw new Error(`Perfil atualizado, mas o histórico falhou: ${snapshotError.message}`);
      onShowToast('Análise atualizada e salva no histórico.', 'success');
    } catch (requestError) {
      onShowToast(requestError instanceof Error ? requestError.message : 'Erro ao atualizar análise.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const analyzeGoogleMapsUrl = async () => {
    if (!googleMapsUrl.trim() || !supabase) {
      return onShowToast('Cole o link da empresa no Google Maps.', 'error');
    }
    setAnalyzingUrl(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
        },
        body: JSON.stringify({ action: 'analyze_url', googleMapsUrl: googleMapsUrl.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível analisar esse link.');
      const place = result.place as Partial<Lead>;
      const placeId = place.google_place_id;
      if (!placeId) throw new Error('O Google não retornou a identificação dessa empresa.');

      const existing = leads.find(lead => lead.google_place_id === placeId);
      const nextAnalysis = (place.analysis_data || {}) as LeadAnalysisData;
      let savedLead: Lead;
      if (existing) {
        const updated = await updateLead(existing.id, {
          ...place,
          analysis_data: nextAnalysis,
        });
        if (updated.error || !updated.data) throw new Error(updated.error || 'Não foi possível salvar a análise.');
        savedLead = updated.data;
      } else {
        const created = await createLead({
          company_name: place.company_name || 'Empresa do Google',
          category: place.category || null,
          address: place.address || null,
          city: place.city || null,
          decision_maker_name: null,
          receptionist_name: null,
          phone: place.phone || null,
          whatsapp: place.whatsapp || place.phone || null,
          email: null,
          notes: null,
          google_place_id: placeId,
          google_maps_url: place.google_maps_url || googleMapsUrl.trim(),
          website_url: place.website_url || null,
          rating: place.rating ?? null,
          review_count: place.review_count ?? null,
          photo_count: place.photo_count ?? null,
          has_website: place.has_website ?? null,
          health_score: place.health_score ?? null,
          opportunity: place.opportunity || null,
          latitude: place.latitude ?? null,
          longitude: place.longitude ?? null,
          analysis_data: nextAnalysis,
          analysed_at: place.analysed_at || new Date().toISOString(),
          source: 'manual',
          status: 'novo',
          next_action_at: null,
        });
        if (created.error || !created.data) throw new Error(created.error || 'Não foi possível salvar a análise.');
        savedLead = created.data;
      }

      const { error: snapshotError } = await supabase.from('lead_analyses').insert({
        lead_id: savedLead.id,
        score: savedLead.health_score ?? 0,
        summary: nextAnalysis.summary || savedLead.opportunity || 'Análise do perfil',
        strengths: nextAnalysis.strengths || [],
        weaknesses: nextAnalysis.weaknesses || [],
        recommendations: nextAnalysis.recommendations || [],
        metrics: nextAnalysis.metrics || {},
        source: 'google_places_link',
      });
      if (snapshotError) throw new Error(`A empresa foi analisada, mas o histórico não pôde ser salvo: ${snapshotError.message}`);
      setSelectedId(savedLead.id);
      setGoogleMapsUrl('');
      onShowToast('Empresa analisada e salva com sucesso.', 'success');
    } catch (requestError) {
      onShowToast(requestError instanceof Error ? requestError.message : 'Erro ao analisar o link.', 'error');
    } finally {
      setAnalyzingUrl(false);
    }
  };

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#0066ff]" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center"><Zap className="w-6 h-6" /></div>
          <div>
            <h2 className="text-xl font-bold font-poppins">Auditoria de Perfil Google</h2>
            <p className="text-xs text-[#727687]">Dados reais coletados pelo Google Places e salvos no histórico.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={selected?.id || ''} onChange={event => setSelectedId(event.target.value)} className="max-w-[290px] bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 text-xs font-bold px-4 py-2.5 rounded-xl">
            {!analyzable.length && <option value="">Nenhuma empresa do Google</option>}
            {analyzable.map(lead => <option key={lead.id} value={lead.id}>{lead.company_name} — Score {lead.health_score ?? '—'}</option>)}
          </select>
          <button disabled={!selected || refreshing} onClick={() => void refreshAnalysis()} className="p-2.5 bg-[#0066ff] disabled:opacity-50 text-white rounded-xl" title="Atualizar pelo Google Places">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <section className="bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-5 h-5 text-[#0066ff]" />
          <div>
            <h3 className="font-bold text-sm">Analisar uma empresa pelo Google Maps</h3>
            <p className="text-xs text-[#727687]">Cole o link curto ou completo da ficha da empresa. Esta análise é independente da Prospecção.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={googleMapsUrl}
            onChange={event => setGoogleMapsUrl(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') void analyzeGoogleMapsUrl();
            }}
            placeholder="https://maps.app.goo.gl/... ou https://www.google.com/maps/place/..."
            className="flex-1 px-4 py-3 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl"
          />
          <button
            disabled={analyzingUrl || !googleMapsUrl.trim()}
            onClick={() => void analyzeGoogleMapsUrl()}
            className="px-5 py-3 bg-[#0066ff] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
          >
            {analyzingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {analyzingUrl ? 'Analisando...' : 'Analisar empresa'}
          </button>
        </div>
      </section>

      {error && <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">{error}</div>}
      {!selected ? (
        <div className="bg-white dark:bg-[#141936] p-10 rounded-2xl border text-center">
          <MapPin className="w-8 h-8 mx-auto text-[#0066ff] mb-3" />
          <h3 className="font-bold">Cole o link de uma empresa acima</h3>
          <p className="text-xs text-[#727687] mt-1">Aceitamos links curtos e completos do Google Maps.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold">{selected.company_name}</h3>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg"><ShieldCheck className="w-3.5 h-3.5" /> Fonte Google</span>
                  </div>
                  <p className="text-xs text-[#727687] mt-1">{[selected.category, selected.address].filter(Boolean).join(' • ')}</p>
                  <p className="text-[10px] text-[#727687] mt-2">Última análise: {formatDate(selected.analysed_at)}</p>
                </div>
                <div className="flex gap-1">
                  {selected.google_maps_url && <a href={selected.google_maps_url} target="_blank" rel="noreferrer" className="p-2 text-[#0066ff]" title="Abrir no Google Maps"><ExternalLink className="w-4 h-4" /></a>}
                  {selected.phone && <a href={`tel:${selected.phone.replace(/\D/g, '')}`} className="p-2 text-[#0066ff]" title="Ligar"><Phone className="w-4 h-4" /></a>}
                  {selected.website_url && <a href={selected.website_url} target="_blank" rel="noreferrer" className="p-2 text-[#0066ff]" title="Abrir site"><Globe className="w-4 h-4" /></a>}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                <MetricCard icon={<Star className="w-4 h-4 text-amber-500" />} label="Nota Google" value={selected.rating ? selected.rating.toFixed(1) : '—'} />
                <MetricCard icon={<TrendingUp className="w-4 h-4 text-[#0066ff]" />} label="Avaliações" value={String(selected.review_count ?? 0)} />
                <MetricCard icon={<Globe className="w-4 h-4 text-emerald-600" />} label="Site" value={selected.has_website ? 'Sim' : 'Não'} />
                <MetricCard icon={<MapPin className="w-4 h-4 text-purple-600" />} label="Fotos retornadas" value={String(selected.photo_count ?? 0)} />
              </div>
              <p className="mt-5 p-4 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e] text-xs leading-relaxed">{analysis.summary || selected.opportunity || 'Atualize a análise para gerar o diagnóstico detalhado.'}</p>
            </section>

            <section className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm text-center">
              <h3 className="font-bold">Health Score</h3>
              <div className="relative my-5 inline-flex items-center justify-center">
                <svg className="w-40 h-40 gauge-svg" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="68" className="gauge-circle-bg" />
                  <circle cx="80" cy="80" r="68" className="gauge-circle-progress stroke-[#0066ff]" style={{ strokeDashoffset: 440 - (440 * score) / 100 }} />
                </svg>
                <div className="absolute"><p className="text-4xl font-black">{score}</p><p className="text-[10px] font-extrabold text-[#0066ff]">{scoreLabel(score)}</p></div>
              </div>
              <div className="space-y-3 text-left">
                {Object.entries(analysis.metrics || {}).map(([key, value]) => <MetricBar key={key} label={metricLabels[key] || key} value={Number(value)} />)}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalysisList title="Pontos fortes" items={analysis.strengths || []} positive />
            <AnalysisList title="Pontos de atenção" items={analysis.weaknesses || []} positive={false} />
          </div>

          {canSeeSolutions ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white dark:bg-[#141936] p-6 rounded-2xl border">
                <div className="flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-[#0066ff]" /><h3 className="font-bold">Recomendações comerciais</h3></div>
                <div className="space-y-3">
                  {(analysis.recommendations || []).map((item, index) => (
                    <div key={`${item.title}-${index}`} className="p-4 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e]">
                      <div className="flex justify-between gap-2"><p className="text-xs font-bold">{item.title}</p><span className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${item.priority === 'alta' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{item.priority}</span></div>
                      <p className="text-[11px] text-[#727687] mt-1">{item.detail}</p>
                    </div>
                  ))}
                  {!analysis.recommendations?.length && <p className="text-xs text-[#727687]">Atualize a análise para gerar recomendações.</p>}
                </div>
              </section>
              <section className="bg-gradient-to-br from-[#0050cb] to-[#0066ff] text-white p-6 rounded-2xl">
                <h3 className="font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Cenário comercial</h3>
                <p className="text-xs text-white/75 mt-2">Simulação interna para apoiar a apresentação. Não representa dados oficiais do Google Business Profile.</p>
                <label className="block text-xs font-bold mt-6">Crescimento estimado: +{roiGrowth}%<input type="range" min="5" max="100" value={roiGrowth} onChange={event => setRoiGrowth(Number(event.target.value))} className="w-full mt-3 accent-amber-300" /></label>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-white/10"><p className="text-[10px] text-white/70">Score atual</p><p className="text-2xl font-bold">{score}</p></div>
                  <div className="p-4 rounded-xl bg-white/10"><p className="text-[10px] text-white/70">Potencial projetado</p><p className="text-2xl font-bold">{Math.min(100, score + Math.round((100 - score) * roiGrowth / 100))}</p></div>
                </div>
              </section>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#f4f2fd] dark:bg-[#10142e] border text-xs text-[#727687]">
              Você pode apresentar o diagnóstico e o score. Recomendações e simulações foram reservadas pelo administrador.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="p-3 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e]"><div className="flex items-center gap-1.5 text-[10px] text-[#727687]">{icon}{label}</div><p className="font-bold text-lg mt-1">{value}</p></div>;
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return <div><div className="flex justify-between text-[10px] font-bold mb-1"><span>{label}</span><span>{value}%</span></div><div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div className="h-full bg-[#0066ff]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>;
}

function AnalysisList({ title, items, positive }: { title: string; items: string[]; positive: boolean }) {
  return <section className="bg-white dark:bg-[#141936] p-6 rounded-2xl border"><h3 className="font-bold mb-4">{title}</h3><div className="space-y-2">{items.map((item, index) => <div key={`${item}-${index}`} className={`p-3 rounded-xl flex gap-2 text-xs ${positive ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200'}`}>{positive ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}<span>{item}</span></div>)}{!items.length && <p className="text-xs text-[#727687]">Atualize a análise para preencher esta seção.</p>}</div></section>;
}
