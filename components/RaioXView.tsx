'use client';

import Image from 'next/image';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Crosshair,
  ExternalLink,
  Globe2,
  History,
  ImageIcon,
  Link2,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react';
import { useLeads } from '@/hooks/use-leads';
import { Lead, LeadAnalysisData } from '@/lib/leads';
import { supabase } from '@/lib/supabase';

interface RaioXViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiPitchModal: (companyName: string) => void;
}

type CompetitorProfile = {
  google_place_id: string | null;
  company_name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  google_maps_url: string | null;
  website_url: string | null;
  rating: number | null;
  review_count: number;
  photo_count: number;
  has_website: boolean;
  health_score: number;
  latitude: number | null;
  longitude: number | null;
  photo_name: string | null;
  distance_km: number | null;
};

type CompetitorScan = {
  id: string;
  lead_id: string;
  radius_m: number;
  category: string;
  target: CompetitorProfile;
  competitors: CompetitorProfile[];
  created_at: string;
};

const radiusOptions = [
  { value: 1000, label: '1 km' },
  { value: 3000, label: '3 km' },
  { value: 5000, label: '5 km' },
];

function safeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function profileScore(profile: CompetitorProfile) {
  return safeNumber(profile.health_score);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function RaioXView({ onShowToast, onOpenAiPitchModal }: RaioXViewProps) {
  const { leads, loading, error, createLead, updateLead } = useLeads();
  const analyzable = useMemo(
    () => leads.filter(lead =>
      Boolean(lead.google_place_id)
      && typeof lead.latitude === 'number'
      && typeof lead.longitude === 'number'),
    [leads],
  );
  const [selectedId, setSelectedId] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [radius, setRadius] = useState(3000);
  const [resolving, setResolving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState<CompetitorScan[]>([]);
  const [activeScan, setActiveScan] = useState<CompetitorScan | null>(null);

  const selected = analyzable.find(lead => lead.id === selectedId) || analyzable[0] || null;
  const currentProfile = activeScan?.lead_id === selected?.id ? activeScan.target : null;
  const competitors = useMemo(
    () => activeScan?.lead_id === selected?.id ? activeScan.competitors : [],
    [activeScan, selected?.id],
  );

  useEffect(() => {
    if (!supabase) {
      const timer = window.setTimeout(() => setHistoryLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
    let active = true;
    const load = async () => {
      const { data, error: requestError } = await supabase!
        .from('local_competitor_scans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (!active) return;
      if (requestError) onShowToast(requestError.message, 'error');
      else {
        const scans = (data || []) as CompetitorScan[];
        setHistory(scans);
        setActiveScan(scans[0] || null);
        if (scans[0]) {
          setSelectedId(scans[0].lead_id);
          setRadius(scans[0].radius_m);
        }
      }
      setHistoryLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [onShowToast]);

  const benchmark = useMemo(() => {
    if (!currentProfile) return null;
    const all = [currentProfile, ...competitors];
    const ranking = [...all].sort((first, second) => profileScore(second) - profileScore(first));
    const position = ranking.findIndex(item =>
      item.google_place_id === currentProfile.google_place_id) + 1;
    const averageReviews = competitors.length
      ? Math.round(competitors.reduce((total, item) => total + safeNumber(item.review_count), 0) / competitors.length)
      : 0;
    const reviewGap = Math.max(averageReviews - safeNumber(currentProfile.review_count), 0);
    const strongest = competitors.reduce<CompetitorProfile | null>(
      (best, item) => !best || profileScore(item) > profileScore(best) ? item : best,
      null,
    );
    return { position, total: all.length, averageReviews, reviewGap, strongest };
  }, [competitors, currentProfile]);

  const selectCompany = (leadId: string) => {
    setSelectedId(leadId);
    const latest = history.find(scan => scan.lead_id === leadId) || null;
    setActiveScan(latest);
    if (latest) setRadius(latest.radius_m);
  };

  const resolveGoogleProfile = async () => {
    if (!googleMapsUrl.trim() || !supabase) {
      onShowToast('Cole o link do perfil da empresa no Google Maps.', 'error');
      return;
    }
    setResolving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          action: 'resolve_local_profile',
          googleMapsUrl: googleMapsUrl.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar esse perfil.');
      const place = result.place as Partial<Lead>;
      if (!place.google_place_id) throw new Error('O Google não retornou a identificação da empresa.');
      if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') {
        throw new Error('O Google não retornou a localização exata da empresa.');
      }

      const existing = leads.find(lead => lead.google_place_id === place.google_place_id);
      let saved: Lead;
      if (existing) {
        const updated = await updateLead(existing.id, {
          ...place,
          analysis_data: (place.analysis_data || existing.analysis_data || {}) as LeadAnalysisData,
          archived_at: null,
          archived_by: null,
        });
        if (updated.error || !updated.data) throw new Error(updated.error || 'Não foi possível atualizar a empresa.');
        saved = updated.data;
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
          google_place_id: place.google_place_id,
          google_maps_url: place.google_maps_url || googleMapsUrl.trim(),
          website_url: place.website_url || null,
          rating: place.rating ?? null,
          review_count: place.review_count ?? null,
          photo_count: place.photo_count ?? null,
          has_website: place.has_website ?? null,
          health_score: place.health_score ?? null,
          opportunity: place.opportunity || null,
          latitude: place.latitude,
          longitude: place.longitude,
          analysis_data: (place.analysis_data || {}) as LeadAnalysisData,
          analysed_at: place.analysed_at || new Date().toISOString(),
          source: 'manual',
          status: 'novo',
          next_action_at: null,
        });
        if (created.error || !created.data) throw new Error(created.error || 'Não foi possível salvar a empresa.');
        saved = created.data;
      }

      setSelectedId(saved.id);
      setActiveScan(history.find(scan => scan.lead_id === saved.id) || null);
      setGoogleMapsUrl('');
      onShowToast(`${saved.company_name} carregada. Agora clique em “Analisar concorrentes”.`, 'success');
    } catch (requestError) {
      onShowToast(requestError instanceof Error ? requestError.message : 'Erro ao carregar o perfil.', 'error');
    } finally {
      setResolving(false);
    }
  };

  const runCompetitorScan = async () => {
    if (!selected || !supabase) {
      onShowToast('Carregue ou selecione uma empresa primeiro.', 'error');
      return;
    }
    if (!selected.category) {
      onShowToast('O perfil não possui um segmento identificado pelo Google.', 'error');
      return;
    }
    setScanning(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          action: 'local_competitors',
          leadId: selected.id,
          placeId: selected.google_place_id,
          category: selected.category,
          latitude: selected.latitude,
          longitude: selected.longitude,
          radiusMeters: radius,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível analisar os concorrentes.');
      const scan = result.scan as CompetitorScan;
      setActiveScan(scan);
      setHistory(current => [scan, ...current.filter(item => item.id !== scan.id)].slice(0, 30));
      onShowToast(`${scan.competitors.length} concorrentes encontrados com dados reais do Google.`, 'success');
    } catch (requestError) {
      onShowToast(requestError instanceof Error ? requestError.message : 'Erro ao consultar a região.', 'error');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0066ff]/10 text-[#0066ff] flex items-center justify-center">
            <Crosshair className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Radar de Concorrentes Locais</h2>
            <p className="text-xs text-[#727687] mt-0.5">Compare uma empresa com perfis do mesmo segmento encontrados na região.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#727687]">Raio:</span>
          {radiusOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRadius(option.value)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${
                radius === option.value
                  ? 'bg-[#0066ff] text-white shadow-sm'
                  : 'bg-[#f4f2fd] dark:bg-[#10142e] text-[#727687] hover:text-[#1a1b22]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <section className="p-5 rounded-2xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/35 dark:border-[#2e366b] shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#727687]" />
            <input
              type="url"
              value={googleMapsUrl}
              onChange={event => setGoogleMapsUrl(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') void resolveGoogleProfile();
              }}
              placeholder="Cole o link curto ou completo do perfil no Google Maps"
              className="w-full pl-9 pr-3 py-3 rounded-xl bg-[#f8f9fc] dark:bg-[#10142e] border border-[#c2c6d8]/50 text-sm outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
            />
          </div>
          <button
            type="button"
            disabled={resolving || !googleMapsUrl.trim()}
            onClick={() => void resolveGoogleProfile()}
            className="px-5 py-3 rounded-xl border border-[#0066ff] text-[#0066ff] hover:bg-[#0066ff]/5 disabled:opacity-50 text-xs font-semibold flex justify-center items-center gap-2"
          >
            {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            {resolving ? 'Carregando...' : 'Carregar perfil'}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-xl bg-[#f8f9fc] dark:bg-[#10142e] border border-[#c2c6d8]/30">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#727687]">Empresa analisada</p>
            <select
              value={selected?.id || ''}
              onChange={event => selectCompany(event.target.value)}
              className="mt-1 max-w-full md:min-w-[360px] bg-white dark:bg-[#141936] border border-[#c2c6d8]/40 text-sm font-semibold px-3 py-2 rounded-xl"
            >
              {!analyzable.length && <option value="">Nenhuma empresa carregada</option>}
              {analyzable.map(lead => (
                <option key={lead.id} value={lead.id}>{lead.company_name} — {lead.category || 'Sem segmento'}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!selected || scanning}
            onClick={() => void runCompetitorScan()}
            className="px-5 py-3 rounded-xl bg-[#0066ff] hover:bg-[#0050cb] disabled:opacity-50 text-white text-xs font-semibold flex justify-center items-center gap-2"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {scanning ? 'Consultando o Google...' : 'Analisar concorrentes'}
          </button>
        </div>
      </section>

      {(loading || historyLoading) && (
        <div className="p-12 grid place-items-center rounded-2xl bg-white border border-[#c2c6d8]/30">
          <Loader2 className="w-6 h-6 animate-spin text-[#0066ff]" />
        </div>
      )}
      {error && <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">{error}</div>}

      {!loading && !historyLoading && !currentProfile && (
        <div className="min-h-[360px] grid place-items-center p-8 text-center rounded-2xl bg-gradient-to-br from-[#f8fafc] to-[#eef2f6] dark:from-[#141936] dark:to-[#10142e] border border-[#c2c6d8]/35">
          <div>
            <Building2 className="w-10 h-10 mx-auto text-[#0066ff]/70" />
            <p className="font-semibold mt-3">Pronto para comparar</p>
            <p className="text-xs text-[#727687] mt-1 max-w-md">Cole o perfil do Google, escolha o raio e gere uma comparação com empresas reais do mesmo segmento.</p>
          </div>
        </div>
      )}

      {currentProfile && activeScan && benchmark && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard icon={Crosshair} label="Posição no comparativo" value={`${benchmark.position}º de ${benchmark.total}`} detail="Pelo score do perfil" />
            <MetricCard icon={Star} label="Nota no Google" value={currentProfile.rating ? currentProfile.rating.toFixed(1) : 'Sem nota'} detail={`${currentProfile.review_count || 0} avaliações`} />
            <MetricCard icon={TrendingUp} label="Média dos concorrentes" value={`${benchmark.averageReviews}`} detail="avaliações por perfil" />
            <MetricCard icon={CheckCircle2} label="Oportunidade" value={benchmark.reviewGap ? `+${benchmark.reviewGap}` : 'Em dia'} detail={benchmark.reviewGap ? 'avaliações para alcançar a média' : 'acima da média regional'} />
          </section>

          <section className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[#c2c6d8]/30 flex flex-col md:flex-row md:items-start justify-between gap-4 bg-[#0066ff]/5">
              <div className="flex gap-3 min-w-0">
                <ProfilePhoto profile={currentProfile} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-base">{currentProfile.company_name}</h3>
                    <span className="px-2 py-1 rounded-lg bg-[#0066ff] text-white text-[9px] font-bold uppercase">Empresa analisada</span>
                  </div>
                  <p className="text-xs text-[#727687] mt-1">{currentProfile.category} • {currentProfile.address}</p>
                  <p className="text-[10px] text-[#727687] mt-1">Dados consultados em {formatDate(activeScan.created_at)} • Raio de {activeScan.radius_m / 1000} km</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentProfile.google_maps_url && <a href={currentProfile.google_maps_url} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl border border-[#c2c6d8]/45 text-xs font-semibold text-[#0066ff] flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Google</a>}
                <button type="button" onClick={() => onOpenAiPitchModal(currentProfile.company_name)} className="px-3 py-2 rounded-xl bg-[#0066ff] text-white text-xs font-semibold flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Gerar abordagem</button>
              </div>
            </div>

            <div className="p-4 border-b border-[#c2c6d8]/25 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Comparativo regional</h3>
                <p className="text-[10px] text-[#727687]">Resultados públicos disponíveis no Google Places. Ordenados pelo score de presença digital.</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#f4f2fd] text-[10px] font-semibold">{competitors.length} concorrentes</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead className="bg-[#f8f9fc] dark:bg-[#10142e] text-[#727687]">
                  <tr>
                    <th className="p-4 font-semibold">Empresa</th>
                    <th className="p-4 font-semibold">Distância</th>
                    <th className="p-4 font-semibold">Nota</th>
                    <th className="p-4 font-semibold">Avaliações</th>
                    <th className="p-4 font-semibold">Fotos disponíveis</th>
                    <th className="p-4 font-semibold">Site</th>
                    <th className="p-4 font-semibold">Score</th>
                    <th className="p-4 font-semibold text-right">Perfil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c2c6d8]/25 dark:divide-[#2e366b]">
                  {[currentProfile, ...competitors]
                    .sort((first, second) => profileScore(second) - profileScore(first))
                    .map(profile => {
                      const isTarget = profile.google_place_id === currentProfile.google_place_id;
                      return (
                        <tr key={profile.google_place_id || profile.company_name} className={isTarget ? 'bg-[#0066ff]/5' : 'hover:bg-[#f8f9fc] dark:hover:bg-[#10142e]'}>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <ProfilePhoto profile={profile} small />
                              <div className="min-w-0">
                                <p className="font-semibold max-w-[250px] truncate">{profile.company_name}</p>
                                <p className="text-[10px] text-[#727687] max-w-[250px] truncate">{profile.address || profile.category}</p>
                              </div>
                              {isTarget && <span className="px-1.5 py-0.5 rounded bg-[#0066ff] text-white text-[8px] font-bold uppercase">Analisada</span>}
                            </div>
                          </td>
                          <td className="p-4">{profile.distance_km === null ? '—' : `${profile.distance_km.toFixed(1)} km`}</td>
                          <td className="p-4"><span className="inline-flex items-center gap-1 text-amber-500 font-semibold"><Star className="w-3.5 h-3.5 fill-current" />{profile.rating ? profile.rating.toFixed(1) : '—'}</span></td>
                          <td className="p-4 font-semibold">{profile.review_count || 0}</td>
                          <td className="p-4"><span className="inline-flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-[#727687]" />{profile.photo_count || 0}</span></td>
                          <td className="p-4">{profile.has_website ? <span className="text-emerald-700 font-semibold">Possui</span> : <span className="text-rose-600 font-semibold">Não possui</span>}</td>
                          <td className="p-4"><ScoreBadge score={profileScore(profile)} /></td>
                          <td className="p-4 text-right">{profile.google_maps_url ? <a href={profile.google_maps_url} target="_blank" rel="noreferrer" className="inline-flex p-2 rounded-lg text-[#0066ff] hover:bg-[#0066ff]/10" title="Abrir no Google"><ExternalLink className="w-4 h-4" /></a> : '—'}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>

          {benchmark.strongest && (
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <InsightCard
                icon={Star}
                title="Referência da região"
                text={`${benchmark.strongest.company_name} tem o melhor score entre os concorrentes encontrados (${profileScore(benchmark.strongest)}).`}
              />
              <InsightCard
                icon={TrendingUp}
                title="Diferença de avaliações"
                text={benchmark.reviewGap
                  ? `A empresa precisa de aproximadamente ${benchmark.reviewGap} avaliações para alcançar a média regional de ${benchmark.averageReviews}.`
                  : `A empresa já está na média ou acima dos ${benchmark.averageReviews} comentários dos concorrentes.`}
              />
              <InsightCard
                icon={Globe2}
                title="Completude do perfil"
                text={currentProfile.has_website && currentProfile.phone
                  ? 'Site e telefone estão disponíveis no perfil, dois pontos importantes para conversão.'
                  : `Falta cadastrar ${!currentProfile.has_website && !currentProfile.phone ? 'site e telefone' : !currentProfile.has_website ? 'o site' : 'o telefone'} no perfil.`}
              />
            </section>
          )}
        </>
      )}

      <section className="rounded-2xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/35 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#c2c6d8]/30 flex items-center gap-2">
          <History className="w-4 h-4 text-[#0066ff]" />
          <div>
            <h3 className="font-semibold text-sm">Histórico de comparações</h3>
            <p className="text-[10px] text-[#727687]">Consultas anteriores desta conta de usuário.</p>
          </div>
        </div>
        {!history.length ? (
          <div className="p-8 text-center text-xs text-[#727687]">Nenhuma comparação gerada ainda.</div>
        ) : (
          <div className="divide-y divide-[#c2c6d8]/25">
            {history.map(scan => (
              <button
                key={scan.id}
                type="button"
                onClick={() => {
                  setActiveScan(scan);
                  setSelectedId(scan.lead_id);
                  setRadius(scan.radius_m);
                }}
                className={`w-full p-4 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#f8f9fc] dark:hover:bg-[#10142e] ${activeScan?.id === scan.id ? 'bg-[#0066ff]/5' : ''}`}
              >
                <div>
                  <p className="text-xs font-semibold">{scan.target.company_name} <span className="font-normal text-[#727687]">• {scan.category}</span></p>
                  <p className="text-[10px] text-[#727687] mt-0.5">{formatDate(scan.created_at)} • Raio de {scan.radius_m / 1000} km</p>
                </div>
                <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-semibold">{scan.competitors.length} concorrentes</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/30 shadow-sm">
      <div className="flex items-center gap-2 text-[#727687]"><Icon className="w-4 h-4 text-[#0066ff]" /><span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span></div>
      <p className="text-xl font-semibold mt-2">{value}</p>
      <p className="text-[10px] text-[#727687] mt-0.5">{detail}</p>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-[#141936] border border-[#c2c6d8]/30 shadow-sm">
      <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-[#0066ff]" /><h4 className="text-xs font-semibold">{title}</h4></div>
      <p className="text-[11px] leading-relaxed text-[#727687] mt-2">{text}</p>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const className = score >= 80
    ? 'bg-emerald-50 text-emerald-700'
    : score >= 60
      ? 'bg-amber-50 text-amber-700'
      : 'bg-rose-50 text-rose-700';
  return <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-bold ${className}`}>{score}/100</span>;
}

function ProfilePhoto({ profile, small = false }: { profile: CompetitorProfile; small?: boolean }) {
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    if (!profile.photo_name || !supabase) return;
    let active = true;
    let objectUrl = '';
    const load = async () => {
      const { data } = await supabase!.auth.getSession();
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token || ''}`,
        },
        body: JSON.stringify({ action: 'photo', photoName: profile.photo_name }),
      });
      if (!response.ok || !active) return;
      objectUrl = URL.createObjectURL(await response.blob());
      if (active) setPhotoUrl(objectUrl);
    };
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile.photo_name]);

  const sizeClass = small ? 'w-10 h-10 rounded-xl' : 'w-14 h-14 rounded-2xl';
  return photoUrl
    ? <Image src={photoUrl} alt="" width={small ? 40 : 56} height={small ? 40 : 56} unoptimized className={`shrink-0 object-cover bg-[#eef2f6] ${sizeClass}`} />
    : <div className={`shrink-0 bg-gradient-to-br from-[#e9efff] to-[#dce6ff] text-[#0066ff] grid place-items-center font-semibold ${sizeClass}`}>{profile.company_name.slice(0, 2).toUpperCase()}</div>;
}
