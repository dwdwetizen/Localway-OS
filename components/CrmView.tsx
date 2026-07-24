'use client';

import React, { DragEvent, useMemo, useState } from 'react';
import { Kanban, Table as TableIcon, Sparkles, GripVertical, MapPin, Phone, Star, Globe2, CalendarClock, Loader2 } from 'lucide-react';
import { useLeads } from '@/hooks/use-leads';
import { CrmStage, Lead, whatsappLink } from '@/lib/leads';

interface CrmViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiPitchModal: (companyName: string, lead?: Lead) => void;
}

const stages: Array<{ id: CrmStage; label: string; color: string }> = [
  { id: 'qualificacao', label: 'Qualificação', color: 'border-purple-500 text-purple-600' },
  { id: 'proposta', label: 'Proposta enviada', color: 'border-amber-500 text-amber-600' },
  { id: 'negociacao', label: 'Em negociação', color: 'border-orange-500 text-orange-600' },
  { id: 'fechado', label: 'Fechado (ganho)', color: 'border-emerald-500 text-emerald-600' },
  { id: 'perdido', label: 'Perdido', color: 'border-rose-500 text-rose-600' },
];

const formatCurrency = (value: number | null) => value == null ? 'A definir' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('pt-BR') : 'Sem retorno agendado';

export function CrmView({ onShowToast, onOpenAiPitchModal }: CrmViewProps) {
  const { leads, loading, error, updateLead } = useLeads();
  const [viewMode, setViewMode] = useState<'kanban' | 'tabela'>('kanban');
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const deals = useMemo(() => leads.filter(lead => lead.crm_stage || lead.status === 'qualificado'), [leads]);
  const pipelineTotal = deals.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
  const avgScore = deals.length ? Math.round(deals.reduce((sum, lead) => sum + (lead.health_score || 0), 0) / deals.length) : 0;

  const move = async (lead: Lead, stage: CrmStage) => {
    if (lead.crm_stage === stage) return;
    const { error: updateError } = await updateLead(lead.id, { crm_stage: stage, status: stage === 'perdido' ? 'perdido' : 'qualificado' });
    if (updateError) return onShowToast(updateError, 'error');
    onShowToast(`${lead.company_name} movida para ${stages.find(item => item.id === stage)?.label}.`);
  };

  const dropOnStage = (event: DragEvent<HTMLDivElement>, stage: CrmStage) => {
    event.preventDefault();
    const lead = deals.find(item => item.id === draggedId);
    if (lead) void move(lead, stage);
    setDraggedId(null);
  };

  const dealStage = (lead: Lead): CrmStage => lead.crm_stage || 'qualificacao';

  return <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
      <div><h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">CRM & Pipeline de Vendas</h2><p className="text-xs text-[#727687]">Arraste cada empresa para atualizar a etapa. A alteração fica salva automaticamente.</p></div>
      <div className="flex bg-[#f4f2fd] dark:bg-[#10142e] p-1 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b]"><button onClick={() => setViewMode('kanban')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${viewMode === 'kanban' ? 'bg-white dark:bg-[#1d234a] text-[#0066ff] shadow-sm' : 'text-[#727687]'}`}><Kanban className="w-3.5 h-3.5"/> Kanban</button><button onClick={() => setViewMode('tabela')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${viewMode === 'tabela' ? 'bg-white dark:bg-[#1d234a] text-[#0066ff] shadow-sm' : 'text-[#727687]'}`}><TableIcon className="w-3.5 h-3.5"/> Tabela</button></div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><Metric label="Pipeline total" value={formatCurrency(pipelineTotal)} /><Metric label="Negócios ativos" value={String(deals.filter(l => dealStage(l) !== 'perdido' && dealStage(l) !== 'fechado').length)} /><Metric label="Ticket médio" value={formatCurrency(deals.length ? pipelineTotal / deals.length : 0)} /><Metric label="Score médio" value={`${avgScore}%`} accent /></div>
    {error && <p className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</p>}
    {loading ? <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#0066ff]" /></div> : viewMode === 'kanban' ? <div className="flex gap-4 overflow-x-auto pb-6 pt-1">
      {stages.map(stage => { const cards = deals.filter(lead => dealStage(lead) === stage.id); return <div key={stage.id} onDragOver={event => event.preventDefault()} onDrop={event => dropOnStage(event, stage.id)} className="w-80 shrink-0 bg-[#f4f2fd]/60 dark:bg-[#10142e]/60 p-3 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] min-h-[420px]"><div className={`p-3 rounded-xl bg-white dark:bg-[#141936] border-l-4 ${stage.color} shadow-sm mb-3`}><h3 className="font-bold text-xs text-[#1a1b22] dark:text-[#f8f7ff]">{stage.label}</h3><p className="text-[10px] text-[#727687]">{cards.length} negócios • {formatCurrency(cards.reduce((sum, item) => sum + Number(item.estimated_value || 0), 0))}</p></div><div className="space-y-3">{cards.map(lead => <LeadCard key={lead.id} lead={lead} draggable onDragStart={() => setDraggedId(lead.id)} onPitch={() => onOpenAiPitchModal(lead.company_name, lead)} />)}{!cards.length && <div className="p-6 text-center text-xs text-[#727687] italic border-2 border-dashed border-[#c2c6d8]/30 rounded-xl">Solte um cartão aqui</div>}</div></div> })}
    </div> : <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#f4f2fd] dark:bg-[#10142e] text-[#727687]"><tr><th className="p-4">Empresa</th><th className="p-4">Etapa</th><th className="p-4">Análise</th><th className="p-4">Valor</th><th className="p-4">Próximo contato</th></tr></thead><tbody>{deals.map(lead => <tr key={lead.id} className="border-t border-[#c2c6d8]/20"><td className="p-4 font-bold">{lead.company_name}<br/><span className="font-normal text-[#727687]">{lead.category || 'Sem segmento'}</span></td><td className="p-4">{stages.find(item => item.id === dealStage(lead))?.label}</td><td className="p-4">Nota {lead.rating ?? '—'} • {lead.review_count ?? 0} avaliações<br/><span className="text-[#727687]">Score {lead.health_score ?? 0}% • {lead.opportunity || 'Análise pendente'}</span></td><td className="p-4 font-bold text-emerald-600">{formatCurrency(lead.estimated_value)}</td><td className="p-4">{formatDate(lead.next_action_at)}</td></tr>)}</tbody></table></div>}
  </div>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className="bg-white dark:bg-[#141936] p-4 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b]"><span className="text-[10px] font-bold text-[#727687] uppercase">{label}</span><p className={`text-xl font-bold font-poppins mt-0.5 ${accent ? 'text-purple-600' : 'text-[#1a1b22] dark:text-[#f8f7ff]'}`}>{value}</p></div>; }

function LeadCard({ lead, onPitch, ...dragProps }: { lead: Lead; onPitch: () => void; draggable?: boolean; onDragStart?: () => void }) { const whatsApp = whatsappLink(lead.whatsapp || lead.phone); return <article {...dragProps} className="p-4 bg-white dark:bg-[#141936] rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm hover:border-[#0066ff] cursor-grab active:cursor-grabbing space-y-3"><div className="flex justify-between gap-2"><div><span className="text-[9px] font-bold uppercase text-[#0066ff] bg-[#0066ff]/10 px-2 py-0.5 rounded">{lead.category || 'Sem segmento'}</span><h4 className="font-bold text-xs text-[#1a1b22] dark:text-[#f8f7ff] mt-1">{lead.company_name}</h4><p className="text-[11px] text-[#727687]">{lead.decision_maker_name || lead.phone || 'Contato a identificar'}</p></div><GripVertical className="w-4 h-4 text-[#727687]"/></div><div className="text-[11px] text-[#424656] dark:text-[#b0b4ce] space-y-1"><p className="flex gap-1 items-center"><Star className="w-3 h-3 text-amber-500 fill-amber-500"/> Nota {lead.rating ?? '—'} ({lead.review_count ?? 0}) • Score {lead.health_score ?? 0}%</p><p className="line-clamp-2">{lead.opportunity || 'Sem análise de oportunidade'}</p><p className="flex gap-1 items-center"><CalendarClock className="w-3 h-3"/> {formatDate(lead.next_action_at)}</p></div><div className="flex items-center justify-between pt-2 border-t border-[#c2c6d8]/20"><strong className="text-xs text-emerald-600">{formatCurrency(lead.estimated_value)}</strong><div className="flex gap-1">{lead.google_maps_url && <a href={lead.google_maps_url} target="_blank" rel="noreferrer" className="p-1.5 text-[#0066ff]" title="Abrir no Maps"><MapPin className="w-3.5 h-3.5"/></a>}{whatsApp && <a href={whatsApp} target="_blank" rel="noreferrer" className="p-1.5 text-emerald-600" title="WhatsApp"><Phone className="w-3.5 h-3.5"/></a>}{lead.website_url && <a href={lead.website_url} target="_blank" rel="noreferrer" className="p-1.5 text-[#0066ff]" title="Site"><Globe2 className="w-3.5 h-3.5"/></a>}<button onClick={onPitch} className="p-1.5 text-purple-600" title="Gerar pitch"><Sparkles className="w-3.5 h-3.5"/></button></div></div></article>; }
