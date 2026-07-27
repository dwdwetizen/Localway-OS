'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ProfileOption = { id: string; username: string; nome: string | null };
type CleanupLead = {
  id: string;
  company_name: string;
  created_by: string | null;
  source: string;
  status: string;
  created_at: string;
  next_action_at: string | null;
  archived_at: string | null;
};

interface AdminCleanupPanelProps {
  profiles: ProfileOption[];
  onShowToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

function localDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function presetRange(preset: string) {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);
  if (preset === 'semana_atual' || preset === 'semana_anterior') {
    start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (preset === 'semana_anterior' ? 7 : 0));
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
  } else if (preset === 'mes_anterior') {
    start.setFullYear(today.getFullYear(), today.getMonth() - 1, 1);
    end.setFullYear(today.getFullYear(), today.getMonth(), 0);
  } else {
    start.setFullYear(today.getFullYear(), today.getMonth(), 1);
    end.setFullYear(today.getFullYear(), today.getMonth() + 1, 0);
  }
  return { start: localDate(start), end: localDate(end) };
}

export function AdminCleanupPanel({ profiles, onShowToast }: AdminCleanupPanelProps) {
  const currentRange = presetRange('semana_atual');
  const [leads, setLeads] = useState<CleanupLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [ownerId, setOwnerId] = useState('all');
  const [scope, setScope] = useState<'all' | 'followup' | 'archived'>('all');
  const [preset, setPreset] = useState('semana_atual');
  const [startDate, setStartDate] = useState(currentRange.start);
  const [endDate, setEndDate] = useState(currentRange.end);
  const [selected, setSelected] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('id,company_name,created_by,source,status,created_at,next_action_at,archived_at')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) return onShowToast(error.message, 'error');
    setLeads((data || []) as CleanupLead[]);
  }, [onShowToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visible = useMemo(() => {
    const startsAt = new Date(`${startDate}T00:00:00`).getTime();
    const endsAt = new Date(`${endDate}T23:59:59`).getTime();
    return leads.filter(lead => {
      if (ownerId !== 'all' && lead.created_by !== ownerId) return false;
      if (scope === 'followup' && lead.status !== 'retornar_depois') return false;
      if (scope === 'archived' && !lead.archived_at) return false;
      const relevantDate = scope === 'followup' ? lead.next_action_at : scope === 'archived' ? lead.archived_at : lead.created_at;
      if (!relevantDate) return false;
      const time = new Date(relevantDate).getTime();
      return time >= startsAt && time <= endsAt;
    });
  }, [endDate, leads, ownerId, scope, startDate]);

  const changePreset = (value: string) => {
    setPreset(value);
    if (value === 'personalizado') return;
    const range = presetRange(value);
    setStartDate(range.start);
    setEndDate(range.end);
    setSelected([]);
  };

  const toggleAll = () => {
    const visibleIds = visible.map(lead => lead.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));
    setSelected(current => allSelected
      ? current.filter(id => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds])));
  };

  const removeSelected = async () => {
    if (!supabase || !selected.length) return;
    const confirmed = window.confirm(
      `Excluir definitivamente ${selected.length} lead(s)? Follow-ups, análises, mapas e histórico vinculados também serão apagados. Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    const { error } = await supabase.from('leads').delete().in('id', selected);
    setDeleting(false);
    if (error) return onShowToast(error.message, 'error');
    onShowToast(`${selected.length} lead(s) excluído(s) definitivamente.`, 'success');
    setSelected([]);
    void load();
  };

  return <section className="rounded-2xl border bg-white dark:bg-[#141936] overflow-hidden">
    <div className="p-4 sm:p-5 border-b">
      <h3 className="font-bold text-sm">Limpeza administrativa de leads e follow-ups</h3>
      <p className="mt-1 text-[11px] text-[#727687]">Exclusão exclusiva da conta LocalWay01. Filtre por colaborador e período, selecione um ou vários registros e revise antes de apagar.</p>
    </div>
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 border-b bg-[#f8f9ff] dark:bg-[#10142e]">
      <label className="text-[10px] font-bold">COLABORADOR<select value={ownerId} onChange={event => { setOwnerId(event.target.value); setSelected([]); }} className="input mt-1"><option value="all">Todos</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.nome || profile.username}</option>)}</select></label>
      <label className="text-[10px] font-bold">TIPO<select value={scope} onChange={event => { setScope(event.target.value as typeof scope); setSelected([]); }} className="input mt-1"><option value="all">Leads cadastrados</option><option value="followup">Follow-ups agendados</option><option value="archived">Arquivados</option></select></label>
      <label className="text-[10px] font-bold">PERÍODO<select value={preset} onChange={event => changePreset(event.target.value)} className="input mt-1"><option value="semana_atual">Esta semana</option><option value="semana_anterior">Semana anterior</option><option value="mes_atual">Este mês</option><option value="mes_anterior">Mês anterior</option><option value="personalizado">Personalizado</option></select></label>
      <label className="text-[10px] font-bold">INÍCIO<input type="date" value={startDate} onChange={event => { setPreset('personalizado'); setStartDate(event.target.value); setSelected([]); }} className="input mt-1"/></label>
      <label className="text-[10px] font-bold">FIM<input type="date" value={endDate} onChange={event => { setPreset('personalizado'); setEndDate(event.target.value); setSelected([]); }} className="input mt-1"/></label>
    </div>
    <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b">
      <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={visible.length > 0 && visible.every(lead => selected.includes(lead.id))} onChange={toggleAll}/> Selecionar os {visible.length} resultados</label>
      <div className="flex gap-2">
        <button onClick={() => void load()} className="min-h-10 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5"/> Atualizar</button>
        <button disabled={!selected.length || deleting} onClick={() => void removeSelected()} className="min-h-10 px-3 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40">{deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>} Excluir {selected.length || ''}</button>
      </div>
    </div>
    {loading ? <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-[#0066ff]"/></div> : <div className="divide-y">
      {!visible.length && <p className="p-10 text-center text-xs text-[#727687]">Nenhum registro encontrado neste filtro.</p>}
      {visible.map(lead => {
        const owner = profiles.find(profile => profile.id === lead.created_by);
        const relevantDate = scope === 'followup' ? lead.next_action_at : scope === 'archived' ? lead.archived_at : lead.created_at;
        return <label key={lead.id} className="p-3 sm:p-4 flex items-start gap-3 hover:bg-[#0066ff]/5 cursor-pointer">
          <input type="checkbox" className="mt-1" checked={selected.includes(lead.id)} onChange={() => setSelected(current => current.includes(lead.id) ? current.filter(id => id !== lead.id) : [...current, lead.id])}/>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold truncate">{lead.company_name}</span>
            <span className="block text-[10px] text-[#727687] mt-0.5">{owner?.nome || owner?.username || 'Usuário removido'} • {lead.source === 'google_places' ? 'Online' : 'Presencial'} • {relevantDate ? new Date(relevantDate).toLocaleString('pt-BR') : 'Sem data'}</span>
          </span>
          <span className="shrink-0 rounded-lg bg-[#f4f2fd] dark:bg-[#10142e] px-2 py-1 text-[9px] font-bold">{lead.status.replaceAll('_', ' ')}</span>
        </label>;
      })}
    </div>}
  </section>;
}
