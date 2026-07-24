'use client';

import React, { FormEvent, useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckSquare,
  ExternalLink,
  MessageCircle,
  PhoneCall,
  Plus,
  Search,
  Sparkles,
  Square,
  UserPlus,
  X,
} from 'lucide-react';
import { useLeads } from '@/hooks/use-leads';
import { googleCalendarLink, Lead, LeadStatus, statusLabel, whatsappLink } from '@/lib/leads';

interface ProspectingViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiPitchModal: (companyName: string) => void;
  onOpenFollowUp: () => void;
}

type LeadForm = {
  companyName: string;
  category: string;
  address: string;
  city: string;
  decisionMaker: string;
  receptionist: string;
  phone: string;
  whatsapp: string;
  email: string;
  notes: string;
  status: LeadStatus;
  nextActionAt: string;
};

const emptyForm: LeadForm = {
  companyName: '', category: '', address: '', city: '', decisionMaker: '', receptionist: '',
  phone: '', whatsapp: '', email: '', notes: '', status: 'novo', nextActionAt: '',
};

const scheduleStatuses: LeadStatus[] = ['ligar_depois', 'retornar_depois', 'reuniao_marcada'];

export function ProspectingView({ onShowToast, onOpenAiPitchModal, onOpenFollowUp }: ProspectingViewProps) {
  const { leads, loading, error, createLead, updateLead } = useLeads();
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const prospects = useMemo(() => leads.filter(lead => {
    const cityMatch = !cityFilter || (lead.city || '').toLowerCase().includes(cityFilter.toLowerCase());
    const categoryMatch = !categoryFilter || (lead.category || '').toLowerCase().includes(categoryFilter.toLowerCase());
    return cityMatch && categoryMatch;
  }), [leads, cityFilter, categoryFilter]);

  const toggleLead = (id: string) => setSelectedLeads(current => current.includes(id)
    ? current.filter(item => item !== id) : [...current, id]);

  const toggleAll = () => setSelectedLeads(current => current.length === prospects.length ? [] : prospects.map(lead => lead.id));

  const updateStatus = async (lead: Lead, status: LeadStatus) => {
    const patch: Partial<Lead> = { status, last_contact_at: status === 'novo' ? lead.last_contact_at : new Date().toISOString() };
    const result = await updateLead(lead.id, patch);
    if (result.error) return onShowToast(result.error, 'error');
    if (status === 'reuniao_marcada' && lead.next_action_at) {
      window.open(googleCalendarLink({ ...lead, status }, lead.next_action_at), '_blank', 'noopener,noreferrer');
      onShowToast('Google Agenda aberto com a reunião preenchida.');
    } else if (scheduleStatuses.includes(status)) {
      onShowToast('Lead encaminhado ao Follow-up.');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.companyName.trim()) return onShowToast('Informe o nome da empresa.', 'error');
    if (scheduleStatuses.includes(form.status) && !form.nextActionAt) {
      return onShowToast('Informe a data e a hora da próxima ação.', 'error');
    }
    const result = await createLead({
      company_name: form.companyName.trim(), category: form.category || null, address: form.address || null,
      city: form.city || null, decision_maker_name: form.decisionMaker || null,
      receptionist_name: form.receptionist || null, phone: form.phone || null, whatsapp: form.whatsapp || form.phone || null,
      email: form.email || null, notes: form.notes || null, source: 'presencial', status: form.status,
      next_action_at: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : null,
    });
    if (result.error) return onShowToast(result.error, 'error');
    if (result.data && form.status === 'reuniao_marcada' && form.nextActionAt) {
      window.open(googleCalendarLink(result.data, new Date(form.nextActionAt).toISOString()), '_blank', 'noopener,noreferrer');
    }
    setForm(emptyForm);
    setFormOpen(false);
    onShowToast('Empresa cadastrada e salva na prospecção.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">Prospecção Ativa & Auditoria em Lote</h2>
          <p className="text-xs text-[#727687]">Cadastre visitas presenciais, acompanhe contatos e envie retornos ao Follow-up.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setFormOpen(true)} className="flex items-center gap-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95">
            <Plus className="w-4 h-4" /> Cadastrar visita
          </button>
          {selectedLeads.length > 0 && <>
            <button onClick={() => onShowToast('A geração de pitch em lote será conectada à IA na próxima etapa.', 'info')} className="flex items-center gap-1.5 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow">
              <Sparkles className="w-4 h-4" /> Pitch em lote
            </button>
            <button onClick={() => onShowToast(`${selectedLeads.length} lead(s) selecionado(s).`, 'info')} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow">
              <UserPlus className="w-4 h-4" /> Preparar CRM
            </button>
          </>}
        </div>
      </div>

      <div className="bg-white dark:bg-[#141936] p-4 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
        <label className="text-[10px] font-bold uppercase text-[#727687]">Cidade / Região
          <input value={cityFilter} onChange={event => setCityFilter(event.target.value)} placeholder="Filtrar cidade" className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066ff]" />
        </label>
        <label className="text-[10px] font-bold uppercase text-[#727687]">Categoria
          <input value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} placeholder="Filtrar segmento" className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 dark:border-[#2e366b] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066ff]" />
        </label>
        <button onClick={() => onShowToast('A busca pelo Google Places será ligada com a chave configurada na Vercel.', 'info')} className="px-5 py-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2">
          <Search className="w-4 h-4" /> Buscar Empresas no Google
        </button>
      </div>

      {error && <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">{error}</div>}

      <div className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] overflow-hidden shadow-sm">
        <div className="p-4 bg-[#f4f2fd] dark:bg-[#10142e] border-b border-[#c2c6d8]/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={toggleAll} className="text-[#0066ff]" disabled={!prospects.length}>
              {selectedLeads.length === prospects.length && prospects.length ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-400" />}
            </button>
            <span className="text-xs font-bold text-[#1a1b22] dark:text-[#f8f7ff]">Leads cadastrados ({prospects.length})</span>
          </div>
          <button onClick={onOpenFollowUp} className="text-[11px] font-semibold text-[#0066ff] hover:underline">Abrir Follow-up</button>
        </div>
        <div className="divide-y divide-[#c2c6d8]/20 dark:divide-[#2e366b]">
          {loading && <div className="p-8 text-center text-xs text-[#727687]">Carregando leads…</div>}
          {!loading && prospects.length === 0 && <div className="p-8 text-center text-xs text-[#727687]">Nenhuma empresa cadastrada. Use “Cadastrar visita” para começar.</div>}
          {prospects.map(lead => {
            const isSelected = selectedLeads.includes(lead.id);
            const wa = whatsappLink(lead.whatsapp || lead.phone);
            return <div key={lead.id} className={`p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 ${isSelected ? 'bg-[#0066ff]/5 dark:bg-[#0066ff]/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
              <div className="flex items-start gap-3 min-w-0">
                <button onClick={() => toggleLead(lead.id)} className="mt-1 text-[#0066ff]">{isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-300 dark:text-gray-600" />}</button>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap"><h4 className="font-bold text-sm text-[#1a1b22] dark:text-[#f8f7ff]">{lead.company_name}</h4><span className="text-[10px] font-bold text-[#0066ff] bg-[#0066ff]/10 px-2 py-0.5 rounded">{statusLabel[lead.status]}</span></div>
                  <p className="text-xs text-[#727687]">{[lead.category, lead.city, lead.address].filter(Boolean).join(' • ') || 'Visita presencial'}</p>
                  <p className="text-[11px] text-[#727687]">{lead.decision_maker_name ? `Decisor: ${lead.decision_maker_name}` : 'Decisor não informado'}{lead.receptionist_name ? ` · Atendimento: ${lead.receptionist_name}` : ''}</p>
                  {lead.next_action_at && <p className="text-[11px] font-semibold text-amber-600">Próxima ação: {new Date(lead.next_action_at).toLocaleString('pt-BR')}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {wa && <a href={wa} target="_blank" rel="noreferrer" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Abrir WhatsApp"><MessageCircle className="w-4 h-4" /></a>}
                {lead.phone && <a href={`tel:${lead.phone.replace(/\D/g, '')}`} className="p-2 text-[#0066ff] hover:bg-[#0066ff]/10 rounded-lg" title="Ligar"><PhoneCall className="w-4 h-4" /></a>}
                <select value={lead.status} onChange={event => void updateStatus(lead, event.target.value as LeadStatus)} className="px-2.5 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl focus:outline-none">
                  {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button onClick={() => onOpenAiPitchModal(lead.company_name)} className="flex items-center gap-1.5 px-3 py-2 bg-[#0066ff] hover:bg-[#0050cb] text-white font-bold text-xs rounded-xl"><Sparkles className="w-3.5 h-3.5" /> Pitch IA</button>
              </div>
            </div>;
          })}
        </div>
      </div>

      {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <form onSubmit={submit} className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#141936] rounded-2xl shadow-2xl border border-[#c2c6d8]/30 p-6 space-y-5">
          <div className="flex items-center justify-between"><div><h3 className="font-bold text-lg">Cadastrar visita presencial</h3><p className="text-xs text-[#727687]">O registro fica disponível para todo o fluxo comercial.</p></div><button type="button" onClick={() => setFormOpen(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Empresa *" value={form.companyName} onChange={value => setForm({ ...form, companyName: value })} />
            <Field label="Segmento" value={form.category} onChange={value => setForm({ ...form, category: value })} />
            <Field label="Cidade" value={form.city} onChange={value => setForm({ ...form, city: value })} />
            <Field label="Endereço" value={form.address} onChange={value => setForm({ ...form, address: value })} />
            <Field label="Nome do decisor" value={form.decisionMaker} onChange={value => setForm({ ...form, decisionMaker: value })} />
            <Field label="Nome da atendente" value={form.receptionist} onChange={value => setForm({ ...form, receptionist: value })} />
            <Field label="Telefone" type="tel" value={form.phone} onChange={value => setForm({ ...form, phone: value })} />
            <Field label="WhatsApp" type="tel" value={form.whatsapp} onChange={value => setForm({ ...form, whatsapp: value })} />
            <Field label="E-mail" type="email" value={form.email} onChange={value => setForm({ ...form, email: value })} />
            <label className="text-xs font-semibold">Próxima ação<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as LeadStatus })} className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl">{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {scheduleStatuses.includes(form.status) && <label className="text-xs font-semibold">Data e hora do retorno *<input required type="datetime-local" value={form.nextActionAt} onChange={event => setForm({ ...form, nextActionAt: event.target.value })} className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl" /></label>}
          </div>
          <label className="text-xs font-semibold block">Observações<textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} rows={3} className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl" placeholder="Resumo da conversa, objeções e próximos passos" /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-xs font-bold rounded-xl border border-[#c2c6d8]/40">Cancelar</button><button className="px-4 py-2 text-xs font-bold rounded-xl bg-[#0066ff] hover:bg-[#0050cb] text-white">Salvar empresa</button></div>
        </form>
      </div>}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="text-xs font-semibold">{label}<input type={type} value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full px-3 py-2 text-xs bg-[#f4f2fd] dark:bg-[#10142e] border border-[#c2c6d8]/40 rounded-xl" /></label>;
}
