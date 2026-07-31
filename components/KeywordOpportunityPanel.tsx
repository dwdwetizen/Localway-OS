'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Lead } from '@/lib/leads';
import { supabase } from '@/lib/supabase';
import { ctrForLocalPosition, estimateKeywordOpportunity } from '@/lib/keyword-opportunity';

type KeywordIdea = {
  keyword: string;
  avgMonthlySearches: number;
  competition: string;
  competitionIndex: number;
  lowTopOfPageBid: number;
  highTopOfPageBid: number;
  monthlySearchVolumes: Array<{ year: string; month: string; monthlySearches: number }>;
  relevanceScore?: number;
  cluster?: string;
  recommended?: boolean;
};

type Props = {
  selectedLead: Lead;
  leads: Lead[];
  currentPosition: number | null;
  rankedKeyword: string;
  keywordPositions: Record<string, number | null>;
  onUseKeyword: (keyword: string) => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
};

const segments = [
  { value: 'pizzaria', label: 'Pizzaria', aliases: ['pizza', 'pizzaria'], ticket: 80 },
  { value: 'restaurante', label: 'Restaurante', aliases: ['restaurant', 'restaurante'], ticket: 100 },
  { value: 'odontologia', label: 'Clínica odontológica', aliases: ['dentist', 'dental', 'odont'], ticket: 800 },
  { value: 'estetica', label: 'Clínica de estética', aliases: ['estetic', 'beauty'], ticket: 300 },
  { value: 'advocacia', label: 'Advocacia', aliases: ['advoc', 'lawyer'], ticket: 1500 },
  { value: 'academia', label: 'Academia', aliases: ['gym', 'academia'], ticket: 130 },
  { value: 'vidracaria', label: 'Vidraçaria', aliases: ['vidra', 'glass'], ticket: 900 },
  { value: 'marketing digital', label: 'Marketing digital', aliases: ['marketing', 'agencia'], ticket: 1500 },
  { value: 'imobiliaria', label: 'Imobiliária', aliases: ['imobili', 'real estate'], ticket: 3500 },
  { value: 'outro', label: 'Outro segmento', aliases: [], ticket: 500 },
];

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function competitionLabel(value: string) {
  if (value === 'HIGH') return 'Alta';
  if (value === 'MEDIUM') return 'Média';
  if (value === 'LOW') return 'Baixa';
  return 'Sem dados';
}

function specificBusinessSegment(lead: Lead) {
  const category = lead.category?.trim() || '';
  const genericCategories = ['atacadista', 'loja', 'empresa', 'estabelecimento', 'serviço'];
  const nameParts = lead.company_name.split(/[|•]/).map(part => part.trim()).filter(Boolean);
  if (genericCategories.includes(normalize(category)) && nameParts.length > 1) {
    return nameParts.slice(1).join(' ');
  }
  return category || nameParts.slice(1).join(' ') || lead.company_name;
}

export function KeywordOpportunityPanel({
  selectedLead,
  leads,
  currentPosition,
  rankedKeyword,
  keywordPositions,
  onUseKeyword,
  onShowToast,
}: Props) {
  const inferredSegment = segments.find(item => {
    const haystack = normalize(`${selectedLead.category || ''} ${selectedLead.company_name}`);
    return item.aliases.some(alias => haystack.includes(alias));
  }) || segments[segments.length - 1];
  const inferredCustomSegment = specificBusinessSegment(selectedLead);
  const [segment, setSegment] = useState(inferredSegment.value);
  const [customSegment, setCustomSegment] = useState(inferredCustomSegment);
  const [location, setLocation] = useState(selectedLead.city || 'Fortaleza');
  const [keywordInput, setKeywordInput] = useState('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [, setApiValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<KeywordIdea[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [clickToLeadRate, setClickToLeadRate] = useState(5);
  const [closeRate, setCloseRate] = useState(20);
  const [ticket, setTicket] = useState(inferredSegment.ticket);
  const [targetCtr, setTargetCtr] = useState(20);
  const [, setUsingCrmRate] = useState(false);
  const automaticResearchKey = useRef('');

  useEffect(() => {
    const check = async () => {
      if (!supabase) return setConnected(false);
      const { data } = await supabase.auth.getSession();
      const response = await fetch('/api/google-ads/keywords', {
        headers: { Authorization: `Bearer ${data.session?.access_token || ''}` },
        cache: 'no-store',
      });
      const result = await response.json();
      setConnected(Boolean(result.connected));
    };
    void check();
  }, []);

  const selectedSegment = segments.find(item => item.value === segment) || segments[segments.length - 1];
  const crmSample = useMemo(() => {
    const aliases = selectedSegment.aliases;
    const matching = leads.filter(lead => {
      if (!aliases.length) return false;
      const haystack = normalize(`${lead.category || ''} ${lead.company_name}`);
      return aliases.some(alias => haystack.includes(alias));
    }).filter(lead => Boolean(lead.crm_stage));
    const won = matching.filter(lead => lead.crm_stage === 'fechado').length;
    return {
      total: matching.length,
      won,
      rate: matching.length ? (won / matching.length) * 100 : 0,
    };
  }, [leads, selectedSegment.aliases]);

  const research = useCallback(async (forcedKeyword?: string) => {
    if (!supabase) return;
    if (!connected) return onShowToast('O administrador precisa conectar o Google Ads primeiro.', 'error');
    const seed = segment === 'outro' ? customSegment.trim() : segment;
    if (!seed) return onShowToast('Informe o segmento.', 'error');
    const keywords = forcedKeyword
      ? [forcedKeyword.trim()].filter(Boolean)
      : keywordInput.split(/[,;\n]/).map(value => value.trim()).filter(Boolean);
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/google-ads/keywords', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session?.access_token || ''}`,
      },
      body: JSON.stringify({
        segment: seed,
        keywords,
        location,
        businessName: selectedLead.company_name,
        websiteUrl: selectedLead.website_url,
      }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return onShowToast(result.error || 'Não foi possível consultar o volume.', 'error');
    const rows = (result.ideas || []) as KeywordIdea[];
    const preferredKeyword = rows.find(item =>
      normalize(item.keyword) === normalize(forcedKeyword || rankedKeyword))?.keyword
      || rows[0]?.keyword
      || '';
    setApiValidated(true);
    setIdeas(rows);
    setSelectedKeyword(preferredKeyword);
    const clusters = new Set<string>();
    const automaticSelection = rows.filter(item => {
      if (!item.avgMonthlySearches || clusters.size >= 5) return false;
      const cluster = normalize(item.cluster || item.keyword);
      if (clusters.has(cluster)) return false;
      clusters.add(cluster);
      return true;
    }).map(item => item.keyword);
    setSelectedKeywords(automaticSelection);
    if (!keywordInput.trim() && automaticSelection.length) {
      setKeywordInput(automaticSelection.join('\n'));
    }
    if (!rows.length) onShowToast('O Google Ads não encontrou volume para essa combinação.', 'info');
  }, [
    connected,
    customSegment,
    keywordInput,
    location,
    onShowToast,
    rankedKeyword,
    segment,
    selectedLead.company_name,
    selectedLead.website_url,
  ]);

  useEffect(() => {
    if (connected !== true) return;
    const researchKey = `${selectedLead.id}:${normalize(selectedLead.category || selectedLead.company_name)}`;
    if (automaticResearchKey.current === researchKey) return;
    automaticResearchKey.current = researchKey;
    void research();
  }, [
    connected,
    research,
    selectedLead.category,
    selectedLead.company_name,
    selectedLead.id,
  ]);

  const changeSegment = (value: string) => {
    setSegment(value);
    const next = segments.find(item => item.value === value);
    if (next) setTicket(next.ticket);
    setUsingCrmRate(false);
  };

  const applyCrmRate = () => {
    if (crmSample.total < 5) return onShowToast('É preciso ter pelo menos 5 oportunidades desse segmento no CRM.', 'info');
    setCloseRate(Number(crmSample.rate.toFixed(1)));
    setUsingCrmRate(true);
  };

  const positionForKeyword = useCallback((keyword: string) => {
    const key = normalize(keyword);
    if (Object.prototype.hasOwnProperty.call(keywordPositions, key)) {
      return keywordPositions[key];
    }
    return key === normalize(rankedKeyword) ? currentPosition : null;
  }, [currentPosition, keywordPositions, rankedKeyword]);

  const selectedIdeas = ideas.filter(item => selectedKeywords.includes(item.keyword));
  const estimate = estimateKeywordOpportunity(
    selectedIdeas.map(item => ({
      keyword: item.keyword,
      avgMonthlySearches: item.avgMonthlySearches,
      position: positionForKeyword(item.keyword),
    })),
    {
      clickToLeadRate,
      closeRate,
      averageTicket: ticket,
      targetCtr,
    },
  );
  const likely = estimate.scenarios.likely;
  const tableRows = selectedIdeas.map(item => {
    const position = positionForKeyword(item.keyword);
    const ctr = ctrForLocalPosition(position) || 0;
    const clicks = Math.round(item.avgMonthlySearches * (ctr / 100));
    const rowEstimate = estimateKeywordOpportunity([{
      keyword: item.keyword,
      avgMonthlySearches: item.avgMonthlySearches,
      position,
    }], {
      clickToLeadRate,
      closeRate,
      averageTicket: ticket,
      targetCtr,
    }).scenarios.likely;
    const months = item.monthlySearchVolumes || [];
    const latest = months.at(-1)?.monthlySearches || 0;
    const previous = months.at(-2)?.monthlySearches || latest;
    const trend = previous ? Math.round(((latest - previous) / previous) * 100) : 0;
    return {
      ...item,
      position,
      ctr,
      clicks,
      trend,
      lost: Math.round(rowEstimate.incrementalLeads),
      lostRevenue: Math.round(rowEstimate.opportunityRevenue),
      cpc: (item.lowTopOfPageBid + item.highTopOfPageBid) / 2,
    };
  });

  return <div className="space-y-3">
    <div className={`rounded-xl border px-4 py-3 ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      <p className="text-[11px] font-semibold">{connected === null ? 'Verificando Google Ads…' : connected ? 'Google Ads Keyword Planner conectado' : 'Google Ads Keyword Planner ainda não está conectado'}</p>
      <p className="mt-0.5 text-[10px] opacity-75">{connected ? 'Volumes, CPC e concorrência abaixo vêm da integração real.' : 'Conecte a conta em Administração → Integrações para consultar dados reais.'}</p>
    </div>

    <section className="lw-panel p-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_2.1fr]">
        <label className="text-[11px] font-semibold">Segmento<select value={segment} onChange={event => changeSegment(event.target.value)} className="input mt-1">{segments.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="text-[11px] font-semibold">Cidade ou bairro<input value={location} onChange={event => setLocation(event.target.value)} className="input mt-1" placeholder="Fortaleza"/></label>
        <label className="text-[11px] font-semibold">Palavras-chave (uma por linha)<textarea value={keywordInput} onChange={event => setKeywordInput(event.target.value)} rows={3} className="input mt-1 min-h-[76px] resize-none" placeholder="Deixe vazio para gerar automaticamente pelo perfil"/></label>
      </div>
      {segment === 'outro' && <label className="mt-3 block text-[11px] font-semibold">Descrição do segmento<input value={customSegment} onChange={event => setCustomSegment(event.target.value)} className="input mt-1" placeholder="Ex.: atacado de semijoias"/></label>}
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-[11px] font-semibold">Taxa de conversão em lead (%)<input type="number" min={0} value={clickToLeadRate} onChange={event => setClickToLeadRate(Number(event.target.value) || 0)} className="input mt-1"/></label>
        <label className="text-[11px] font-semibold">Ticket médio (R$)<input type="number" min={0} value={ticket} onChange={event => setTicket(Number(event.target.value) || 0)} className="input mt-1"/></label>
        <button disabled={loading || !connected} onClick={() => void research()} className="lw-primary-button self-end px-8 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}Consultar volume</button>
      </div>
    </section>

    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <VolumeStat label="Volume total/mês" value={estimate.totalMeasuredVolume.toLocaleString('pt-BR')} tone="blue"/>
      <VolumeStat label="Palavras" value={String(selectedIdeas.length)}/>
      <VolumeStat label="Oportunidades perdidas" value={Math.round(likely.incrementalLeads).toLocaleString('pt-BR')} hint="estimativa mensal" tone="orange"/>
      <VolumeStat label="Faturamento perdido" value={currency(likely.opportunityRevenue)} hint="estimativa mensal" tone="red"/>
    </div>

    <section className="lw-panel overflow-hidden">
      {!tableRows.length ? <div className="p-10 text-center text-xs text-[var(--text-secondary)]">Consulte o volume para preencher a tabela com dados reais do Google Ads.</div> : <>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[900px] text-[11px]">
            <thead className="bg-[var(--surface-container-low)] text-[10px] uppercase tracking-wide text-[var(--text-secondary)]"><tr>
              <th className="px-3 py-2.5 text-left">Palavra-chave</th><th className="px-3 py-2.5 text-right">Volume</th><th className="px-3 py-2.5 text-right">Tend.</th><th className="px-3 py-2.5 text-left">Concorrência</th><th className="px-3 py-2.5 text-right">CPC</th><th className="px-3 py-2.5 text-right">Posição</th><th className="px-3 py-2.5 text-right">CTR</th><th className="px-3 py-2.5 text-right">Cliques</th><th className="px-3 py-2.5 text-right">Perdidas</th><th className="px-3 py-2.5 text-right">R$ perdido</th>
            </tr></thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">{tableRows.map(row => <tr key={row.keyword} className={row.keyword === selectedKeyword ? 'bg-blue-50/60 dark:bg-blue-950/20' : 'hover:bg-[var(--surface-container-low)]'}>
              <td className="max-w-56 px-3 py-2.5"><button onClick={() => { setSelectedKeyword(row.keyword); void onUseKeyword(row.keyword); }} className="flex items-center gap-1 truncate font-medium hover:text-[var(--primary-main)]">{row.keyword}<MapPin className="h-3 w-3 shrink-0"/></button></td>
              <td className="px-3 py-2.5 text-right tabular-nums">{row.avgMonthlySearches.toLocaleString('pt-BR')}</td>
              <td className={`px-3 py-2.5 text-right font-medium ${row.trend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{row.trend >= 0 ? <TrendingUp className="mr-0.5 inline h-3 w-3"/> : <TrendingDown className="mr-0.5 inline h-3 w-3"/>}{row.trend > 0 ? '+' : ''}{row.trend}%</td>
              <td className="px-3 py-2.5"><span className={`rounded px-1.5 py-0.5 font-medium ${row.competition === 'HIGH' ? 'bg-rose-100 text-rose-600' : row.competition === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{competitionLabel(row.competition)}</span></td>
              <td className="px-3 py-2.5 text-right">{currency(row.cpc)}</td><td className="px-3 py-2.5 text-right">{row.position === null ? '—' : row.position > 20 ? '20+' : `#${row.position.toFixed(0)}`}</td><td className="px-3 py-2.5 text-right">{row.ctr.toFixed(1)}%</td><td className="px-3 py-2.5 text-right">{row.clicks}</td><td className="px-3 py-2.5 text-right text-orange-500">{row.lost}</td><td className="px-3 py-2.5 text-right font-semibold text-rose-500">{currency(row.lostRevenue)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)] lg:hidden">{tableRows.map(row => <li key={row.keyword} className="p-3">
          <div className="flex items-start justify-between gap-2"><button onClick={() => void onUseKeyword(row.keyword)} className="text-left text-[12px] font-semibold">{row.keyword}</button><span className={`text-[10px] font-semibold ${row.trend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{row.trend > 0 ? '+' : ''}{row.trend}%</span></div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]"><SmallCell label="Volume" value={row.avgMonthlySearches.toLocaleString('pt-BR')}/><SmallCell label="CPC" value={currency(row.cpc)}/><SmallCell label="Posição" value={row.position === null ? '—' : row.position > 20 ? '20+' : `#${row.position.toFixed(0)}`}/></div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-rose-50 px-2.5 py-2 text-rose-600"><span className="text-[10px]">{row.lost} oportunidades</span><strong className="text-[11px]">{currency(row.lostRevenue)}</strong></div>
        </li>)}</ul>
      </>}
    </section>

    <details className="lw-panel p-3 text-[10px] text-[var(--text-secondary)]">
      <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Premissas avançadas da estimativa</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <NumberField label="CTR desejado no Top 3" help="Meta de cliques no Top 3." value={targetCtr} onChange={setTargetCtr} suffix="%"/>
        <NumberField label="Leads que viram vendas" help="Taxa de fechamento." value={closeRate} onChange={value => { setCloseRate(value); setUsingCrmRate(false); }} suffix="%"/>
        <div className="rounded-lg border p-2"><p>CRM do segmento</p><strong className="mt-1 block text-[var(--text-primary)]">{crmSample.total ? `${crmSample.won}/${crmSample.total} · ${crmSample.rate.toFixed(1)}%` : 'Sem amostra'}</strong><button onClick={applyCrmRate} disabled={crmSample.total < 5} className="mt-1 font-semibold text-[var(--primary-main)] disabled:opacity-40">Aplicar taxa real</button></div>
      </div>
    </details>
    <p className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-container-low)] px-3 py-2.5 text-[10px] leading-relaxed text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">Importante:</strong> CTR, conversão, oportunidades e faturamento perdido são estimativas comerciais baseadas nos dados reais disponíveis e nas premissas informadas. Não constituem garantia de resultado.</p>
  </div>;
}

function NumberField({ label, help, value, displayValue, onChange, prefix, suffix, disabled = false }: {
  label: string;
  help: string;
  value: number;
  displayValue?: string;
  onChange?: (value: number) => void;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
}) {
  return <label className="text-[10px] text-[#727687]">{label}<span className="block min-h-7 mt-0.5 text-[9px] leading-3 text-[#9699a5]">{help}</span><div className="mt-1 flex items-center rounded-xl border bg-white dark:bg-[#141936] px-3"><span className="text-xs">{prefix}</span><input disabled={disabled} type={displayValue ? 'text' : 'number'} min={displayValue ? undefined : 0} step={displayValue ? undefined : 0.1} value={displayValue ?? value} onChange={event => onChange?.(Number(event.target.value) || 0)} className="w-full bg-transparent py-2 text-xs font-bold outline-none disabled:opacity-70"/><span className="text-xs">{suffix}</span></div></label>;
}

function VolumeStat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'blue' | 'orange' | 'red' }) {
  const color = tone === 'blue' ? 'text-blue-600' : tone === 'orange' ? 'text-orange-500' : tone === 'red' ? 'text-rose-500' : 'text-[var(--text-primary)]';
  return <div className="lw-panel min-w-0 p-3.5"><p className="text-[9px] uppercase tracking-wide text-[var(--text-secondary)]">{label}</p><p className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${color}`}>{value}</p>{hint && <p className="mt-1 text-[9px] text-[var(--text-secondary)]">{hint}</p>}</div>;
}

function SmallCell({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-[var(--surface-container-low)] px-2 py-1.5"><p className="text-[9px] text-[var(--text-secondary)]">{label}</p><p className="font-semibold tabular-nums">{value}</p></div>;
}
