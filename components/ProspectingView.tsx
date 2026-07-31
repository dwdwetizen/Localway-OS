'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Archive, Building2, CalendarDays, CheckSquare, ExternalLink, Globe2, MessageCircle, PhoneCall, Plus, RotateCcw, Search, Sparkles, Square, Trash2, X } from 'lucide-react';
import { useAuthProfile } from '@/components/AuthGate';
import { useLeads } from '@/hooks/use-leads';
import { contactCountdown, ContactUrgency, Lead, LeadStatus, statusLabel, whatsappLink } from '@/lib/leads';
import { supabase } from '@/lib/supabase';

interface ProspectingViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiPitchModal: (companyName: string, lead?: Lead) => void;
}

const nextSteps: LeadStatus[] = ['nao_atendeu', 'sem_interesse', 'retornar_depois'];
const scheduledStatuses: LeadStatus[] = ['nao_atendeu', 'retornar_depois'];
const emptyManual = { companyName: '', category: '', city: '', address: '', phone: '', whatsapp: '', email: '', decisionMaker: '', receptionist: '', notes: '' };

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

function localDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDateValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function returnTimeForDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return '';
  const now = new Date();
  const selected = new Date(year, month - 1, day, 9, 0, 0, 0);
  if (selected.toDateString() === now.toDateString()) {
    selected.setHours(Math.min(23, Math.max(9, now.getHours() + 1)), 0, 0, 0);
  }
  return localDateTimeValue(selected);
}

function returnDayOptions() {
  const now = new Date();
  return Array.from({ length: 14 }, (_, offset) => {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    if (offset === 0) {
      date.setHours(Math.min(23, Math.max(9, now.getHours() + 1)), 0, 0, 0);
    } else {
      date.setHours(9, 0, 0, 0);
    }
    return {
      value: localDateTimeValue(date),
      day: date.getDate(),
      label: offset === 0 ? 'Hoje' : offset === 1 ? 'Amanhã' : date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    };
  });
}

function tomorrowReturnValue() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return localDateTimeValue(tomorrow);
}

export function ProspectingView({ onShowToast, onOpenAiPitchModal }: ProspectingViewProps) {
  const authProfile = useAuthProfile();
  const isPrimaryAdmin = ['admin', 'administrador'].includes((authProfile.role || '').toLowerCase())
    && authProfile.username.toLowerCase() === 'localway01';
  const { leads, archivedLeads, loading, error, createLead, updateLead, deleteLead } = useLeads();
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [limit, setLimit] = useState(10);
  const [searching, setSearching] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState(emptyManual);
  const [selected, setSelected] = useState<string[]>([]);
  const [prospectingMode, setProspectingMode] = useState<'presencial' | 'online' | 'arquivados'>('presencial');
  const [, setUrgencyRefresh] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setUrgencyRefresh(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const prospects = useMemo(
    () => leads.filter(lead => {
      const isActive = !(lead.source === 'manual' && lead.google_place_id)
        && !lead.crm_stage
        && lead.status !== 'qualificado'
        && lead.status !== 'reuniao_marcada'
        && lead.status !== 'retornar_depois'
        && lead.status !== 'sem_interesse'
        && lead.status !== 'perdido';
      const matchesMode = prospectingMode === 'online'
        ? lead.source === 'google_places'
        : prospectingMode === 'presencial' && lead.source !== 'google_places';
      return isActive && matchesMode;
    }),
    [leads, prospectingMode],
  );
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const toggleAll = () => setSelected(current => current.length === prospects.length ? [] : prospects.map(lead => lead.id));

  const archiveLead = async (lead: Lead) => {
    const result = await updateLead(
      lead.id,
      { archived_at: new Date().toISOString(), archived_by: authProfile.id },
      { outcome: 'Lead arquivado', notes: 'Movido para a área de arquivados.', event_type: 'lead_archived' },
    );
    if (result.error) onShowToast(result.error, 'error');
    else onShowToast(`${lead.company_name} foi arquivada.`, 'success');
    return !result.error;
  };

  const restoreLead = async (lead: Lead) => {
    const result = await updateLead(
      lead.id,
      { archived_at: null, archived_by: null },
      { outcome: 'Lead restaurado', notes: 'Retornado para a prospecção ativa.', event_type: 'lead_restored' },
    );
    if (result.error) onShowToast(result.error, 'error');
    else onShowToast(`${lead.company_name} voltou para a prospecção.`, 'success');
    return !result.error;
  };

  const generateLeads = async () => {
    if (!category.trim() || !city.trim()) return onShowToast('Informe o segmento e a cidade/região.', 'error');
    setSearching(true);
    try {
      const { data: sessionData } = await supabase!.auth.getSession();
      const response = await fetch('/api/places', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token || ''}` }, body: JSON.stringify({ category, city, maxResults: limit }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao gerar leads.');
      let added = 0;
      for (const place of data.places) {
        if ([...leads, ...archivedLeads].some(lead => lead.google_place_id === place.google_place_id)) continue;
        const result = await createLead({ ...place, decision_maker_name: null, receptionist_name: null, email: null, notes: null, source: 'google_places', status: 'novo', next_action_at: null });
        if (!result.error) added += 1;
      }
      onShowToast(added ? `${added} novo(s) lead(s) gerado(s) pelo Google Maps.` : 'Nenhum lead novo encontrado; os resultados já estavam na lista.', added ? 'success' : 'info');
    } catch (requestError) {
      onShowToast(requestError instanceof Error ? requestError.message : 'Erro ao gerar leads.', 'error');
    } finally { setSearching(false); }
  };

  const saveManual = async (event: FormEvent) => {
    event.preventDefault();
    if (!manual.companyName.trim()) return onShowToast('Informe o nome da empresa.', 'error');
    const result = await createLead({
      company_name: manual.companyName.trim(), category: manual.category || null, city: manual.city || null, address: manual.address || null,
      phone: manual.phone || null, whatsapp: manual.whatsapp || manual.phone || null, email: manual.email || null, notes: manual.notes || null,
      decision_maker_name: manual.decisionMaker || null, receptionist_name: manual.receptionist || null, source: 'presencial', status: 'novo', next_action_at: null,
      google_place_id: null, google_maps_url: null, website_url: null, rating: null, review_count: null, photo_count: null, has_website: null, health_score: null, opportunity: null,
      latitude: null, longitude: null, analysis_data: {}, analysed_at: null,
    });
    if (result.error) return onShowToast(result.error, 'error');
    setManual(emptyManual); setManualOpen(false); onShowToast('Empresa adicionada à lista de prospecção.');
  };

  const updateStep = async (lead: Lead, status: LeadStatus, nextActionAt: string | null, notes: string) => {
    if (scheduledStatuses.includes(status) && !nextActionAt) {
      onShowToast('Escolha a data do próximo contato.', 'error');
      return false;
    }
    const result = await updateLead(
      lead.id,
      {
        status,
        decision_maker_name: lead.decision_maker_name,
        phone: lead.phone,
        whatsapp: lead.whatsapp,
        email: lead.email,
        crm_stage: lead.crm_stage,
        next_action_at: scheduledStatuses.includes(status) ? nextActionAt : null,
        last_contact_at: status === 'novo' ? lead.last_contact_at : new Date().toISOString(),
        archived_at: status === 'sem_interesse' ? new Date().toISOString() : lead.archived_at,
        archived_by: status === 'sem_interesse' ? authProfile.id : lead.archived_by,
      },
      {
        outcome: statusLabel[status],
        notes: notes || null,
        next_action_at: nextActionAt,
        event_type: 'prospecting_contact',
      },
    );
    if (result.error) onShowToast(result.error, 'error');
    if (result.error) return false;

    if (status === 'retornar_depois') onShowToast('Lead enviado ao Follow-up.', 'success');
    else if (status === 'nao_atendeu') onShowToast('Nova tentativa programada automaticamente para amanhã.');
    else if (status === 'sem_interesse') onShowToast('Lead arquivado como sem interesse. Ele pode ser restaurado depois.');
    else onShowToast('Contato registrado no histórico.');
    return true;
  };

  return <div className="lw-page space-y-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="lw-kicker mb-1.5">Operação comercial</p><h2 className="lw-title">Prospecção</h2><p className="text-xs text-[var(--text-secondary)]">Leads presenciais e online em andamento.</p></div>
      {prospectingMode === 'presencial' && <button aria-label="Adicionar empresa presencial" title="Adicionar empresa presencial" onClick={() => setManualOpen(true)} className="lw-primary-button w-full px-4 sm:w-auto flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Cadastrar lead</button>}
    </div>

    <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
      <button onClick={() => { setProspectingMode('presencial'); setSelected([]); }} className={`min-h-9 shrink-0 rounded-lg border px-3 flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-colors ${prospectingMode === 'presencial' ? 'border-[#1268ff] bg-[#1268ff] text-white' : 'border-[var(--border-color)] bg-[var(--surface-main)] text-[var(--text-secondary)] hover:bg-[var(--surface-container-low)]'}`}><Building2 className="w-3.5 h-3.5" /> Presencial</button>
      <button onClick={() => { setProspectingMode('online'); setSelected([]); }} className={`min-h-9 shrink-0 rounded-lg border px-3 flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-colors ${prospectingMode === 'online' ? 'border-[#1268ff] bg-[#1268ff] text-white' : 'border-[var(--border-color)] bg-[var(--surface-main)] text-[var(--text-secondary)] hover:bg-[var(--surface-container-low)]'}`}><Globe2 className="w-3.5 h-3.5" /> Online</button>
      <button onClick={() => { setProspectingMode('arquivados'); setSelected([]); }} className={`min-h-9 shrink-0 rounded-lg border px-3 flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-colors ${prospectingMode === 'arquivados' ? 'border-[#1268ff] bg-[#1268ff] text-white' : 'border-[var(--border-color)] bg-[var(--surface-main)] text-[var(--text-secondary)] hover:bg-[var(--surface-container-low)]'}`}><Archive className="w-3.5 h-3.5" /> Arquivados <span className="rounded bg-white/15 px-1 text-[10px]">{archivedLeads.length}</span></button>
    </div>

    {prospectingMode === 'online' && <div className="lw-panel p-3 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
      <Field label="Segmento" value={category} onChange={setCategory} placeholder="Ex.: clínicas odontológicas" />
      <Field label="Cidade ou bairro" value={city} onChange={setCity} placeholder="Ex.: Fortaleza, CE" />
      <label className="text-[10px] font-bold uppercase text-[#727687]">Quantidade<select value={limit} onChange={event => setLimit(Number(event.target.value))} className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl">{[5, 10, 15, 20].map(value => <option key={value}>{value}</option>)}</select></label>
      <button disabled={searching} onClick={() => void generateLeads()} className="lw-primary-button px-5 disabled:opacity-60 flex items-center justify-center gap-2"><Search className="w-4 h-4" />{searching ? 'Gerando…' : 'Gerar leads'}</button>
    </div>}
    {error && <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">{error}</div>}

    {prospectingMode !== 'arquivados' ? <div className="lw-panel overflow-hidden">
      <div className="px-3 py-2.5 bg-[var(--surface-container-low)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><button onClick={toggleAll} className="text-[var(--primary-main)]">{selected.length === prospects.length && prospects.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-gray-400" />}</button><span className="text-[12px] font-semibold">{prospectingMode === 'online' ? 'Leads online' : 'Empresas presenciais'} <span className="text-[var(--text-secondary)]">({prospects.length})</span></span></div><div className="flex items-center gap-2 text-[9px] font-bold"><span className="text-rose-600">● Até amanhã</span><span className="text-amber-600">● 2–3 dias</span><span className="text-emerald-600">● 4+ dias</span></div></div>
      <div className="divide-y divide-[#c2c6d8]/20 dark:divide-[#2e366b]">
        {loading && <div className="p-8 text-center text-xs text-[#727687]">Carregando leads…</div>}
        {!loading && !prospects.length && <div className="p-10 text-center text-xs text-[#727687]">{prospectingMode === 'online' ? 'Informe o segmento e a região, depois clique em “Gerar leads”.' : 'Nenhuma empresa presencial cadastrada. Clique em “Adicionar presencial”.'}</div>}
        {prospects.map(lead => <LeadRow key={lead.id} lead={lead} selected={selected.includes(lead.id)} toggle={toggle} updateStep={updateStep} archiveLead={archiveLead} onPitch={onOpenAiPitchModal} />)}
      </div>
    </div> : <div className="lw-panel overflow-hidden">
      <div className="p-4 bg-[#f4f2fd] dark:bg-[#10142e] border-b border-[#c2c6d8]/30 flex items-center justify-between"><div><p className="text-xs font-bold">Leads arquivados ({archivedLeads.length})</p><p className="text-[10px] text-[#727687] mt-0.5">{isPrimaryAdmin ? 'Restaure um lead ou exclua definitivamente.' : 'Você pode restaurar; a exclusão definitiva é feita pela gestão.'}</p></div><Archive className="w-5 h-5 text-[#727687]" /></div>
      <div className="divide-y divide-[#c2c6d8]/20 dark:divide-[#2e366b]">
        {loading && <div className="p-8 text-center text-xs text-[#727687]">Carregando arquivados…</div>}
        {!loading && !archivedLeads.length && <div className="p-10 text-center text-xs text-[#727687]">Nenhum lead arquivado.</div>}
        {archivedLeads.map(lead => <ArchivedLeadRow key={lead.id} lead={lead} restoreLead={restoreLead} deleteLead={deleteLead} canDelete={isPrimaryAdmin} onShowToast={onShowToast} />)}
      </div>
    </div>}

    {manualOpen && <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"><form onSubmit={saveManual} className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto bg-white dark:bg-[#141936] rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#c2c6d8]/30 p-4 sm:p-6 space-y-4 mobile-safe-bottom"><div className="flex justify-between items-center"><div><h3 className="font-bold text-lg">Adicionar empresa</h3><p className="text-xs text-[#727687]">Para uma visita presencial ou indicação.</p></div><button type="button" onClick={() => setManualOpen(false)} className="w-10 h-10 grid place-items-center rounded-xl"><X className="w-5 h-5" /></button></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Empresa *" value={manual.companyName} onChange={value => setManual({ ...manual, companyName: value })} /><Field label="Segmento" value={manual.category} onChange={value => setManual({ ...manual, category: value })} /><Field label="Cidade" value={manual.city} onChange={value => setManual({ ...manual, city: value })} /><Field label="Telefone / WhatsApp" value={manual.phone} onChange={value => setManual({ ...manual, phone: value, whatsapp: value })} /><Field label="Nome do decisor" value={manual.decisionMaker} onChange={value => setManual({ ...manual, decisionMaker: value })} /><Field label="Nome da atendente" value={manual.receptionist} onChange={value => setManual({ ...manual, receptionist: value })} /><Field label="E-mail" value={manual.email} onChange={value => setManual({ ...manual, email: value })} /><Field label="Endereço" value={manual.address} onChange={value => setManual({ ...manual, address: value })} /></div><label className="text-xs font-semibold block">Observações<textarea value={manual.notes} onChange={event => setManual({ ...manual, notes: event.target.value })} className="mt-1 w-full p-2 rounded-xl border border-[#c2c6d8]/40 bg-[#f4f2fd]" rows={3} /></label><button className="w-full min-h-11 py-2.5 rounded-xl bg-[#0066ff] text-white text-xs font-bold">Adicionar à prospecção</button></form></div>}
  </div>;
}

function LeadRow({ lead, selected, toggle, updateStep, archiveLead, onPitch }: { lead: Lead; selected: boolean; toggle: (id: string) => void; updateStep: (lead: Lead, status: LeadStatus, nextActionAt: string | null, notes: string) => Promise<boolean>; archiveLead: (lead: Lead) => Promise<boolean>; onPitch: (name: string, lead?: Lead) => void }) {
  const wa = whatsappLink(lead.whatsapp || lead.phone);
  const profile = lead.health_score === null ? 'Sem análise' : lead.health_score <= 55 ? 'Boa oportunidade' : lead.health_score <= 75 ? 'Oportunidade média' : 'Perfil forte';
  const savedCountdown = ['nao_atendeu', 'retornar_depois'].includes(lead.status) ? contactCountdown(lead.next_action_at) : null;
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [nextActionAt, setNextActionAt] = useState(lead.next_action_at ? lead.next_action_at.slice(0, 16) : '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [returnPickerOpen, setReturnPickerOpen] = useState(false);
  const register = async () => {
    if (!status) return;
    setSaving(true);
    const saved = await updateStep(lead, status, nextActionAt ? new Date(nextActionAt).toISOString() : null, notes);
    setSaving(false);
    if (saved) {
      setNotes('');
      setStatus('');
      setReturnPickerOpen(false);
    }
  };
  const archive = async () => {
    const confirmed = window.confirm(`Arquivar o lead “${lead.company_name}”? Ele sairá das listas ativas, mas poderá ser restaurado.`);
    if (!confirmed) return;
    setArchiving(true);
    const archived = await archiveLead(lead);
    if (!archived) setArchiving(false);
  };
  return <div className={`px-3 py-2 transition-colors ${urgencyRowClass(savedCountdown?.urgency)} ${selected ? 'bg-[#0066ff]/5' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
    <div className="flex items-center gap-2 min-w-0">
      <button onClick={() => toggle(lead.id)} className="text-[#0066ff] shrink-0">{selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-gray-300" />}</button>
      <div className="min-w-0 flex-1 grid grid-cols-1 lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(160px,190px)_auto] lg:items-center gap-1 lg:gap-2">
        <div className="min-w-0">
          <div className="flex gap-1.5 items-center flex-wrap">
            <h4 className="font-bold text-xs truncate">{lead.company_name}</h4>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#0066ff]/10 text-[#0066ff]">{profile}</span>
            {savedCountdown && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${countdownClass(savedCountdown.urgency)}`}>{savedCountdown.label}</span>}
          </div>
          <p className="text-[10px] text-[#727687] truncate">{lead.category || 'Sem segmento'}</p>
        </div>
        <p className="text-[10px] text-[#727687] truncate">
          {[lead.address, `⭐ ${lead.rating ?? '—'} (${lead.review_count ?? 0})`, lead.has_website ? 'Tem site' : 'Sem site'].filter(Boolean).join(' • ')}
        </p>
        <label className="min-w-0">
          <span className="sr-only">Escolha o resultado de {lead.company_name}</span>
          <select
            value={status}
            onChange={event => {
              const nextStatus = event.target.value as LeadStatus;
              setStatus(nextStatus);
              if (nextStatus === 'nao_atendeu') {
                setNextActionAt(tomorrowReturnValue());
                setReturnPickerOpen(false);
              } else if (nextStatus === 'retornar_depois') {
                setNextActionAt('');
                setReturnPickerOpen(true);
              } else {
                setNextActionAt('');
                setReturnPickerOpen(false);
              }
            }}
            className="w-full min-h-9 px-2 py-1.5 text-[10px] font-bold bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-lg"
          >
            <option value="">Escolha o resultado</option>
            {nextSteps.map(item => <option key={item} value={item}>{statusLabel[item]}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1 flex-wrap shrink-0 pt-1 lg:pt-0">
          {lead.google_maps_url && <a href={lead.google_maps_url} target="_blank" rel="noreferrer" title="Abrir perfil no Google Maps" className="p-1.5 text-[#0066ff] hover:bg-[#0066ff]/10 rounded-lg"><ExternalLink className="w-3.5 h-3.5" /></a>}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              title={`Abrir WhatsApp de ${lead.company_name}`}
              aria-label={`Abrir WhatsApp de ${lead.company_name}`}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
          )}
          {lead.phone && <a href={`tel:${lead.phone.replace(/\D/g, '')}`} title="Ligar" className="p-1.5 text-[#0066ff] hover:bg-[#0066ff]/10 rounded-lg"><PhoneCall className="w-3.5 h-3.5" /></a>}
          <button onClick={() => onPitch(lead.company_name, lead)} className="px-2 py-1.5 bg-[#0066ff] hover:bg-[#0050cb] text-white text-[10px] font-bold rounded-lg flex items-center gap-1"><Sparkles className="w-3 h-3" /> IA</button>
          <button type="button" disabled={archiving} onClick={() => void archive()} title="Arquivar lead" aria-label={`Arquivar ${lead.company_name}`} className="p-1.5 text-[#727687] hover:text-[#1a1b22] hover:bg-[#f4f2fd] disabled:opacity-50 rounded-lg">{archiving ? <span className="text-[10px] font-bold">...</span> : <Archive className="w-3.5 h-3.5" />}</button>
        </div>
      </div>
    </div>
    {status && <div className="mt-2 sm:ml-6 pt-2 border-t border-[#c2c6d8]/20">
      {lead.opportunity && <p className="mb-2 text-[10px] text-amber-700">{lead.opportunity}</p>}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
      <label className="text-[10px] font-bold text-[#727687]">ANOTAÇÃO<input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ex.: falou com o decisor, pediu retorno…" className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl" /></label>
      <button disabled={saving} onClick={() => void register()} className="min-h-10 px-4 py-2.5 rounded-xl bg-[#0066ff] disabled:opacity-50 text-white text-xs font-bold">{saving ? 'Salvando…' : status === 'retornar_depois' ? 'Enviar ao Follow-up' : status === 'sem_interesse' ? 'Registrar sem interesse' : 'Salvar tentativa'}</button>
      {status === 'retornar_depois' && <div className="md:col-start-1 md:col-span-2 relative">
        <p className="text-[10px] font-bold text-[#727687]">DIA DO RETORNO</p>
        <button type="button" onClick={() => setReturnPickerOpen(current => !current)} className="mt-1 w-full sm:w-auto sm:min-w-52 px-3 py-2 text-xs font-bold flex items-center justify-between gap-3 bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl">
          <span>{nextActionAt ? new Date(nextActionAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : 'Escolher o dia'}</span>
          <CalendarDays className="w-4 h-4 text-[#0066ff]" />
        </button>
        {returnPickerOpen && <div className="mt-2 p-3 rounded-2xl border border-[#c2c6d8]/40 bg-white dark:bg-[#141936] shadow-xl">
          <p className="text-[10px] text-[#727687] mb-2">Use um dos atalhos ou escolha qualquer data futura. O retorno será marcado para o próximo horário útil.</p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">{returnDayOptions().map(option => <button key={option.value} type="button" onClick={() => { setNextActionAt(option.value); setReturnPickerOpen(false); }} className={`p-2 rounded-xl border text-center hover:border-[#0066ff] hover:bg-[#0066ff]/5 ${nextActionAt === option.value ? 'border-[#0066ff] bg-[#0066ff]/10 text-[#0066ff]' : 'border-[#c2c6d8]/40'}`}><span className="block text-[9px] font-bold uppercase">{option.label}</span><strong className="block text-lg leading-5">{option.day}</strong><span className="block text-[9px] uppercase text-[#727687]">{option.month}</span></button>)}</div>
          <div className="mt-3 pt-3 border-t border-[#c2c6d8]/30 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-[#727687]">OUTRA DATA</p>
              <p className="text-[10px] text-[#727687]">Para próxima semana, próximo mês ou uma data mais distante.</p>
            </div>
            <label className="relative">
              <span className="sr-only">Escolher outra data de retorno</span>
              <input
                type="date"
                min={localDateValue(new Date())}
                value={nextActionAt ? nextActionAt.slice(0, 10) : ''}
                onChange={event => {
                  const value = returnTimeForDate(event.target.value);
                  if (value) {
                    setNextActionAt(value);
                    setReturnPickerOpen(false);
                  }
                }}
                className="w-full sm:w-auto px-3 py-2 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e] border border-[#0066ff]/35 text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]"
              />
            </label>
          </div>
        </div>}
      </div>}
      {status === 'nao_atendeu' && <p className="md:col-span-2 text-[10px] font-semibold text-rose-700">A próxima tentativa será agendada automaticamente para amanhã às 9h.</p>}
      </div>
    </div>}
  </div>;
}

function ArchivedLeadRow({ lead, restoreLead, deleteLead, canDelete, onShowToast }: { lead: Lead; restoreLead: (lead: Lead) => Promise<boolean>; deleteLead: (id: string) => Promise<{ error?: string }>; canDelete: boolean; onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void }) {
  const [busy, setBusy] = useState<'restore' | 'delete' | null>(null);
  const restore = async () => {
    setBusy('restore');
    const restored = await restoreLead(lead);
    if (!restored) setBusy(null);
  };
  const remove = async () => {
    const confirmed = window.confirm(`Excluir definitivamente o lead “${lead.company_name}”? O histórico e as análises vinculadas também serão apagados. Esta ação não pode ser desfeita.`);
    if (!confirmed) return;
    setBusy('delete');
    const result = await deleteLead(lead.id);
    if (result.error) {
      onShowToast(result.error, 'error');
      setBusy(null);
      return;
    }
    onShowToast(`${lead.company_name} foi excluída definitivamente.`, 'success');
  };
  return <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap"><h4 className="font-bold text-sm">{lead.company_name}</h4><span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-[#f4f2fd] dark:bg-[#10142e] text-[#727687]">{lead.source === 'google_places' ? 'Online' : 'Presencial'}</span></div>
      <p className="text-xs text-[#727687] mt-1">{[lead.category, lead.address].filter(Boolean).join(' • ') || 'Sem detalhes adicionais'}</p>
      <p className="text-[10px] text-[#727687] mt-1">Arquivado em {lead.archived_at ? new Date(lead.archived_at).toLocaleString('pt-BR') : 'data não informada'}</p>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <button type="button" disabled={Boolean(busy)} onClick={() => void restore()} className="px-3 py-2 rounded-xl border border-[#0066ff]/30 text-[#0066ff] hover:bg-[#0066ff]/5 disabled:opacity-50 text-xs font-bold flex items-center gap-1.5"><RotateCcw className="w-4 h-4" />{busy === 'restore' ? 'Restaurando…' : 'Restaurar'}</button>
      {canDelete && <button type="button" disabled={Boolean(busy)} onClick={() => void remove()} className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 text-xs font-bold flex items-center gap-1.5"><Trash2 className="w-4 h-4" />{busy === 'delete' ? 'Excluindo…' : 'Excluir'}</button>}
    </div>
  </div>;
}

function Field({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="text-[10px] font-bold uppercase text-[#727687]">{label}<input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl" /></label>; }
