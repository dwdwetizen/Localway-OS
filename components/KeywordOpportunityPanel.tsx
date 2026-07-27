'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Calculator, Loader2, Search, TrendingUp } from 'lucide-react';
import { Lead } from '@/lib/leads';
import { supabase } from '@/lib/supabase';

type KeywordIdea = {
  keyword: string;
  avgMonthlySearches: number;
  competition: string;
  competitionIndex: number;
  lowTopOfPageBid: number;
  highTopOfPageBid: number;
  monthlySearchVolumes: Array<{ year: string; month: string; monthlySearches: number }>;
};

type Props = {
  selectedLead: Lead;
  leads: Lead[];
  currentPosition: number | null;
  rankedKeyword: string;
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

function ctrForPosition(position: number | null) {
  if (position === null || position > 20) return 0.3;
  if (position === 1) return 30;
  if (position === 2) return 18;
  if (position === 3) return 12;
  if (position === 4) return 8;
  if (position <= 10) return 4;
  return 1;
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

export function KeywordOpportunityPanel({
  selectedLead,
  leads,
  currentPosition,
  rankedKeyword,
  onUseKeyword,
  onShowToast,
}: Props) {
  const inferredSegment = segments.find(item => {
    const haystack = normalize(`${selectedLead.category || ''} ${selectedLead.company_name}`);
    return item.aliases.some(alias => haystack.includes(alias));
  }) || segments[segments.length - 1];
  const [segment, setSegment] = useState(inferredSegment.value);
  const [customSegment, setCustomSegment] = useState(selectedLead.category || '');
  const [location, setLocation] = useState(selectedLead.city || 'Fortaleza');
  const [keywordInput, setKeywordInput] = useState('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<KeywordIdea[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState('');
  const [clickToLeadRate, setClickToLeadRate] = useState(5);
  const [closeRate, setCloseRate] = useState(20);
  const [ticket, setTicket] = useState(inferredSegment.ticket);
  const [targetCtr, setTargetCtr] = useState(20);
  const [usingCrmRate, setUsingCrmRate] = useState(false);

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

  const research = async () => {
    if (!supabase) return;
    if (!connected) return onShowToast('O administrador precisa conectar o Google Ads primeiro.', 'error');
    const seed = segment === 'outro' ? customSegment.trim() : segment;
    if (!seed) return onShowToast('Informe o segmento.', 'error');
    const keywords = keywordInput.split(/[,;\n]/).map(value => value.trim()).filter(Boolean);
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/google-ads/keywords', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session?.access_token || ''}`,
      },
      body: JSON.stringify({ segment: seed, keywords, location }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) return onShowToast(result.error || 'Não foi possível consultar o volume.', 'error');
    setIdeas(result.ideas || []);
    setSelectedKeyword(result.ideas?.[0]?.keyword || '');
    if (!result.ideas?.length) onShowToast('O Google Ads não encontrou volume para essa combinação.', 'info');
  };

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

  const idea = ideas.find(item => item.keyword === selectedKeyword) || null;
  const positionApplies = idea && normalize(idea.keyword) === normalize(rankedKeyword);
  const effectivePosition = positionApplies ? currentPosition : null;
  const currentCtr = ctrForPosition(effectivePosition);
  const volume = idea?.avgMonthlySearches || 0;
  const leadsCurrent = volume * (currentCtr / 100) * (clickToLeadRate / 100);
  const salesCurrent = leadsCurrent * (closeRate / 100);
  const leadsTop = volume * (targetCtr / 100) * (clickToLeadRate / 100);
  const salesTop = leadsTop * (closeRate / 100);
  const currentRevenue = salesCurrent * ticket;
  const topRevenue = salesTop * ticket;
  const lostRevenue = Math.max(topRevenue - currentRevenue, 0);

  return <section className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/35 overflow-hidden">
    <div className="p-4 sm:p-5 border-b border-[#c2c6d8]/30 flex flex-wrap sm:flex-nowrap items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center"><TrendingUp className="w-5 h-5"/></div>
      <div className="flex-1"><h3 className="font-semibold">Potencial de palavras-chave e faturamento</h3><p className="text-[11px] text-[#727687] mt-1">Volume oficial do Google Ads combinado com premissas comerciais transparentes.</p></div>
      <span className={`ml-[3.25rem] sm:ml-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{connected === null ? 'Verificando…' : connected ? 'Google Ads conectado' : 'Google Ads pendente'}</span>
    </div>
    <div className="p-4 sm:p-5 grid lg:grid-cols-[1fr_1.1fr] gap-5">
      <div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold">Segmento<select value={segment} onChange={event => changeSegment(event.target.value)} className="input mt-1">{segments.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="text-xs font-semibold">Cidade/região<input value={location} onChange={event => setLocation(event.target.value)} className="input mt-1" placeholder="Fortaleza"/></label>
          {segment === 'outro' && <label className="text-xs font-semibold sm:col-span-2">Nome do segmento<input value={customSegment} onChange={event => setCustomSegment(event.target.value)} className="input mt-1" placeholder="Ex.: manutenção de ar-condicionado"/></label>}
          <label className="text-xs font-semibold sm:col-span-2">Palavras específicas — opcional<input value={keywordInput} onChange={event => setKeywordInput(event.target.value)} className="input mt-1" placeholder="Ex.: pizzaria, delivery de pizza — separe por vírgulas"/><span className="block text-[10px] font-normal text-[#727687] mt-1">Sem preencher, o Google Ads gera sugestões a partir do segmento.</span></label>
        </div>
        <button disabled={loading || !connected} onClick={() => void research()} className="mt-3 w-full sm:w-auto min-h-11 px-4 py-2.5 rounded-xl bg-[#0066ff] text-white text-xs font-semibold flex justify-center items-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}Buscar volume e sugestões</button>
        {!!ideas.length && <div className="mt-4 max-h-72 overflow-auto rounded-xl border divide-y">
          {ideas.slice(0, 30).map(item => <button key={item.keyword} onClick={() => setSelectedKeyword(item.keyword)} className={`w-full p-3 text-left flex items-center justify-between gap-3 ${selectedKeyword === item.keyword ? 'bg-blue-50' : 'hover:bg-[#f8f9fc]'}`}>
            <div><p className="text-xs font-semibold">{item.keyword}</p><p className="text-[10px] text-[#727687]">Concorrência {competitionLabel(item.competition)} • índice {item.competitionIndex}</p></div>
            <strong className="text-xs whitespace-nowrap">{item.avgMonthlySearches.toLocaleString('pt-BR')}/mês</strong>
          </button>)}
        </div>}
      </div>

      <div className="rounded-2xl bg-[#f8f9fc] dark:bg-[#10142e] p-4 border border-[#c2c6d8]/30">
        <div className="flex items-center gap-2"><Calculator className="w-5 h-5 text-[#0066ff]"/><h4 className="text-sm font-semibold">Simulador auditável</h4></div>
        {!idea ? <div className="py-12 text-center text-xs text-[#727687]"><BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50"/>Consulte e selecione uma palavra-chave para calcular.</div> : <>
          <div className="mt-3 p-3 rounded-xl bg-white dark:bg-[#141936] border"><p className="text-[10px] text-[#727687]">Palavra selecionada</p><div className="flex items-center justify-between gap-2 mt-1"><strong className="text-sm">{idea.keyword}</strong><button onClick={() => void onUseKeyword(idea.keyword)} className="text-[10px] font-bold text-[#0066ff]">Usar no mapa</button></div><p className="text-[11px] mt-1">{volume.toLocaleString('pt-BR')} buscas/mês • CPC topo {currency(idea.lowTopOfPageBid)}–{currency(idea.highTopOfPageBid)}</p></div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <NumberField label={`CTR atual • posição ${effectivePosition ? effectivePosition.toFixed(1) : '20+/não medida'}`} value={currentCtr} disabled suffix="%"/>
            <NumberField label="CTR desejado no Top 3" value={targetCtr} onChange={setTargetCtr} suffix="%"/>
            <NumberField label="Cliques que viram leads" value={clickToLeadRate} onChange={setClickToLeadRate} suffix="%"/>
            <NumberField label="Leads que viram vendas" value={closeRate} onChange={value => { setCloseRate(value); setUsingCrmRate(false); }} suffix="%"/>
            <NumberField label="Ticket médio" value={ticket} onChange={setTicket} prefix="R$"/>
            <div className="rounded-xl border bg-white dark:bg-[#141936] p-3"><p className="text-[10px] text-[#727687]">CRM do segmento</p><p className="text-xs font-bold mt-1">{crmSample.total ? `${crmSample.won}/${crmSample.total} fechados • ${crmSample.rate.toFixed(1)}%` : 'Sem amostra'}</p><button onClick={applyCrmRate} disabled={crmSample.total < 5} className="text-[10px] text-[#0066ff] font-bold mt-1 disabled:opacity-40">Aplicar taxa real</button></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-center">
            <Metric label="Faturamento atual" value={currency(currentRevenue)}/>
            <Metric label="Potencial Top 3" value={currency(topRevenue)}/>
            <Metric label="Oportunidade mensal" value={currency(lostRevenue)} accent/>
          </div>
          <p className="text-[10px] text-[#727687] mt-3 leading-relaxed"><strong>Fórmula:</strong> buscas × CTR × conversão em lead × fechamento × ticket. {usingCrmRate ? 'O fechamento usa os dados reais do CRM.' : 'As taxas são premissas editáveis; não são uma promessa de resultado.'} Os volumes do Google Ads são arredondados e incluem variantes próximas.</p>
        </>}
      </div>
    </div>
  </section>;
}

function NumberField({ label, value, onChange, prefix, suffix, disabled = false }: {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
}) {
  return <label className="text-[10px] text-[#727687]">{label}<div className="mt-1 flex items-center rounded-xl border bg-white dark:bg-[#141936] px-3"><span className="text-xs">{prefix}</span><input disabled={disabled} type="number" min={0} step={0.1} value={value} onChange={event => onChange?.(Number(event.target.value) || 0)} className="w-full bg-transparent py-2 text-xs font-bold outline-none disabled:opacity-70"/><span className="text-xs">{suffix}</span></div></label>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-xl p-3 ${accent ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-[#141936] border'}`}><p className={`text-[9px] ${accent ? 'text-emerald-50' : 'text-[#727687]'}`}>{label}</p><p className="text-xs font-bold mt-1">{value}</p></div>;
}
