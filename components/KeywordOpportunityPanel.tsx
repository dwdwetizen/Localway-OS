'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Calculator, Check, Info, Loader2, MapPin, Search, TrendingUp } from 'lucide-react';
import { Lead } from '@/lib/leads';
import { supabase } from '@/lib/supabase';
import { estimateKeywordOpportunity } from '@/lib/keyword-opportunity';

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
  const [apiValidated, setApiValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<KeywordIdea[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [clickToLeadRate, setClickToLeadRate] = useState(5);
  const [closeRate, setCloseRate] = useState(20);
  const [ticket, setTicket] = useState(inferredSegment.ticket);
  const [targetCtr, setTargetCtr] = useState(20);
  const [usingCrmRate, setUsingCrmRate] = useState(false);
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

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(current => {
      if (current.includes(keyword)) return current.filter(item => item !== keyword);
      if (current.length >= 8) {
        onShowToast('Selecione no máximo 8 palavras para evitar sobreposição no cálculo.', 'info');
        return current;
      }
      return [...current, keyword];
    });
  };

  const idea = ideas.find(item => item.keyword === selectedKeyword) || null;
  const selectedIdeas = ideas.filter(item => selectedKeywords.includes(item.keyword));
  const effectivePosition = idea ? positionForKeyword(idea.keyword) : null;
  const volume = idea?.avgMonthlySearches || 0;
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
  const conservative = estimate.scenarios.conservative;
  const optimistic = estimate.scenarios.optimistic;
  const currentPositionLabel = effectivePosition === null
    ? 'não medida'
    : effectivePosition > 20
      ? '20+'
      : effectivePosition.toFixed(1);

  return <section className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/35 overflow-hidden">
    <div className="p-4 sm:p-5 border-b border-[#c2c6d8]/30 flex flex-wrap sm:flex-nowrap items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center"><TrendingUp className="w-5 h-5"/></div>
      <div className="flex-1"><h3 className="font-semibold">Potencial de palavras-chave e receita</h3><p className="text-[11px] text-[#727687] mt-1">O perfil, o segmento e o site geram sugestões automáticas; você apenas confirma as palavras e as premissas comerciais.</p></div>
      <span
        title={apiValidated ? 'A consulta completa ao Planejador de palavras-chave foi validada.' : connected ? 'A conta Google autorizou o acesso; a API será validada ao fazer uma consulta.' : 'A integração ainda precisa ser autorizada.'}
        className={`ml-[3.25rem] sm:ml-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
      >{connected === null ? 'Verificando…' : apiValidated ? 'Google Ads validado' : connected ? 'Conta Google autorizada' : 'Google Ads pendente'}</span>
    </div>
    <div className="p-4 sm:p-5 grid lg:grid-cols-[1fr_1.1fr] gap-5">
      <div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold">Segmento<select value={segment} onChange={event => changeSegment(event.target.value)} className="input mt-1">{segments.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="text-xs font-semibold">Cidade/região<input value={location} onChange={event => setLocation(event.target.value)} className="input mt-1" placeholder="Fortaleza"/></label>
          {segment === 'outro' && <label className="text-xs font-semibold sm:col-span-2">O que a empresa vende ou oferece<input value={customSegment} onChange={event => setCustomSegment(event.target.value)} className="input mt-1" placeholder="Ex.: atacado de semijoias"/><span className="block text-[10px] font-normal text-[#727687] mt-1">Use algo específico. Categorias genéricas como “Atacadista” podem gerar sugestões de marcas sem relação com a empresa.</span></label>}
          <label className="text-xs font-semibold sm:col-span-2">Palavras específicas — opcional<input value={keywordInput} onChange={event => setKeywordInput(event.target.value)} className="input mt-1" placeholder="Ex.: semijoias no atacado, acessórios para revenda"/><span className="block text-[10px] font-normal text-[#727687] mt-1">Se ficar vazio, usamos o nome da empresa e a descrição acima como contexto.</span></label>
        </div>
        <button disabled={loading || !connected} onClick={() => void research()} className="mt-3 w-full sm:w-auto min-h-11 px-4 py-2.5 rounded-xl bg-[#0066ff] text-white text-xs font-semibold flex justify-center items-center gap-2 disabled:opacity-50">{loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}Buscar volume e sugestões</button>
        {!!ideas.length && <p className="mt-4 text-[10px] leading-relaxed text-[#727687]"><strong>Seleção automática:</strong> marcamos até cinco grupos relevantes, evitando somar termos muito parecidos. Buscas/mês é uma média aproximada no Google para a região.</p>}
        {!!ideas.length && <div className="mt-2 max-h-72 overflow-auto rounded-xl border divide-y">
          {ideas.slice(0, 30).map(item => {
            const checked = selectedKeywords.includes(item.keyword);
            const measuredPosition = positionForKeyword(item.keyword);
            return <div key={item.keyword} className={`p-3 flex items-center gap-2 ${selectedKeyword === item.keyword ? 'bg-blue-50 dark:bg-[#17234b]' : 'hover:bg-[#f8f9fc] dark:hover:bg-[#10142e]'}`}>
              <button type="button" onClick={() => toggleKeyword(item.keyword)} aria-label={`${checked ? 'Remover' : 'Selecionar'} ${item.keyword}`} className={`size-6 shrink-0 rounded-md border grid place-items-center ${checked ? 'bg-[#0066ff] border-[#0066ff] text-white' : 'bg-white dark:bg-[#141936] border-[#c2c6d8]'}`}>{checked && <Check className="size-3.5"/>}</button>
              <button type="button" onClick={() => setSelectedKeyword(item.keyword)} className="min-w-0 flex-1 text-left">
                <p className="text-xs font-semibold truncate">{item.keyword}</p>
                <p className="text-[10px] text-[#727687]">Ads: {competitionLabel(item.competition)} • {measuredPosition === null ? 'mapa pendente' : `posição média ${measuredPosition > 20 ? '20+' : measuredPosition.toFixed(1)}`}</p>
              </button>
              <strong className="text-xs whitespace-nowrap">{item.avgMonthlySearches.toLocaleString('pt-BR')}/mês</strong>
            </div>;
          })}
        </div>}
        {!!ideas.length && <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[#727687]"><span>{selectedKeywords.length} palavras selecionadas</span><span>{estimate.measuredKeywords}/{estimate.selectedKeywords} com mapa medido</span></div>}
      </div>

      <div className="rounded-2xl bg-[#f8f9fc] dark:bg-[#10142e] p-4 border border-[#c2c6d8]/30">
        <div className="flex items-center gap-2"><Calculator className="w-5 h-5 text-[#0066ff]"/><h4 className="text-sm font-semibold">Simulador auditável</h4></div>
        {!selectedIdeas.length ? <div className="py-12 text-center text-xs text-[#727687]"><BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50"/>Consulte e selecione ao menos uma palavra-chave para calcular.</div> : <>
          {idea && <div className="mt-3 p-3 rounded-xl bg-white dark:bg-[#141936] border"><p className="text-[10px] text-[#727687]">Palavra em destaque</p><div className="flex items-center justify-between gap-2 mt-1"><strong className="text-sm">{idea.keyword}</strong><button onClick={() => void onUseKeyword(idea.keyword)} className="text-[10px] font-bold text-[#0066ff] flex items-center gap-1"><MapPin className="size-3"/>Usar no mapa</button></div><p className="text-[11px] mt-1">{volume.toLocaleString('pt-BR')} buscas/mês • CPC topo {currency(idea.lowTopOfPageBid)}–{currency(idea.highTopOfPageBid)}</p><p className="text-[9px] text-[#727687] mt-1">Posição atual: {currentPositionLabel}. O CPC é dado do Google Ads e não representa uma cobrança deste sistema.</p></div>}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <NumberField label="CTR desejado no Top 3" help="Meta de cliques se a empresa aparecer entre os primeiros resultados." value={targetCtr} onChange={setTargetCtr} suffix="%"/>
            <NumberField label="Cliques que viram leads" help="De cada 100 cliques, quantos viram contatos interessados." value={clickToLeadRate} onChange={setClickToLeadRate} suffix="%"/>
            <NumberField label="Leads que viram vendas" help="De cada 100 contatos, quantos realmente compram." value={closeRate} onChange={value => { setCloseRate(value); setUsingCrmRate(false); }} suffix="%"/>
            <NumberField label="Ticket médio" help="Valor médio recebido em cada venda." value={ticket} onChange={setTicket} prefix="R$"/>
            <div className="rounded-xl border bg-white dark:bg-[#141936] p-3"><p className="flex items-center gap-1 text-[10px] text-[#727687]">CRM do segmento <Info className="w-3 h-3" /></p><p className="text-[9px] text-[#727687] mt-1">Taxa calculada com vendas reais registradas no sistema.</p><p className="text-xs font-bold mt-1">{crmSample.total ? `${crmSample.won}/${crmSample.total} fechados • ${crmSample.rate.toFixed(1)}%` : 'Sem amostra'}</p><button onClick={applyCrmRate} disabled={crmSample.total < 5} className="text-[10px] text-[#0066ff] font-bold mt-1 disabled:opacity-40">Aplicar taxa real</button></div>
            <div className="rounded-xl border bg-white dark:bg-[#141936] p-3"><p className="text-[10px] text-[#727687]">Cobertura da medição</p><p className="text-xs font-bold mt-1">{estimate.measuredKeywords}/{estimate.selectedKeywords} palavras</p><p className="text-[9px] text-[#727687] mt-1">{estimate.totalMeasuredVolume.toLocaleString('pt-BR')} buscas/mês consideradas.</p></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-center">
            <Metric label="Cenário conservador" value={estimate.measuredKeywords ? currency(conservative.opportunityRevenue) : 'Após medir'} help="Taxas comerciais e CTR reduzidos em relação às premissas informadas."/>
            <Metric label="Cenário provável" value={estimate.measuredKeywords ? currency(likely.opportunityRevenue) : 'Após medir'} help={`${likely.incrementalLeads.toFixed(1)} leads e ${likely.incrementalSales.toFixed(1)} vendas adicionais estimadas.`} accent/>
            <Metric label="Cenário otimista" value={estimate.measuredKeywords ? currency(optimistic.opportunityRevenue) : 'Após medir'} help="Limite superior da projeção; não representa garantia de resultado."/>
          </div>
          {estimate.measuredKeywords < estimate.selectedKeywords
            ? <p className="text-[10px] text-amber-700 mt-3 leading-relaxed"><strong>Medição incompleta:</strong> abra as palavras marcadas como “mapa pendente”, clique em “Usar no mapa” e gere a grade. O cálculo considera somente as {estimate.measuredKeywords} palavras já medidas.</p>
            : <p className="text-[10px] text-[#727687] mt-3 leading-relaxed"><strong>Faixa mensal estimada:</strong> {currency(conservative.opportunityRevenue)} a {currency(optimistic.opportunityRevenue)} de receita potencial não capturada. Não é dinheiro comprovadamente perdido.</p>}
          <p className="text-[10px] text-[#727687] mt-2 leading-relaxed"><strong>Fórmula:</strong> volume sem duplicidades selecionadas × diferença de CTR pela posição média da grade × conversão em lead × fechamento × ticket. {usingCrmRate ? 'O fechamento usa os dados reais do CRM.' : 'As taxas são premissas editáveis; não são uma promessa de resultado.'} Os volumes são aproximados e representam buscas no Google, não exclusivamente no Maps.</p>
        </>}
      </div>
    </div>
  </section>;
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

function Metric({ label, value, help, accent = false }: { label: string; value: string; help: string; accent?: boolean }) {
  return <div className={`rounded-xl p-3 ${accent ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-[#141936] border'}`}><p className={`text-[9px] ${accent ? 'text-emerald-50' : 'text-[#727687]'}`}>{label}</p><p className="text-sm font-bold mt-1">{value}</p><p className={`text-[8px] leading-3 mt-1 ${accent ? 'text-emerald-50' : 'text-[#9699a5]'}`}>{help}</p></div>;
}
