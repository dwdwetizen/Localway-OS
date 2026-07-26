'use client';

import React, { useMemo, useState } from 'react';
import { CalendarPlus, CheckCircle2, ExternalLink, MessageCircle, PhoneCall, Plus, X } from 'lucide-react';
import { useAuthProfile } from '@/components/AuthGate';
import { useLeads } from '@/hooks/use-leads';
import { contactCountdown, ContactUrgency, googleCalendarLink, Lead, LeadStatus, statusLabel, whatsappLink } from '@/lib/leads';
import { supabase } from '@/lib/supabase';

interface FollowUpViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const followUpStatuses: LeadStatus[] = ['retornar_depois'];
type FollowUpOutcome = 'retry_tomorrow' | 'retornar_depois' | 'reuniao_marcada' | 'qualificado' | 'sem_interesse';
const followUpOutcomeOptions: Array<{ value: FollowUpOutcome; label: string }> = [
  { value: 'retry_tomorrow', label: 'Não atendeu — tentar amanhã' },
  { value: 'retornar_depois', label: 'Retornar depois — decisor' },
  { value: 'reuniao_marcada', label: 'Reunião marcada' },
  { value: 'qualificado', label: 'Enviar para o CRM' },
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

export function FollowUpView({ onShowToast }: FollowUpViewProps) {
  const authProfile = useAuthProfile();
  const { leads, loading, error, updateLead } = useLeads();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, FollowUpOutcome>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newFollowUp, setNewFollowUp] = useState({ leadId: '', status: 'retornar_depois' as LeadStatus, date: '', note: '' });

  const list = useMemo(() => leads
    .filter(lead => followUpStatuses.includes(lead.status))
    .sort((a, b) => new Date(a.next_action_at || 0).getTime() - new Date(b.next_action_at || 0).getTime()), [leads]);

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
        crm_stage: status === 'qualificado' || status === 'reuniao_marcada' ? (lead.crm_stage || 'qualificacao') : lead.crm_stage,
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

    if (status === 'reuniao_marcada' && nextActionAt && supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const calendarResponse = await fetch('/api/google-calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          companyName: lead.company_name,
          decisionMakerName: lead.decision_maker_name,
          receptionistName: lead.receptionist_name,
          phone: lead.phone,
          whatsapp: lead.whatsapp,
          address: lead.address,
          googleMapsUrl: lead.google_maps_url,
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
        window.open(googleCalendarLink(lead, nextActionAt), '_blank', 'noopener,noreferrer');
        onShowToast(`${calendarResult.error || 'Agenda central não conectado.'} Abrimos o evento preenchido para salvar manualmente.`, 'info');
      }
    } else if (status === 'qualificado') onShowToast('Empresa enviada para a primeira coluna do CRM.');
    else if (status === 'sem_interesse') onShowToast('Lead arquivado como sem interesse.');
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

  const isDue = (lead: Lead) => (contactCountdown(lead.next_action_at)?.days ?? 1) <= 0;
  const isNear = (lead: Lead) => {
    const days = contactCountdown(lead.next_action_at)?.days;
    return typeof days === 'number' && days > 0 && days <= 2;
  };

  return <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
      <div><h2 className="text-xl font-bold font-poppins">Follow-up</h2><p className="text-xs text-[#727687]">Leads com retorno, ligação ou reunião programada.</p></div>
      <button onClick={() => setAddOpen(true)} className="h-10 px-4 flex items-center gap-2 rounded-xl bg-[#0066ff] text-white text-xs font-bold"><Plus className="w-4 h-4"/> Adicionar follow-up</button>
    </div>
    {error && <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">{error}</div>}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Metric label="Agendados" value={list.length} />
      <Metric label="Vencidos / hoje" value={list.filter(isDue).length} warning />
      <Metric label="Próximos 2 dias" value={list.filter(isNear).length} />
    </div>
    <div className="space-y-4">
      {loading && <div className="p-8 text-center text-xs text-[#727687]">Carregando follow-ups…</div>}
      {!loading && !list.length && <div className="p-10 text-center text-xs text-[#727687] bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30">Nenhum retorno com decisor pendente. Eles aparecerão aqui quando forem enviados pela prospecção.</div>}
      {list.map(lead => { const countdown = contactCountdown(lead.next_action_at); return <article key={lead.id} className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-5 justify-between">
          <div className="space-y-1"><div className="flex items-center gap-2 flex-wrap"><h3 className="font-bold text-sm">{lead.company_name}</h3><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0066ff]/10 text-[#0066ff]">{statusLabel[lead.status]}</span>{countdown && <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${countdownClass(countdown.urgency)}`}>{countdown.label}</span>}</div>
            <p className="text-xs text-[#727687]">{lead.decision_maker_name ? `Decisor: ${lead.decision_maker_name}` : 'Decisor não informado'}{lead.receptionist_name ? ` · Atendimento: ${lead.receptionist_name}` : ''}</p>
            <p className="text-[11px] text-[#727687]">⭐ {lead.rating ?? '—'} ({lead.review_count ?? 0} avaliações) · {lead.has_website ? 'Tem site' : 'Sem site'}</p>
            <p className="text-xs text-[#727687]">Próxima ação: {lead.next_action_at ? new Date(lead.next_action_at).toLocaleString('pt-BR') : 'não agendada'}</p>
            <div className="flex gap-1 pt-1">{lead.google_maps_url && <a href={lead.google_maps_url} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-[#0066ff] hover:bg-[#0066ff]/10" title="Abrir perfil no Google Maps"><ExternalLink className="w-4 h-4" /></a>}{whatsappLink(lead.whatsapp || lead.phone) && <a href={whatsappLink(lead.whatsapp || lead.phone) as string} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50" title="WhatsApp"><MessageCircle className="w-4 h-4" /></a>}{lead.phone && <a href={`tel:${lead.phone.replace(/\D/g, '')}`} className="p-2 rounded-lg text-[#0066ff] hover:bg-[#0066ff]/10" title="Ligar"><PhoneCall className="w-4 h-4" /></a>}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 max-w-3xl">
            <label className="text-[11px] font-semibold">Resultado<select value={outcomes[lead.id] || 'retornar_depois'} onChange={event => { const value = event.target.value as FollowUpOutcome; setOutcomes({ ...outcomes, [lead.id]: value }); if (value === 'retry_tomorrow') setDates({ ...dates, [lead.id]: tomorrowAtNine() }); }} className="mt-1 w-full p-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl">{followUpOutcomeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="text-[11px] font-semibold">{(outcomes[lead.id] || 'retornar_depois') === 'reuniao_marcada' ? 'Data e hora da reunião' : 'Próximo retorno'}<input type="datetime-local" disabled={(outcomes[lead.id] || 'retornar_depois') === 'qualificado' || (outcomes[lead.id] || 'retornar_depois') === 'sem_interesse'} value={dates[lead.id] || ''} onChange={event => setDates({ ...dates, [lead.id]: event.target.value })} className="mt-1 w-full p-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl disabled:opacity-50" /></label>
            <label className="text-[11px] font-semibold sm:col-span-3">Resumo do último contato<textarea rows={2} value={notes[lead.id] || ''} onChange={event => setNotes({ ...notes, [lead.id]: event.target.value })} className="mt-1 w-full p-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl" placeholder="Ex.: falou com o decisor, pediu retorno na quinta…" /></label>
            <button onClick={() => void saveContact(lead)} className="sm:col-span-3 justify-center flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#0066ff] hover:bg-[#0050cb] rounded-xl"><CheckCircle2 className="w-4 h-4" /> Salvar contato</button>
          </div>
        </div>
      </article>;})}
    </div>
    {addOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-[#141936] rounded-2xl shadow-2xl border border-[#c2c6d8]/30 p-6 space-y-4">
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
  return <div className="bg-white dark:bg-[#141936] p-4 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b]"><span className="text-[10px] font-bold text-[#727687] uppercase">{label}</span><p className={`text-2xl font-bold mt-1 ${warning ? 'text-rose-600' : 'text-[#0066ff]'}`}>{value}</p></div>;
}
