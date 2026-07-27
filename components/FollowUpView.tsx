'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Archive, CalendarPlus, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, MessageCircle, PhoneCall, Plus, X } from 'lucide-react';
import { useAuthProfile } from '@/components/AuthGate';
import { useLeads } from '@/hooks/use-leads';
import { contactCountdown, ContactUrgency, googleCalendarLink, Lead, LeadStatus, statusLabel, whatsappLink } from '@/lib/leads';
import { supabase } from '@/lib/supabase';

interface FollowUpViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const followUpStatuses: LeadStatus[] = ['retornar_depois'];
type FollowUpOutcome = 'retry_tomorrow' | 'retornar_depois' | 'reuniao_marcada' | 'sem_interesse';
const followUpOutcomeOptions: Array<{ value: FollowUpOutcome; label: string }> = [
  { value: 'retry_tomorrow', label: 'Não atendeu — tentar amanhã' },
  { value: 'retornar_depois', label: 'Retornar depois — decisor' },
  { value: 'reuniao_marcada', label: 'Reunião marcada' },
  { value: 'sem_interesse', label: 'Sem interesse' },
];

function localDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function tomorrowAtNine() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return localDateTimeValue(tomorrow);
}

function countdownClass(urgency: ContactUrgency) {
  if (urgency === 'red') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (urgency === 'yellow') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function urgencyRowClass(urgency?: ContactUrgency) {
  if (urgency === 'red') return 'border-l-4 border-l-rose-500 bg-rose-50/50 dark:bg-rose-950/10';
  if (urgency === 'yellow') return 'border-l-4 border-l-amber-400 bg-amber-50/40 dark:bg-amber-950/10';
  if (urgency === 'green') return 'border-l-4 border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10';
  return 'border-l-4 border-l-transparent';
}

export function FollowUpView({ onShowToast }: FollowUpViewProps) {
  const authProfile = useAuthProfile();
  const { leads, loading, error, updateLead } = useLeads();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, FollowUpOutcome>>({});
  const [meetingPeople, setMeetingPeople] = useState<Record<string, string>>({});
  const [meetingPhones, setMeetingPhones] = useState<Record<string, string>>({});
  const [meetingEmails, setMeetingEmails] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [archivingLeadId, setArchivingLeadId] = useState<string | null>(null);
  const [, setUrgencyRefresh] = useState(0);
  const [newFollowUp, setNewFollowUp] = useState({ leadId: '', status: 'retornar_depois' as LeadStatus, date: '', note: '' });

  useEffect(() => {
    const timer = window.setInterval(() => setUrgencyRefresh(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const list = useMemo(() => leads
    .filter(lead => followUpStatuses.includes(lead.status))
    .sort((a, b) => new Date(a.next_action_at || 0).getTime() - new Date(b.next_action_at || 0).getTime()), [leads]);

  const archiveLead = async (lead: Lead) => {
    const confirmed = window.confirm(`Arquivar o lead “${lead.company_name}”? Ele sairá do Follow-up, mas poderá ser restaurado na área de Arquivados da Prospecção.`);
    if (!confirmed) return;
    setArchivingLeadId(lead.id);
    const result = await updateLead(lead.id, {
      archived_at: new Date().toISOString(),
      archived_by: authProfile.id,
    }, {
      outcome: 'Lead arquivado no Follow-up',
      notes: 'Arquivado sem exclusão definitiva.',
      event_type: 'lead_archived',
    });
    setArchivingLeadId(null);
    if (result.error) return onShowToast(result.error, 'error');
    setExpandedLeadId(null);
    onShowToast('Lead arquivado. Ele pode ser restaurado em Prospecção → Arquivados.', 'success');
  };

  const saveContact = async (lead: Lead) => {
    const outcome = outcomes[lead.id] || 'retornar_depois';
    const status: LeadStatus = outcome === 'retry_tomorrow' ? 'retornar_depois' : outcome;
    const selectedDate = outcome === 'retry_tomorrow' ? tomorrowAtNine() : dates[lead.id] || '';
    const nextActionAt = selectedDate ? new Date(selectedDate).toISOString() : null;
    if ((outcome === 'retornar_depois' || outcome === 'reuniao_marcada') && !nextActionAt) {
      return onShowToast(outcome === 'reuniao_marcada' ? 'Escolha a data e a hora da reunião.' : 'Escolha a próxima data de retorno.', 'error');
    }
    const note = notes[lead.id] || '';
    const result = await updateLead(
      lead.id,
      {
        status,
        decision_maker_name: status === 'reuniao_marcada' ? (meetingPeople[lead.id]?.trim() || lead.decision_maker_name) : lead.decision_maker_name,
        phone: status === 'reuniao_marcada' ? (meetingPhones[lead.id]?.trim() || lead.phone) : lead.phone,
        whatsapp: status === 'reuniao_marcada' ? (meetingPhones[lead.id]?.trim() || lead.whatsapp || lead.phone) : lead.whatsapp,
        email: status === 'reuniao_marcada' ? (meetingEmails[lead.id]?.trim() || lead.email) : lead.email,
        crm_stage: status === 'reuniao_marcada' ? (lead.crm_stage || 'reuniao_marcada') : lead.crm_stage,
        next_action_at: status === 'reuniao_marcada' || status === 'retornar_depois' ? nextActionAt : null,
        last_contact_at: new Date().toISOString(),
        archived_at: status === 'sem_interesse' ? new Date().toISOString() : lead.archived_at,
        archived_by: status === 'sem_interesse' ? authProfile.id : lead.archived_by,
        notes: note ? `${lead.notes ? `${lead.notes}\n\n` : ''}${new Date().toLocaleString('pt-BR')}: ${note}` : lead.notes,
      },
      {
        outcome: outcome === 'retry_tomorrow' ? 'Não atendeu — nova tentativa amanhã' : statusLabel[status],
        notes: note || null,
        next_action_at: status === 'retornar_depois' ? nextActionAt : null,
        event_type: 'follow_up',
      },
    );
    if (result.error) return onShowToast(result.error, 'error');
    setNotes(current => ({ ...current, [lead.id]: '' }));
    setDates(current => ({ ...current, [lead.id]: '' }));
    setOutcomes(current => ({ ...current, [lead.id]: 'retornar_depois' }));
    setExpandedLeadId(null);

    if (status === 'reuniao_marcada' && nextActionAt && supabase) {
      const effectiveLead = result.data || lead;
      const { data: sessionData } = await supabase.auth.getSession();
      const calendarResponse = await fetch('/api/google-calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          companyName: effectiveLead.company_name,
          decisionMakerName: effectiveLead.decision_maker_name,
          receptionistName: effectiveLead.receptionist_name,
          phone: effectiveLead.phone,
          whatsapp: effectiveLead.whatsapp,
          email: effectiveLead.email,
          address: effectiveLead.address,
          googleMapsUrl: effectiveLead.google_maps_url,
          notes: note,
          start: nextActionAt,
        }),
      });
      const calendarResult = await calendarResponse.json();
      if (calendarResponse.ok) {
        await updateLead(lead.id, {
          calendar_event_id: calendarResult.eventId || null,
          calendar_event_url: calendarResult.eventUrl || null,
        }, {
          outcome: 'Reunião criada no Google Agenda',
          notes: calendarResult.calendarEmail ? `Agenda: ${calendarResult.calendarEmail}` : null,
          event_type: 'calendar_event_created',
        });
        onShowToast('Reunião criada no Google Agenda e empresa enviada ao CRM.', 'success');
      } else {
        window.open(googleCalendarLink(effectiveLead, nextActionAt), '_blank', 'noopener,noreferrer');
        onShowToast(`${calendarResult.error || 'Agenda central não conectado.'} Abrimos o evento preenchido para salvar manualmente.`, 'info');
      }
    } else if (status === 'sem_interesse') onShowToast('Lead arquivado como sem interesse.');
    else if (outcome === 'retry_tomorrow') onShowToast('Nova tentativa programada automaticamente para amanhã.');
    else onShowToast('Próximo retorno com o decisor atualizado.');
  };

  const addFollowUp = async () => {
    const lead = leads.find(item => item.id === newFollowUp.leadId);
    if (!lead) return onShowToast('Selecione uma empresa.', 'error');
    if (!newFollowUp.date) return onShowToast('Escolha a data e a hora do próximo contato.', 'error');
    const nextActionAt = new Date(newFollowUp.date).toISOString();
    const result = await updateLead(
      lead.id,
      {
        status: newFollowUp.status,
        next_action_at: nextActionAt,
        notes: newFollowUp.note ? `${lead.notes ? `${lead.notes}\n\n` : ''}${new Date().toLocaleString('pt-BR')}: ${newFollowUp.note}` : lead.notes,
      },
      {
        outcome: `Follow-up criado: ${statusLabel[newFollowUp.status]}`,
        notes: newFollowUp.note || null,
        next_action_at: nextActionAt,
        event_type: 'follow_up_created',
      },
    );
    if (result.error) return onShowToast(result.error, 'error');
    setNewFollowUp({ leadId: '', status: 'retornar_depois', date: '', note: '' });
    setAddOpen(false);
    onShowToast('Follow-up adicionado.');
  };

  const isDue = (lead: Lead) => (contactCountdown(lead.next_action_at)?.days ?? 2) <= 1;
  const isNear = (lead: Lead) => {
    const days = contactCountdown(lead.next_action_at)?.days;
    return typeof days === 'number' && days >= 2 && days <= 3;
  };

  return <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
      <div><h2 className="text-xl font-bold font-poppins">Follow-up</h2><p className="text-xs text-[#727687]">Leads com retorno, ligação ou reunião programada.</p></div>
      <button onClick={() => setAddOpen(true)} className="w-full md:w-auto h-11 px-4 flex items-center justify-center gap-2 rounded-xl bg-[#0066ff] text-white text-xs font-bold"><Plus className="w-4 h-4"/> Adicionar follow-up</button>
    </div>
    {error && <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">{error}</div>}
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      <Metric label="Agendados" value={list.length} />
      <Metric label="Urgentes: até amanhã" value={list.filter(isDue).length} warning />
      <Metric label="Atenção: 2 a 3 dias" value={list.filter(isNear).length} />
    </div>
    <div className="flex flex-wrap items-center gap-3 px-1 text-[10px] font-bold"><span className="text-rose-600">● Vermelho: atrasado, hoje ou amanhã</span><span className="text-amber-600">● Amarelo: 2–3 dias</span><span className="text-emerald-600">● Verde: 4 dias ou mais</span></div>
    <div className="overflow-hidden rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] bg-white dark:bg-[#141936] divide-y divide-[#c2c6d8]/20 dark:divide-[#2e366b]">
      {loading && <div className="p-8 text-center text-xs text-[#727687]">Carregando follow-ups…</div>}
      {!loading && !list.length && <div className="p-10 text-center text-xs text-[#727687]">Nenhum retorno com decisor pendente. Eles aparecerão aqui quando forem enviados pela prospecção.</div>}
      {list.map(lead => {
        const countdown = contactCountdown(lead.next_action_at);
        const expanded = expandedLeadId === lead.id;
        const whatsApp = whatsappLink(lead.whatsapp || lead.phone);
        return <article key={lead.id} className={urgencyRowClass(countdown?.urgency)}>
          <div className="px-3 py-2 grid grid-cols-1 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto] lg:items-center gap-1 lg:gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-xs truncate">{lead.company_name}</h3>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#0066ff]/10 text-[#0066ff]">{statusLabel[lead.status]}</span>
                {countdown && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${countdownClass(countdown.urgency)}`}>{countdown.label}</span>}
              </div>
              <p className="text-[10px] text-[#727687] truncate">{lead.decision_maker_name ? `Decisor: ${lead.decision_maker_name}` : 'Decisor não informado'}{lead.receptionist_name ? ` • Atendimento: ${lead.receptionist_name}` : ''}</p>
            </div>
            <p className="text-[10px] text-[#727687] truncate">
              Próximo contato: {lead.next_action_at ? new Date(lead.next_action_at).toLocaleString('pt-BR') : 'não agendado'} • ⭐ {lead.rating ?? '—'} ({lead.review_count ?? 0})
            </p>
            <div className="flex items-center gap-1 flex-wrap pt-1 lg:pt-0">
              {lead.google_maps_url && <a href={lead.google_maps_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-[#0066ff] hover:bg-[#0066ff]/10" title="Abrir perfil no Google Maps"><ExternalLink className="w-3.5 h-3.5" /></a>}
              {whatsApp && <a href={whatsApp} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title="WhatsApp"><MessageCircle className="w-3.5 h-3.5" /></a>}
              {lead.phone && <a href={`tel:${lead.phone.replace(/\D/g, '')}`} className="p-1.5 rounded-lg text-[#0066ff] hover:bg-[#0066ff]/10" title="Ligar"><PhoneCall className="w-3.5 h-3.5" /></a>}
              <button type="button" onClick={() => setExpandedLeadId(expanded ? null : lead.id)} className="ml-1 px-2 py-1.5 rounded-lg border border-[#0066ff]/30 text-[#0066ff] text-[10px] font-bold flex items-center gap-1">
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {expanded ? 'Fechar' : 'Atender'}
              </button>
              <button type="button" disabled={archivingLeadId === lead.id} onClick={() => void archiveLead(lead)} className="px-2 py-1.5 rounded-lg border border-[#c2c6d8]/40 text-[#727687] hover:text-[#1a1b22] text-[10px] font-bold flex items-center gap-1 disabled:opacity-50" title="Arquivar sem excluir">
                <Archive className="w-3.5 h-3.5"/> {archivingLeadId === lead.id ? 'Arquivando…' : 'Arquivar'}
              </button>
            </div>
          </div>
          {expanded && <div className="px-3 py-3 border-t border-[#c2c6d8]/20 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[200px_220px_1fr_auto] gap-2 items-end">
            <label className="text-[10px] font-semibold">RESULTADO<select value={outcomes[lead.id] || 'retornar_depois'} onChange={event => { const value = event.target.value as FollowUpOutcome; setOutcomes({ ...outcomes, [lead.id]: value }); if (value === 'retry_tomorrow') setDates({ ...dates, [lead.id]: tomorrowAtNine() }); }} className="mt-1 w-full p-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl">{followUpOutcomeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="text-[10px] font-semibold">{(outcomes[lead.id] || 'retornar_depois') === 'reuniao_marcada' ? 'DATA E HORA DA REUNIÃO' : 'PRÓXIMO RETORNO'}<input type="datetime-local" disabled={(outcomes[lead.id] || 'retornar_depois') === 'sem_interesse'} value={dates[lead.id] || ''} onChange={event => setDates({ ...dates, [lead.id]: event.target.value })} className="mt-1 w-full p-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl disabled:opacity-50" /></label>
            <label className="text-[10px] font-semibold">RESUMO DO CONTATO<input value={notes[lead.id] || ''} onChange={event => setNotes({ ...notes, [lead.id]: event.target.value })} className="mt-1 w-full p-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl" placeholder="Ex.: falou com o decisor, pediu retorno…" /></label>
            <button onClick={() => void saveContact(lead)} className="h-9 justify-center flex items-center gap-2 px-4 text-xs font-bold text-white bg-[#0066ff] hover:bg-[#0050cb] rounded-xl"><CheckCircle2 className="w-4 h-4" /> Salvar</button>
            {(outcomes[lead.id] || 'retornar_depois') === 'reuniao_marcada' && <div className="md:col-span-2 xl:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/10 p-3">
              <label className="text-[10px] font-semibold">PESSOA DA REUNIÃO<input value={meetingPeople[lead.id] ?? lead.decision_maker_name ?? ''} onChange={event => setMeetingPeople({...meetingPeople, [lead.id]: event.target.value})} className="input mt-1" placeholder="Nome do decisor"/></label>
              <label className="text-[10px] font-semibold">TELEFONE / WHATSAPP<input value={meetingPhones[lead.id] ?? lead.whatsapp ?? lead.phone ?? ''} onChange={event => setMeetingPhones({...meetingPhones, [lead.id]: event.target.value})} className="input mt-1" placeholder="(85) 99999-9999"/></label>
              <label className="text-[10px] font-semibold">E-MAIL<input type="email" value={meetingEmails[lead.id] ?? lead.email ?? ''} onChange={event => setMeetingEmails({...meetingEmails, [lead.id]: event.target.value})} className="input mt-1" placeholder="contato@empresa.com"/></label>
              <p className="sm:col-span-3 text-[10px] text-emerald-800">A reunião será criada na agenda central e o lead entrará no CRM para acompanhamento da gestão.</p>
            </div>}
          </div>}
        </article>;
      })}
    </div>
    {addOpen && <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-white dark:bg-[#141936] rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#c2c6d8]/30 p-4 sm:p-6 space-y-4 mobile-safe-bottom">
        <div className="flex items-start justify-between"><div><h3 className="font-bold text-lg">Adicionar follow-up</h3><p className="text-xs text-[#727687]">Escolha uma empresa já cadastrada e programe o próximo contato.</p></div><button onClick={() => setAddOpen(false)}><X className="w-5 h-5"/></button></div>
        <label className="text-xs font-bold block">Empresa<select value={newFollowUp.leadId} onChange={event => setNewFollowUp({ ...newFollowUp, leadId: event.target.value })} className="input mt-1"><option value="">Selecione uma empresa</option>{leads.filter(lead => lead.status !== 'perdido').map(lead => <option key={lead.id} value={lead.id}>{lead.company_name}</option>)}</select></label>
        <label className="text-xs font-bold block">Data e hora do retorno com o decisor<input type="datetime-local" value={newFollowUp.date} onChange={event => setNewFollowUp({ ...newFollowUp, date: event.target.value })} className="input mt-1"/></label>
        <label className="text-xs font-bold block">Anotação<textarea rows={3} value={newFollowUp.note} onChange={event => setNewFollowUp({ ...newFollowUp, note: event.target.value })} className="input mt-1" placeholder="Ex.: falou com o decisor e pediu retorno..."/></label>
        <button onClick={() => void addFollowUp()} className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#0066ff] text-white text-xs font-bold"><CalendarPlus className="w-4 h-4"/> Salvar follow-up</button>
      </div>
    </div>}
  </div>;
}

function Metric({ label, value, warning }: { label: string; value: number; warning?: boolean }) {
  return <div className="min-w-0 bg-white dark:bg-[#141936] p-3 sm:p-4 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b]"><span className="block text-[9px] sm:text-[10px] leading-tight font-bold text-[#727687] uppercase">{label}</span><p className={`text-xl sm:text-2xl font-bold mt-1 ${warning ? 'text-rose-600' : 'text-[#0066ff]'}`}>{value}</p></div>;
}
