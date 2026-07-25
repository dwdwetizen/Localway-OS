'use client';

import React, { useMemo, useState } from 'react';
import { CalendarPlus, CheckCircle2, ExternalLink, MessageCircle, PhoneCall, Plus, X } from 'lucide-react';
import { useLeads } from '@/hooks/use-leads';
import { contactCountdown, ContactUrgency, Lead, LeadStatus, statusLabel, whatsappLink } from '@/lib/leads';

interface FollowUpViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const followUpStatuses: LeadStatus[] = ['ligar_depois', 'retornar_depois'];
const followUpOutcomeOptions: LeadStatus[] = ['nao_atendeu', 'retornar_depois', 'reuniao_marcada', 'qualificado', 'sem_interesse'];

function countdownClass(urgency: ContactUrgency) {
  if (urgency === 'red') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (urgency === 'yellow') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

export function FollowUpView({ onShowToast }: FollowUpViewProps) {
  const { leads, loading, error, updateLead } = useLeads();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, LeadStatus>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newFollowUp, setNewFollowUp] = useState({ leadId: '', status: 'retornar_depois' as LeadStatus, date: '', note: '' });

  const list = useMemo(() => leads
    .filter(lead => followUpStatuses.includes(lead.status))
    .sort((a, b) => new Date(a.next_action_at || 0).getTime() - new Date(b.next_action_at || 0).getTime()), [leads]);

  const saveContact = async (lead: Lead) => {
    const status = outcomes[lead.id] || lead.status;
    if (!followUpOutcomeOptions.includes(status)) return onShowToast('Escolha o resultado do contato.', 'error');
    const nextActionAt = dates[lead.id] ? new Date(dates[lead.id]).toISOString() : lead.next_action_at;
    if (followUpStatuses.includes(status) && !nextActionAt) return onShowToast('Escolha a próxima data antes de salvar.', 'error');
    const note = notes[lead.id] || '';
    const result = await updateLead(
      lead.id,
      { status, crm_stage: status === 'qualificado' || status === 'reuniao_marcada' ? (lead.crm_stage || 'qualificacao') : lead.crm_stage, next_action_at: status === 'reuniao_marcada' || followUpStatuses.includes(status) ? nextActionAt : null, last_contact_at: new Date().toISOString(), notes: note ? `${lead.notes ? `${lead.notes}\n\n` : ''}${new Date().toLocaleString('pt-BR')}: ${note}` : lead.notes },
      { outcome: statusLabel[status], notes: note || null, next_action_at: followUpStatuses.includes(status) ? nextActionAt : null, event_type: 'follow_up' },
    );
    if (result.error) return onShowToast(result.error, 'error');
    setNotes(current => ({ ...current, [lead.id]: '' }));
    onShowToast(status === 'qualificado' || status === 'reuniao_marcada' ? 'Empresa enviada para a primeira coluna do CRM.' : 'Follow-up atualizado.');
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
      {!loading && !list.length && <div className="p-10 text-center text-xs text-[#727687] bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30">Nenhum retorno pendente. Leads marcados como “ligar depois”, “retornar depois” ou “reunião marcada” aparecerão aqui.</div>}
      {list.map(lead => { const countdown = contactCountdown(lead.next_action_at); return <article key={lead.id} className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-5 justify-between">
          <div className="space-y-1"><div className="flex items-center gap-2 flex-wrap"><h3 className="font-bold text-sm">{lead.company_name}</h3><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0066ff]/10 text-[#0066ff]">{statusLabel[lead.status]}</span>{countdown && <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${countdownClass(countdown.urgency)}`}>{countdown.label}</span>}</div>
            <p className="text-xs text-[#727687]">{lead.decision_maker_name ? `Decisor: ${lead.decision_maker_name}` : 'Decisor não informado'}{lead.receptionist_name ? ` · Atendimento: ${lead.receptionist_name}` : ''}</p>
            <p className="text-[11px] text-[#727687]">⭐ {lead.rating ?? '—'} ({lead.review_count ?? 0} avaliações) · {lead.has_website ? 'Tem site' : 'Sem site'}</p>
            <p className="text-xs text-[#727687]">Próxima ação: {lead.next_action_at ? new Date(lead.next_action_at).toLocaleString('pt-BR') : 'não agendada'}</p>
            <div className="flex gap-1 pt-1">{lead.google_maps_url && <a href={lead.google_maps_url} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-[#0066ff] hover:bg-[#0066ff]/10" title="Abrir perfil no Google Maps"><ExternalLink className="w-4 h-4" /></a>}{whatsappLink(lead.whatsapp || lead.phone) && <a href={whatsappLink(lead.whatsapp || lead.phone) as string} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50" title="WhatsApp"><MessageCircle className="w-4 h-4" /></a>}{lead.phone && <a href={`tel:${lead.phone.replace(/\D/g, '')}`} className="p-2 rounded-lg text-[#0066ff] hover:bg-[#0066ff]/10" title="Ligar"><PhoneCall className="w-4 h-4" /></a>}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 max-w-3xl">
            <label className="text-[11px] font-semibold">Resultado<select value={followUpOutcomeOptions.includes(outcomes[lead.id] || lead.status) ? (outcomes[lead.id] || lead.status) : ''} onChange={event => setOutcomes({ ...outcomes, [lead.id]: event.target.value as LeadStatus })} className="mt-1 w-full p-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl"><option value="" disabled>Escolha o resultado</option>{followUpOutcomeOptions.map(value => <option key={value} value={value}>{statusLabel[value]}</option>)}</select></label>
            <label className="text-[11px] font-semibold">Próximo retorno<input type="datetime-local" value={dates[lead.id] || ''} onChange={event => setDates({ ...dates, [lead.id]: event.target.value })} className="mt-1 w-full p-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl" /></label>
            <label className="text-[11px] font-semibold sm:col-span-3">Resumo do último contato<textarea rows={2} value={notes[lead.id] || ''} onChange={event => setNotes({ ...notes, [lead.id]: event.target.value })} className="mt-1 w-full p-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl" placeholder="Ex.: falou com o decisor, pediu retorno na quinta…" /></label>
            <button disabled={!followUpOutcomeOptions.includes(outcomes[lead.id] || lead.status)} onClick={() => void saveContact(lead)} className="sm:col-span-3 justify-center flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#0066ff] hover:bg-[#0050cb] disabled:opacity-50 rounded-xl"><CheckCircle2 className="w-4 h-4" /> Salvar contato</button>
          </div>
        </div>
      </article>;})}
    </div>
    {addOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-[#141936] rounded-2xl shadow-2xl border border-[#c2c6d8]/30 p-6 space-y-4">
        <div className="flex items-start justify-between"><div><h3 className="font-bold text-lg">Adicionar follow-up</h3><p className="text-xs text-[#727687]">Escolha uma empresa já cadastrada e programe o próximo contato.</p></div><button onClick={() => setAddOpen(false)}><X className="w-5 h-5"/></button></div>
        <label className="text-xs font-bold block">Empresa<select value={newFollowUp.leadId} onChange={event => setNewFollowUp({ ...newFollowUp, leadId: event.target.value })} className="input mt-1"><option value="">Selecione uma empresa</option>{leads.filter(lead => lead.status !== 'perdido').map(lead => <option key={lead.id} value={lead.id}>{lead.company_name}</option>)}</select></label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs font-bold">Tipo<select value={newFollowUp.status} onChange={event => setNewFollowUp({ ...newFollowUp, status: event.target.value as LeadStatus })} className="input mt-1">{followUpStatuses.map(status => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label>
          <label className="text-xs font-bold">Data e hora<input type="datetime-local" value={newFollowUp.date} onChange={event => setNewFollowUp({ ...newFollowUp, date: event.target.value })} className="input mt-1"/></label>
        </div>
        <label className="text-xs font-bold block">Anotação<textarea rows={3} value={newFollowUp.note} onChange={event => setNewFollowUp({ ...newFollowUp, note: event.target.value })} className="input mt-1" placeholder="Ex.: falou com o decisor e pediu retorno..."/></label>
        <button onClick={() => void addFollowUp()} className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#0066ff] text-white text-xs font-bold"><CalendarPlus className="w-4 h-4"/> Salvar follow-up</button>
      </div>
    </div>}
  </div>;
}

function Metric({ label, value, warning }: { label: string; value: number; warning?: boolean }) {
  return <div className="bg-white dark:bg-[#141936] p-4 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b]"><span className="text-[10px] font-bold text-[#727687] uppercase">{label}</span><p className={`text-2xl font-bold mt-1 ${warning ? 'text-rose-600' : 'text-[#0066ff]'}`}>{value}</p></div>;
}
