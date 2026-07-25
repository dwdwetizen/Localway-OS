'use client';

import React, { FormEvent, useMemo, useState } from 'react';
import { Building2, CalendarDays, CheckSquare, ExternalLink, Globe2, MessageCircle, PhoneCall, Plus, Search, Sparkles, Square, X } from 'lucide-react';
import { useLeads } from '@/hooks/use-leads';
import { contactCountdown, ContactUrgency, Lead, LeadStatus, statusLabel, whatsappLink } from '@/lib/leads';
import { supabase } from '@/lib/supabase';

interface ProspectingViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiPitchModal: (companyName: string, lead?: Lead) => void;
}

const nextSteps: LeadStatus[] = ['novo', 'ligacao_realizada', 'nao_atendeu', 'contato_realizado', 'ligar_depois', 'retornar_depois', 'reuniao_marcada', 'qualificado', 'sem_interesse'];
const scheduledStatuses: LeadStatus[] = ['ligar_depois', 'retornar_depois', 'reuniao_marcada'];
const emptyManual = { companyName: '', category: '', city: '', address: '', phone: '', whatsapp: '', email: '', decisionMaker: '', receptionist: '', notes: '' };

function countdownClass(urgency: ContactUrgency) {
  if (urgency === 'red') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (urgency === 'yellow') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function localDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

export function ProspectingView({ onShowToast, onOpenAiPitchModal }: ProspectingViewProps) {
  const { leads, loading, error, createLead, updateLead } = useLeads();
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [limit, setLimit] = useState(10);
  const [searching, setSearching] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState(emptyManual);
  const [selected, setSelected] = useState<string[]>([]);
  const [prospectingMode, setProspectingMode] = useState<'presencial' | 'online'>('online');

  const prospects = useMemo(
    () => leads.filter(lead => {
      const isActive = !(lead.source === 'manual' && lead.google_place_id)
        && !lead.crm_stage
        && lead.status !== 'qualificado'
        && lead.status !== 'reuniao_marcada'
        && lead.status !== 'perdido';
      const matchesMode = prospectingMode === 'online'
        ? lead.source === 'google_places'
        : lead.source !== 'google_places';
      return isActive && matchesMode;
    }),
    [leads, prospectingMode],
  );
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const toggleAll = () => setSelected(current => current.length === prospects.length ? [] : prospects.map(lead => lead.id));

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
        if (leads.some(lead => lead.google_place_id === place.google_place_id)) continue;
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
        crm_stage: status === 'qualificado' || status === 'reuniao_marcada'
          ? (lead.crm_stage || 'qualificacao')
          : lead.crm_stage,
        next_action_at: scheduledStatuses.includes(status) ? nextActionAt : null,
        last_contact_at: status === 'novo' ? lead.last_contact_at : new Date().toISOString(),
      },
      {
        outcome: statusLabel[status],
        notes: notes || null,
        next_action_at: nextActionAt,
        event_type: 'prospecting_contact',
      },
    );
    if (result.error) onShowToast(result.error, 'error');
    else if (status === 'reuniao_marcada') onShowToast('Reunião marcada e empresa enviada para a primeira coluna do CRM.');
    else if (status === 'retornar_depois' || status === 'ligar_depois') onShowToast('Lead enviado para a lista de Follow-up.');
    else if (status === 'qualificado') onShowToast('Lead enviado para a primeira coluna do CRM.');
    else onShowToast('Contato registrado no histórico.');
    return !result.error;
  };

  return <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
      <div><h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">Prospecção</h2><p className="text-xs text-[#727687]">Organize separadamente os contatos presenciais e os leads gerados online.</p></div>
      {prospectingMode === 'presencial' && <button aria-label="Adicionar empresa presencial" title="Adicionar empresa presencial" onClick={() => setManualOpen(true)} className="px-4 h-10 flex items-center gap-2 bg-[#0066ff] hover:bg-[#0050cb] text-white rounded-xl shadow text-xs font-bold"><Plus className="w-4 h-4" /> Adicionar presencial</button>}
    </div>

    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white dark:bg-[#141936] p-2 border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
      <button onClick={() => { setProspectingMode('presencial'); setSelected([]); }} className={`h-12 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors ${prospectingMode === 'presencial' ? 'bg-[#0066ff] text-white shadow' : 'text-[#727687] hover:bg-[#f4f2fd] dark:hover:bg-[#10142e]'}`}><Building2 className="w-4 h-4" /> Prospecção presencial</button>
      <button onClick={() => { setProspectingMode('online'); setSelected([]); }} className={`h-12 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors ${prospectingMode === 'online' ? 'bg-[#0066ff] text-white shadow' : 'text-[#727687] hover:bg-[#f4f2fd] dark:hover:bg-[#10142e]'}`}><Globe2 className="w-4 h-4" /> Prospecção online</button>
    </div>

    {prospectingMode === 'online' && <div className="bg-white dark:bg-[#141936] p-4 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
      <Field label="Segmento" value={category} onChange={setCategory} placeholder="Ex.: clínicas odontológicas" />
      <Field label="Cidade ou bairro" value={city} onChange={setCity} placeholder="Ex.: Fortaleza, CE" />
      <label className="text-[10px] font-bold uppercase text-[#727687]">Quantidade<select value={limit} onChange={event => setLimit(Number(event.target.value))} className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl">{[5, 10, 15, 20].map(value => <option key={value}>{value}</option>)}</select></label>
      <button disabled={searching} onClick={() => void generateLeads()} className="px-5 py-2.5 bg-[#0066ff] disabled:opacity-60 hover:bg-[#0050cb] text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2"><Search className="w-4 h-4" />{searching ? 'Gerando…' : 'Gerar leads'}</button>
    </div>}
    {error && <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">{error}</div>}

    <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] overflow-hidden shadow-sm">
      <div className="p-4 bg-[#f4f2fd] dark:bg-[#10142e] border-b border-[#c2c6d8]/30 flex items-center justify-between"><div className="flex items-center gap-2"><button onClick={toggleAll} className="text-[#0066ff]">{selected.length === prospects.length && prospects.length ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-400" />}</button><span className="text-xs font-bold">{prospectingMode === 'online' ? 'Leads online' : 'Empresas presenciais'} ({prospects.length})</span></div><span className="text-[11px] text-[#727687]">{prospectingMode === 'online' ? 'Google Places API' : 'Cadastro manual'}</span></div>
      <div className="divide-y divide-[#c2c6d8]/20 dark:divide-[#2e366b]">
        {loading && <div className="p-8 text-center text-xs text-[#727687]">Carregando leads…</div>}
        {!loading && !prospects.length && <div className="p-10 text-center text-xs text-[#727687]">{prospectingMode === 'online' ? 'Informe o segmento e a região, depois clique em “Gerar leads”.' : 'Nenhuma empresa presencial cadastrada. Clique em “Adicionar presencial”.'}</div>}
        {prospects.map(lead => <LeadRow key={lead.id} lead={lead} selected={selected.includes(lead.id)} toggle={toggle} updateStep={updateStep} onPitch={onOpenAiPitchModal} />)}
      </div>
    </div>

    {manualOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"><form onSubmit={saveManual} className="w-full max-w-2xl bg-white dark:bg-[#141936] rounded-2xl shadow-2xl border border-[#c2c6d8]/30 p-6 space-y-4"><div className="flex justify-between items-center"><div><h3 className="font-bold text-lg">Adicionar empresa</h3><p className="text-xs text-[#727687]">Para uma visita presencial ou indicação.</p></div><button type="button" onClick={() => setManualOpen(false)}><X className="w-5 h-5" /></button></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Empresa *" value={manual.companyName} onChange={value => setManual({ ...manual, companyName: value })} /><Field label="Segmento" value={manual.category} onChange={value => setManual({ ...manual, category: value })} /><Field label="Cidade" value={manual.city} onChange={value => setManual({ ...manual, city: value })} /><Field label="Telefone / WhatsApp" value={manual.phone} onChange={value => setManual({ ...manual, phone: value, whatsapp: value })} /><Field label="Nome do decisor" value={manual.decisionMaker} onChange={value => setManual({ ...manual, decisionMaker: value })} /><Field label="Nome da atendente" value={manual.receptionist} onChange={value => setManual({ ...manual, receptionist: value })} /><Field label="E-mail" value={manual.email} onChange={value => setManual({ ...manual, email: value })} /><Field label="Endereço" value={manual.address} onChange={value => setManual({ ...manual, address: value })} /></div><label className="text-xs font-semibold block">Observações<textarea value={manual.notes} onChange={event => setManual({ ...manual, notes: event.target.value })} className="mt-1 w-full p-2 rounded-xl border border-[#c2c6d8]/40 bg-[#f4f2fd]" rows={3} /></label><button className="w-full py-2.5 rounded-xl bg-[#0066ff] text-white text-xs font-bold">Adicionar à prospecção</button></form></div>}
  </div>;
}

function LeadRow({ lead, selected, toggle, updateStep, onPitch }: { lead: Lead; selected: boolean; toggle: (id: string) => void; updateStep: (lead: Lead, status: LeadStatus, nextActionAt: string | null, notes: string) => Promise<boolean>; onPitch: (name: string, lead?: Lead) => void }) {
  const wa = whatsappLink(lead.whatsapp || lead.phone);
  const profile = lead.health_score === null ? 'Sem análise' : lead.health_score <= 55 ? 'Boa oportunidade' : lead.health_score <= 75 ? 'Oportunidade média' : 'Perfil forte';
  const savedCountdown = lead.status === 'retornar_depois' ? contactCountdown(lead.next_action_at) : null;
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [nextActionAt, setNextActionAt] = useState(lead.next_action_at ? lead.next_action_at.slice(0, 16) : '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [returnPickerOpen, setReturnPickerOpen] = useState(false);
  const register = async () => {
    setSaving(true);
    const saved = await updateStep(lead, status, nextActionAt ? new Date(nextActionAt).toISOString() : null, notes);
    setSaving(false);
    if (saved) setNotes('');
  };
  return <div className={`p-4 space-y-3 ${selected ? 'bg-[#0066ff]/5' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div className="flex gap-3 min-w-0"><button onClick={() => toggle(lead.id)} className="mt-1 text-[#0066ff]">{selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-300" />}</button><div className="min-w-0 space-y-1"><div className="flex gap-2 items-center flex-wrap"><h4 className="font-bold text-sm">{lead.company_name}</h4><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0066ff]/10 text-[#0066ff]">{profile}</span>{savedCountdown && <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${countdownClass(savedCountdown.urgency)}`}>{savedCountdown.label}</span>}</div><p className="text-xs text-[#727687]">{[lead.category, lead.address].filter(Boolean).join(' • ')}</p><p className="text-[11px] text-[#727687]">⭐ {lead.rating ?? '—'} ({lead.review_count ?? 0} avaliações) · {lead.has_website ? 'Tem site' : 'Sem site'} · {lead.photo_count ?? 0} fotos</p>{lead.opportunity && <p className="text-[11px] text-amber-700">{lead.opportunity}</p>}</div></div>
      <div className="flex items-center gap-1 flex-wrap shrink-0">{lead.google_maps_url && <a href={lead.google_maps_url} target="_blank" rel="noreferrer" title="Abrir perfil no Google Maps" className="p-2 text-[#0066ff] hover:bg-[#0066ff]/10 rounded-lg"><ExternalLink className="w-4 h-4" /></a>}{wa && <a href={wa} target="_blank" rel="noreferrer" title="Abrir WhatsApp" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"><MessageCircle className="w-4 h-4" /></a>}{lead.phone && <a href={`tel:${lead.phone.replace(/\D/g, '')}`} title="Ligar" className="p-2 text-[#0066ff] hover:bg-[#0066ff]/10 rounded-lg"><PhoneCall className="w-4 h-4" /></a>}<button onClick={() => onPitch(lead.company_name, lead)} className="px-3 py-2 bg-[#0066ff] hover:bg-[#0050cb] text-white text-xs font-bold rounded-xl flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> IA</button></div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-2 items-end pl-8">
      <label className="text-[10px] font-bold text-[#727687]">RESULTADO<select value={status} onChange={event => { const nextStatus = event.target.value as LeadStatus; setStatus(nextStatus); setReturnPickerOpen(nextStatus === 'retornar_depois'); }} className="mt-1 w-full px-2 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl">{nextSteps.map(item => <option key={item} value={item}>{statusLabel[item]}</option>)}</select></label>
      <label className="text-[10px] font-bold text-[#727687]">ANOTAÇÃO<input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ex.: falou com o decisor, pediu retorno…" className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl" /></label>
      <button disabled={saving} onClick={() => void register()} className="px-4 py-2.5 rounded-xl bg-[#0066ff] disabled:opacity-50 text-white text-xs font-bold">{saving ? 'Salvando…' : 'Registrar'}</button>
      {status === 'retornar_depois' && <div className="md:col-start-1 md:col-span-2 relative">
        <p className="text-[10px] font-bold text-[#727687]">DIA DO RETORNO</p>
        <button type="button" onClick={() => setReturnPickerOpen(current => !current)} className="mt-1 w-full sm:w-auto min-w-52 px-3 py-2 text-xs font-bold flex items-center justify-between gap-3 bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl">
          <span>{nextActionAt ? new Date(nextActionAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : 'Escolher o dia'}</span>
          <CalendarDays className="w-4 h-4 text-[#0066ff]" />
        </button>
        {returnPickerOpen && <div className="mt-2 p-3 rounded-2xl border border-[#c2c6d8]/40 bg-white dark:bg-[#141936] shadow-xl">
          <p className="text-[10px] text-[#727687] mb-2">Mês e ano são definidos automaticamente. O retorno será marcado para o próximo horário útil.</p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">{returnDayOptions().map(option => <button key={option.value} type="button" onClick={() => { setNextActionAt(option.value); setReturnPickerOpen(false); }} className={`p-2 rounded-xl border text-center hover:border-[#0066ff] hover:bg-[#0066ff]/5 ${nextActionAt === option.value ? 'border-[#0066ff] bg-[#0066ff]/10 text-[#0066ff]' : 'border-[#c2c6d8]/40'}`}><span className="block text-[9px] font-bold uppercase">{option.label}</span><strong className="block text-lg leading-5">{option.day}</strong><span className="block text-[9px] uppercase text-[#727687]">{option.month}</span></button>)}</div>
        </div>}
      </div>}
      {scheduledStatuses.includes(status) && status !== 'retornar_depois' && <label className="md:col-start-1 text-[10px] font-bold text-[#727687]">PRÓXIMO CONTATO<input type="datetime-local" value={nextActionAt} onChange={event => setNextActionAt(event.target.value)} className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl" /></label>}
    </div>
  </div>;
}

function Field({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="text-[10px] font-bold uppercase text-[#727687]">{label}<input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl" /></label>; }
