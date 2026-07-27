'use client';

import React, { DragEvent, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Globe2,
  GripVertical,
  Kanban,
  Loader2,
  LockKeyhole,
  MapPin,
  Phone,
  Sparkles,
  Star,
  Table as TableIcon,
} from 'lucide-react';
import { useAuthProfile } from '@/components/AuthGate';
import { useLeads } from '@/hooks/use-leads';
import { CrmStage, Lead, whatsappLink } from '@/lib/leads';
import { supabase } from '@/lib/supabase';

interface CrmViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiPitchModal: (companyName: string, lead?: Lead) => void;
}

const stages: Array<{ id: CrmStage; label: string; color: string }> = [
  { id: 'reuniao_marcada', label: 'Reunião marcada', color: 'border-blue-500 text-blue-600' },
  { id: 'reuniao_realizada', label: 'Reunião realizada', color: 'border-purple-500 text-purple-600' },
  { id: 'proposta', label: 'Proposta enviada', color: 'border-amber-500 text-amber-600' },
  { id: 'negociacao', label: 'Em negociação', color: 'border-orange-500 text-orange-600' },
  { id: 'fechado', label: 'Pago', color: 'border-emerald-500 text-emerald-600' },
  { id: 'perdido', label: 'Perdido', color: 'border-rose-500 text-rose-600' },
];

const formatCurrency = (value: number | null) => value == null
  ? 'A definir'
  : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (value: string | null) => value
  ? new Date(value).toLocaleDateString('pt-BR')
  : 'Sem retorno agendado';

const dealStage = (lead: Lead): CrmStage => lead.crm_stage || 'reuniao_marcada';

export function CrmView({ onShowToast, onOpenAiPitchModal }: CrmViewProps) {
  const profile = useAuthProfile();
  const { leads, loading, error, updateLead } = useLeads({ scope: 'team' });
  const [viewMode, setViewMode] = useState<'kanban' | 'tabela'>('kanban');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [owners, setOwners] = useState<Array<{ id: string; username: string; nome: string | null }>>([]);

  const isAdmin = ['admin', 'administrador'].includes((profile.role || '').toLowerCase());
  const isPrimaryAdmin = isAdmin && profile.username.toLowerCase() === 'localway01';
  const canManageCrm = isPrimaryAdmin;
  const deals = useMemo(
    () => leads.filter(lead => lead.crm_stage || lead.status === 'qualificado' || lead.status === 'reuniao_marcada'),
    [leads],
  );
  const visibleDeals = useMemo(
    () => deals.filter(lead => ownerFilter === 'all' || lead.created_by === ownerFilter),
    [deals, ownerFilter],
  );
  const pipelineTotal = visibleDeals.reduce((sum, lead) => sum + Number(lead.estimated_value || 0), 0);
  const paidSales = visibleDeals.filter(lead => dealStage(lead) === 'fechado').length;

  useEffect(() => {
    const client = supabase;
    if (!isPrimaryAdmin || !client) return;
    const loadOwners = async () => {
      const { data } = await client
        .from('profiles')
        .select('id,username,nome')
        .eq('is_active', true)
        .order('nome');
      setOwners((data || []) as Array<{ id: string; username: string; nome: string | null }>);
    };
    void loadOwners();
  }, [isPrimaryAdmin]);

  const ownerName = (lead: Lead) => owners.find(owner => owner.id === lead.created_by)?.nome
    || owners.find(owner => owner.id === lead.created_by)?.username
    || 'Usuário removido';

  const move = async (lead: Lead, stage: CrmStage) => {
    if (!canManageCrm) {
      onShowToast('Seu acesso ao CRM é somente para acompanhamento.', 'info');
      return;
    }
    if (lead.crm_stage === stage) return;

    const { error: updateError } = await updateLead(lead.id, {
      crm_stage: stage,
      status: stage === 'perdido' ? 'perdido' : 'qualificado',
    });
    if (updateError) {
      onShowToast(updateError, 'error');
      return;
    }

    if (stage === 'fechado') {
      onShowToast(`${lead.company_name} foi marcada como paga. A venda foi creditada ao colaborador responsável.`);
      return;
    }
    onShowToast(`${lead.company_name} movida para ${stages.find(item => item.id === stage)?.label}.`);
  };

  const dropOnStage = (event: DragEvent<HTMLDivElement>, stage: CrmStage) => {
    event.preventDefault();
    if (!canManageCrm) return;

    const lead = visibleDeals.find(item => item.id === draggedId);
    if (lead) void move(lead, stage);
    setDraggedId(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">CRM & Pipeline de Vendas</h2>
          <p className="text-xs text-[#727687]">
            {canManageCrm
              ? 'Arraste cada empresa para atualizar a etapa. A alteração fica salva automaticamente.'
              : 'Acompanhe aqui o andamento dos seus leads. As etapas são atualizadas pela gestão.'}
          </p>
        </div>
        <div className="w-full md:w-auto grid grid-cols-2 md:flex bg-[#f4f2fd] dark:bg-[#10142e] p-1 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b]">
          <button
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${viewMode === 'kanban' ? 'bg-white dark:bg-[#1d234a] text-[#0066ff] shadow-sm' : 'text-[#727687]'}`}
          >
            <Kanban className="w-3.5 h-3.5" /> Kanban
          </button>
          <button
            onClick={() => setViewMode('tabela')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${viewMode === 'tabela' ? 'bg-white dark:bg-[#1d234a] text-[#0066ff] shadow-sm' : 'text-[#727687]'}`}
          >
            <TableIcon className="w-3.5 h-3.5" /> Tabela
          </button>
        </div>
      </header>

      {isPrimaryAdmin && (
        <div className="rounded-xl border border-[#c2c6d8]/30 bg-white dark:bg-[#141936] p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="min-w-0 flex-1"><p className="text-xs font-bold">CRM central da equipe</p><p className="text-[10px] text-[#727687]">Você movimenta os leads de todos os colaboradores sem trocar de conta.</p></div>
          <label className="text-[10px] font-bold sm:min-w-60">COLABORADOR<select value={ownerFilter} onChange={event => setOwnerFilter(event.target.value)} className="input mt-1"><option value="all">Toda a equipe</option>{owners.filter(owner => owner.id !== profile.id).map(owner => <option key={owner.id} value={owner.id}>{owner.nome || owner.username}</option>)}</select></label>
        </div>
      )}

      {!canManageCrm && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-800">
          <LockKeyhole className="h-4 w-4 shrink-0" />
          Modo de acompanhamento: você vê seus leads e vendas pagas, mas somente a gestão movimenta os cartões.
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <Metric label="Pipeline total" value={formatCurrency(pipelineTotal)} />
        <Metric
          label="Negócios ativos"
          value={String(visibleDeals.filter(lead => !['perdido', 'fechado'].includes(dealStage(lead))).length)}
        />
        <Metric label="Ticket médio" value={formatCurrency(visibleDeals.length ? pipelineTotal / visibleDeals.length : 0)} />
        <Metric label="Vendas pagas" value={String(paidSales)} accent />
      </section>

      {error && <p className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</p>}

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#0066ff]" />
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-3 sm:gap-4 overflow-x-auto mobile-scroll snap-x snap-mandatory pb-4 sm:pb-6 pt-1 -mx-3 px-3 sm:mx-0 sm:px-0">
          {stages.map(stage => {
            const cards = visibleDeals.filter(lead => dealStage(lead) === stage.id);
            return (
              <div
                key={stage.id}
                onDragOver={event => {
                  if (canManageCrm) event.preventDefault();
                }}
                onDrop={event => dropOnStage(event, stage.id)}
                className="w-[calc(100vw-2.5rem)] max-w-80 sm:w-80 shrink-0 snap-center bg-[#f4f2fd]/60 dark:bg-[#10142e]/60 p-3 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] min-h-[360px] sm:min-h-[420px]"
              >
                <div className={`p-3 rounded-xl bg-white dark:bg-[#141936] border-l-4 ${stage.color} shadow-sm mb-3`}>
                  <h3 className="font-bold text-xs text-[#1a1b22] dark:text-[#f8f7ff]">{stage.label}</h3>
                  <p className="text-[10px] text-[#727687]">
                    {cards.length} negócios • {formatCurrency(cards.reduce((sum, item) => sum + Number(item.estimated_value || 0), 0))}
                  </p>
                </div>
                <div className="space-y-3">
                  {cards.map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      ownerName={isPrimaryAdmin ? ownerName(lead) : undefined}
                      canManageCrm={canManageCrm}
                      draggable={canManageCrm}
                      onDragStart={() => {
                        if (canManageCrm) setDraggedId(lead.id);
                      }}
                      onMove={stageId => void move(lead, stageId)}
                      onPitch={() => onOpenAiPitchModal(lead.company_name, lead)}
                    />
                  ))}
                  {!cards.length && (
                    <div className="p-6 text-center text-xs text-[#727687] italic border-2 border-dashed border-[#c2c6d8]/30 rounded-xl">
                      {canManageCrm ? 'Solte um cartão aqui' : 'Nenhum lead nesta etapa'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 overflow-hidden">
          <div className="md:hidden divide-y divide-[#c2c6d8]/20">
            {visibleDeals.map(lead => (
              <div key={`mobile-table-${lead.id}`} className="p-3">
                <LeadCard
                  lead={lead}
                  ownerName={isPrimaryAdmin ? ownerName(lead) : undefined}
                  canManageCrm={canManageCrm}
                  onMove={stageId => void move(lead, stageId)}
                  onPitch={() => onOpenAiPitchModal(lead.company_name, lead)}
                />
              </div>
            ))}
            {!visibleDeals.length && <p className="p-8 text-center text-xs text-[#727687]">Nenhum negócio no CRM.</p>}
          </div>
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f4f2fd] dark:bg-[#10142e] text-[#727687]">
              <tr>
                <th className="p-4">Empresa</th>
                {isPrimaryAdmin && <th className="p-4">Colaborador</th>}
                <th className="p-4">Etapa</th>
                <th className="p-4">Análise</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Próximo contato</th>
              </tr>
            </thead>
            <tbody>
              {visibleDeals.map(lead => (
                <tr key={lead.id} className="border-t border-[#c2c6d8]/20">
                  <td className="p-4 font-bold">
                    {lead.company_name}<br />
                    <span className="font-normal text-[#727687]">{lead.category || 'Sem segmento'}</span>
                  </td>
                  {isPrimaryAdmin && <td className="p-4 text-[#727687]">{ownerName(lead)}</td>}
                  <td className="p-4">{stages.find(item => item.id === dealStage(lead))?.label}</td>
                  <td className="p-4">
                    Nota {lead.rating ?? '—'} • {lead.review_count ?? 0} avaliações<br />
                    <span className="text-[#727687]">
                      Score {lead.health_score ?? 0}% • {lead.opportunity || 'Análise pendente'}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-emerald-600">{formatCurrency(lead.estimated_value)}</td>
                  <td className="p-4">{formatDate(lead.next_action_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 bg-white dark:bg-[#141936] p-3 sm:p-4 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b]">
      <span className="text-[10px] font-bold text-[#727687] uppercase">{label}</span>
      <p className={`text-base sm:text-xl break-words font-bold font-poppins mt-0.5 ${accent ? 'text-emerald-600' : 'text-[#1a1b22] dark:text-[#f8f7ff]'}`}>
        {value}
      </p>
    </div>
  );
}

function LeadCard({
  lead,
  ownerName,
  onPitch,
  canManageCrm,
  onMove,
  ...dragProps
}: {
  lead: Lead;
  ownerName?: string;
  onPitch: () => void;
  canManageCrm: boolean;
  onMove: (stage: CrmStage) => void;
  draggable?: boolean;
  onDragStart?: () => void;
}) {
  const whatsApp = whatsappLink(lead.whatsapp || lead.phone);

  return (
    <article
      {...dragProps}
      className={`p-4 bg-white dark:bg-[#141936] rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm hover:border-[#0066ff] space-y-3 ${canManageCrm ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
    >
      <div className="flex justify-between gap-2">
        <div>
          <span className="text-[9px] font-bold uppercase text-[#0066ff] bg-[#0066ff]/10 px-2 py-0.5 rounded">
            {lead.category || 'Sem segmento'}
          </span>
          <h4 className="font-bold text-xs text-[#1a1b22] dark:text-[#f8f7ff] mt-1">{lead.company_name}</h4>
          <p className="text-[11px] text-[#727687]">{lead.decision_maker_name || lead.phone || 'Contato a identificar'}</p>
          {ownerName && <p className="text-[10px] font-semibold text-[#0066ff] mt-0.5">Responsável: {ownerName}</p>}
        </div>
        {canManageCrm
          ? <GripVertical className="w-4 h-4 text-[#727687]" />
          : <LockKeyhole className="w-4 h-4 text-[#727687]" />}
      </div>

      <div className="text-[11px] text-[#424656] dark:text-[#b0b4ce] space-y-1">
        <p className="flex gap-1 items-center">
          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
          Nota {lead.rating ?? '—'} ({lead.review_count ?? 0}) • Score {lead.health_score ?? 0}%
        </p>
        <p className="line-clamp-2">{lead.opportunity || 'Sem análise de oportunidade'}</p>
        <p className="flex gap-1 items-center"><CalendarClock className="w-3 h-3" /> {formatDate(lead.next_action_at)}</p>
      </div>

      {canManageCrm && (
        <label className="lg:hidden block text-[10px] font-bold text-[#727687]">
          MOVER PARA
          <select
            value={dealStage(lead)}
            onChange={event => onMove(event.target.value as CrmStage)}
            className="mt-1 w-full min-h-11 px-3 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 font-semibold text-[#1a1b22] dark:text-[#f8f7ff]"
          >
            {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
          </select>
        </label>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-[#c2c6d8]/20">
        <strong className="text-xs text-emerald-600">{formatCurrency(lead.estimated_value)}</strong>
        <div className="flex gap-1">
          {lead.calendar_event_url && <a href={lead.calendar_event_url} target="_blank" rel="noreferrer" className="w-9 h-9 grid place-items-center text-amber-600" title="Abrir reunião no Google Agenda"><CalendarClock className="w-4 h-4" /></a>}
          {lead.google_maps_url && <a href={lead.google_maps_url} target="_blank" rel="noreferrer" className="w-9 h-9 grid place-items-center text-[#0066ff]" title="Abrir no Maps"><MapPin className="w-4 h-4" /></a>}
          {whatsApp && <a href={whatsApp} target="_blank" rel="noreferrer" className="w-9 h-9 grid place-items-center text-emerald-600" title="WhatsApp"><Phone className="w-4 h-4" /></a>}
          {lead.website_url && <a href={lead.website_url} target="_blank" rel="noreferrer" className="w-9 h-9 grid place-items-center text-[#0066ff]" title="Site"><Globe2 className="w-4 h-4" /></a>}
          <button onClick={onPitch} className="w-9 h-9 grid place-items-center text-purple-600" title="Gerar pitch"><Sparkles className="w-4 h-4" /></button>
        </div>
      </div>
    </article>
  );
}
