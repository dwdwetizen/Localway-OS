'use client';

/* Signed Supabase avatar URLs expire, so the native image element is intentional here. */
/* eslint-disable @next/next/no-img-element */

import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { Plus, Settings, Upload, Loader2, Trash2, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AdminViewProps { onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void; }
type Profile = { id: string; email: string; nome: string | null; role: string | null; permissions: string[] | null; photo_url: string | null; is_active: boolean; };
type Goal = { id: string; user_id: string; period_start: string; period_end: string; target_leads: number; target_contacts: number; target_meetings: number; };
type Activity = { id: string; created_by: string | null; actor_name: string | null; actor_email: string | null; outcome: string; notes: string | null; occurred_at: string; leads: { company_name?: string } | Array<{ company_name?: string }> | null; };
const pages = ['Análises', 'Mapa', 'Raio-X', 'Prospecção', 'Follow-up', 'CRM', 'Propostas', 'Meus Serviços', 'Equipe', 'Avaliações'];
const initialForm = { nome: '', email: '', password: '', permissions: ['Prospecção', 'Follow-up'] };
const now = new Date();
const initialGoal = {
  userId: '',
  periodStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
  periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  targetLeads: 100,
  targetContacts: 60,
  targetMeetings: 10,
};

export function AdminView({ onShowToast }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'metas' | 'historico' | 'servicos' | 'integracoes'>('usuarios');
  const [profiles, setProfiles] = useState<Profile[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [deletingId, setDeletingId] = useState<string | null>(null); const [form, setForm] = useState(initialForm);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalForm, setGoalForm] = useState(initialGoal);
  const [savingGoal, setSavingGoal] = useState(false);
  const [placesConfigured, setPlacesConfigured] = useState<boolean | null>(null);
  const [mapsConfigured, setMapsConfigured] = useState<boolean | null>(null);
  const [history, setHistory] = useState<Activity[]>([]);
  const [historyUserId, setHistoryUserId] = useState('all');
  const load = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    setLoading(true);
    const [profilesRequest, goalsRequest, historyRequest, placesRequest] = await Promise.all([
      client.from('profiles').select('id,email,nome,role,permissions,photo_url,is_active').eq('is_active', true).order('nome'),
      client.from('user_goals').select('id,user_id,period_start,period_end,target_leads,target_contacts,target_meetings').order('period_start', { ascending: false }),
      client.from('lead_interactions').select('id,created_by,actor_name,actor_email,outcome,notes,occurred_at,leads(company_name)').order('occurred_at', { ascending: false }).limit(100),
      fetch('/api/places').then(response => response.json()).catch(() => ({ placesConfigured: false, mapsConfigured: false })),
    ]);
    if (profilesRequest.error) onShowToast(profilesRequest.error.message, 'error');
    else {
      const rows = await Promise.all((profilesRequest.data || []).map(async row => {
        if (!row.photo_url) return row;
        const signed = await client.storage.from('profile-photos').createSignedUrl(row.photo_url, 3600);
        return { ...row, photo_url: signed.data?.signedUrl || null };
      }));
      setProfiles(rows as Profile[]);
      setGoalForm(current => current.userId ? current : { ...current, userId: rows.find(row => row.role !== 'admin')?.id || rows[0]?.id || '' });
    }
    if (goalsRequest.error) onShowToast(goalsRequest.error.message, 'error');
    else setGoals((goalsRequest.data || []) as Goal[]);
    if (historyRequest.error) onShowToast(historyRequest.error.message, 'error');
    else setHistory((historyRequest.data || []) as unknown as Activity[]);
    setPlacesConfigured(Boolean(placesRequest.placesConfigured));
    setMapsConfigured(Boolean(placesRequest.mapsConfigured));
    setLoading(false);
  }, [onShowToast]);
  useEffect(() => { void load(); }, [load]);
  const toggle = (item: string) => setForm(current => ({ ...current, permissions: current.permissions.includes(item) ? current.permissions.filter(value => value !== item) : [...current.permissions, item] }));
  const toggleSolutions = (profile: Profile) => { const current = profile.permissions || []; const permissions = current.includes('analises_solucoes') ? current.filter(item => item !== 'analises_solucoes') : [...current, 'analises_solucoes']; if (!supabase) return; void supabase.from('profiles').update({ permissions }).eq('id', profile.id).then(({ error }) => { if (error) onShowToast(error.message, 'error'); else { onShowToast('Acesso às soluções atualizado.'); void load(); } }); };
  const createLogin = async () => { if (!supabase) return; setSaving(true); const { data } = await supabase.auth.getSession(); const response = await fetch('/api/admin/create-user', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify(form) }); const result = await response.json(); setSaving(false); if (!response.ok) return onShowToast(result.error || 'Não foi possível criar o login.', 'error'); onShowToast('Login criado. Passe o e-mail e a senha ao usuário por um canal seguro.'); setForm(initialForm); void load(); };
  const deleteUser = async (profile: Profile) => { if (!supabase || !window.confirm(`Excluir o login de ${profile.nome || profile.email}? O histórico de leads será preservado.`)) return; setDeletingId(profile.id); const { data } = await supabase.auth.getSession(); const response = await fetch('/api/admin/create-user', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify({ userId: profile.id }) }); const result = await response.json(); setDeletingId(null); if (!response.ok) return onShowToast(result.error || 'Não foi possível excluir o usuário.', 'error'); onShowToast('Usuário excluído e login desativado.'); void load(); };
  const uploadPhoto = async (profile: Profile, event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file || !supabase) return; const path = `${profile.id}/avatar.${file.name.split('.').pop() || 'jpg'}`; const { error } = await supabase.storage.from('profile-photos').upload(path, file, { upsert: true, contentType: file.type }); if (error) return onShowToast(error.message, 'error'); const { error: updateError } = await supabase.from('profiles').update({ photo_url: path }).eq('id', profile.id); if (updateError) return onShowToast(updateError.message, 'error'); onShowToast('Foto atualizada.'); void load(); };
  const saveGoal = async () => {
    if (!supabase || !goalForm.userId) return onShowToast('Selecione um colaborador.', 'error');
    setSavingGoal(true);
    const { error } = await supabase.from('user_goals').upsert({
      user_id: goalForm.userId,
      period_start: goalForm.periodStart,
      period_end: goalForm.periodEnd,
      target_leads: goalForm.targetLeads,
      target_contacts: goalForm.targetContacts,
      target_meetings: goalForm.targetMeetings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,period_start,period_end' });
    setSavingGoal(false);
    if (error) return onShowToast(error.message, 'error');
    onShowToast('Meta salva e liberada no dashboard do colaborador.');
    void load();
  };
  return <div className="space-y-6 animate-in fade-in duration-300">
    <div className="bg-white dark:bg-[#141936] p-5 rounded-2xl border">
      <h2 className="text-xl font-bold">Administração</h2>
      <p className="text-xs text-[#727687]">Cadastre serviços e controle os acessos da equipe.</p>
    </div>
    <div className="flex gap-2 border-b pb-2">
      <Tab id="usuarios" label="Gestão de usuários"/>
      <Tab id="metas" label="Metas da equipe"/>
      <Tab id="historico" label="Histórico"/>
      <Tab id="servicos" label="Cadastrar serviços"/>
      <Tab id="integracoes" label="Integrações"/>
    </div>
    {activeTab === 'usuarios' && <div className="grid lg:grid-cols-[380px_1fr] gap-6">
      <section className="bg-white dark:bg-[#141936] p-5 rounded-2xl border space-y-4">
        <h3 className="font-bold text-sm">Criar login e permissões</h3>
        <input placeholder="Nome completo" value={form.nome} onChange={e => setForm({...form,nome:e.target.value})} className="input"/>
        <input type="email" placeholder="E-mail" value={form.email} onChange={e => setForm({...form,email:e.target.value})} className="input"/>
        <input type="password" placeholder="Senha inicial (mínimo 8 caracteres)" value={form.password} onChange={e => setForm({...form,password:e.target.value})} className="input"/>
        <div>
          <p className="text-xs font-bold mb-2">Acessos liberados</p>
          <div className="grid grid-cols-2 gap-2">
            {pages.map(page => <label key={page} className="text-[11px] flex gap-1.5"><input type="checkbox" checked={form.permissions.includes(page)} onChange={() => toggle(page)}/>{page}</label>)}
          </div>
          <label className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex gap-2 text-xs font-bold">
            <input type="checkbox" checked={form.permissions.includes('analises_solucoes')} onChange={() => toggle('analises_solucoes')}/> Pode ver soluções e ROI na análise
          </label>
        </div>
        <button disabled={saving} onClick={() => void createLogin()} className="w-full py-2.5 bg-[#0066ff] text-white rounded-xl text-xs font-bold flex justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>} Criar login
        </button>
      </section>
      <section className="bg-white dark:bg-[#141936] rounded-2xl border overflow-hidden">
        <div className="p-4 font-bold text-sm">Usuários cadastrados</div>
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin"/></div> : <div className="divide-y">
          {profiles.map(profile => <div key={profile.id} className="p-4 flex gap-3 items-center">
            <div className="w-11 h-11 rounded-full bg-[#0066ff]/10 overflow-hidden flex items-center justify-center font-bold">
              {profile.photo_url ? <img src={profile.photo_url} className="w-full h-full object-cover" alt=""/> : (profile.nome || profile.email).slice(0,1)}
            </div>
            <div className="flex-1">
              <p className="font-bold text-xs">{profile.nome || 'Sem nome'}</p>
              <p className="text-[11px] text-[#727687]">{profile.email}</p>
              <button onClick={() => toggleSolutions(profile)} className={`mt-2 px-2 py-1 rounded-lg text-[10px] font-bold ${(profile.permissions || []).includes('analises_solucoes') || ['administrador', 'admin'].includes((profile.role || '').toLowerCase()) ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {(profile.permissions || []).includes('analises_solucoes') || ['administrador', 'admin'].includes((profile.role || '').toLowerCase()) ? 'Soluções na análise: liberadas' : 'Soluções na análise: bloqueadas'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-[#0066ff] font-bold cursor-pointer"><Upload className="w-4 h-4 inline mr-1"/>Foto<input className="hidden" type="file" accept="image/*" onChange={e => void uploadPhoto(profile,e)}/></label>
              <button disabled={deletingId === profile.id} onClick={() => void deleteUser(profile)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50" aria-label={`Excluir ${profile.nome || profile.email}`} title="Excluir usuário">
                {deletingId === profile.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
              </button>
            </div>
          </div>)}
        </div>}
      </section>
    </div>}
    {activeTab === 'metas' && <div className="grid lg:grid-cols-[380px_1fr] gap-6">
      <section className="bg-white dark:bg-[#141936] p-5 rounded-2xl border space-y-4">
        <div className="flex items-center gap-2"><Target className="w-5 h-5 text-[#0066ff]"/><div><h3 className="font-bold text-sm">Definir meta individual</h3><p className="text-[11px] text-[#727687]">A meta aparecerá no dashboard do colaborador.</p></div></div>
        <label className="text-xs font-semibold block">Colaborador<select value={goalForm.userId} onChange={event => setGoalForm({ ...goalForm, userId: event.target.value })} className="input mt-1"><option value="">Selecione</option>{profiles.filter(profile => profile.role !== 'admin').map(profile => <option key={profile.id} value={profile.id}>{profile.nome || profile.email}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Início<input type="date" value={goalForm.periodStart} onChange={event => setGoalForm({ ...goalForm, periodStart: event.target.value })} className="input mt-1"/></label><label className="text-xs font-semibold">Fim<input type="date" value={goalForm.periodEnd} onChange={event => setGoalForm({ ...goalForm, periodEnd: event.target.value })} className="input mt-1"/></label></div>
        <label className="text-xs font-semibold block">Leads prospectados<input type="number" min={0} value={goalForm.targetLeads} onChange={event => setGoalForm({ ...goalForm, targetLeads: Number(event.target.value) })} className="input mt-1"/></label>
        <label className="text-xs font-semibold block">Contatos registrados<input type="number" min={0} value={goalForm.targetContacts} onChange={event => setGoalForm({ ...goalForm, targetContacts: Number(event.target.value) })} className="input mt-1"/></label>
        <label className="text-xs font-semibold block">Reuniões marcadas<input type="number" min={0} value={goalForm.targetMeetings} onChange={event => setGoalForm({ ...goalForm, targetMeetings: Number(event.target.value) })} className="input mt-1"/></label>
        <button disabled={savingGoal} onClick={() => void saveGoal()} className="w-full py-2.5 bg-[#0066ff] disabled:opacity-50 text-white rounded-xl text-xs font-bold">{savingGoal ? 'Salvando…' : 'Salvar meta'}</button>
      </section>
      <section className="bg-white dark:bg-[#141936] rounded-2xl border overflow-hidden">
        <div className="p-4 font-bold text-sm">Metas cadastradas</div>
        {!goals.length && <div className="p-8 text-center text-xs text-[#727687]">Nenhuma meta cadastrada.</div>}
        <div className="divide-y">{goals.map(goal => {
          const owner = profiles.find(profile => profile.id === goal.user_id);
          return <div key={goal.id} className="p-4"><div className="flex justify-between gap-3"><div><p className="font-bold text-xs">{owner?.nome || owner?.email || 'Usuário removido'}</p><p className="text-[11px] text-[#727687]">{new Date(`${goal.period_start}T12:00:00`).toLocaleDateString('pt-BR')} até {new Date(`${goal.period_end}T12:00:00`).toLocaleDateString('pt-BR')}</p></div><button onClick={() => setGoalForm({ userId: goal.user_id, periodStart: goal.period_start, periodEnd: goal.period_end, targetLeads: goal.target_leads, targetContacts: goal.target_contacts, targetMeetings: goal.target_meetings })} className="text-xs text-[#0066ff] font-bold">Editar</button></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><GoalNumber label="Leads" value={goal.target_leads}/><GoalNumber label="Contatos" value={goal.target_contacts}/><GoalNumber label="Reuniões" value={goal.target_meetings}/></div></div>;
        })}</div>
      </section>
    </div>}
    {activeTab === 'historico' && <section className="bg-white dark:bg-[#141936] rounded-2xl border overflow-hidden">
      <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h3 className="font-bold text-sm">Histórico da equipe</h3><p className="text-[11px] text-[#727687]">Últimas 100 ações registradas no banco.</p></div><select value={historyUserId} onChange={event => setHistoryUserId(event.target.value)} className="px-3 py-2 rounded-xl border bg-[#f4f2fd] dark:bg-[#10142e] text-xs"><option value="all">Todos os colaboradores</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.nome || profile.email}</option>)}</select></div>
      {!history.filter(item => historyUserId === 'all' || item.created_by === historyUserId).length && <div className="p-10 text-center text-xs text-[#727687]">Nenhuma atividade registrada para este perfil.</div>}
      <div className="divide-y">{history.filter(item => historyUserId === 'all' || item.created_by === historyUserId).map(item => {
        const relation = Array.isArray(item.leads) ? item.leads[0] : item.leads;
        return <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><p className="text-xs font-bold">{item.outcome}</p><p className="text-[11px] text-[#727687]">{relation?.company_name || 'Empresa'} • {item.actor_name || item.actor_email || 'Usuário removido'}{item.notes ? ` • ${item.notes}` : ''}</p></div><time className="text-[10px] text-[#727687] whitespace-nowrap">{new Date(item.occurred_at).toLocaleString('pt-BR')}</time></div>;
      })}</div>
    </section>}
    {activeTab === 'servicos' && <section className="bg-white dark:bg-[#141936] p-6 rounded-2xl border"><h3 className="font-bold">Cadastrar novo serviço</h3><p className="text-xs text-[#727687] mt-1">Esta área foi movida para Administração.</p></section>}
    {activeTab === 'integracoes' && <section className="bg-white dark:bg-[#141936] p-6 rounded-2xl border"><Settings className="text-[#0066ff]"/><h3 className="font-bold mt-3">Integrações</h3><div className="mt-4 grid gap-3 md:grid-cols-2"><IntegrationStatus configured={placesConfigured} title="Google Places API (New)" ready="Geração de leads e análise de perfis prontas." missing="Adicione GOOGLE_PLACES_API_KEY na Vercel."/><IntegrationStatus configured={mapsConfigured} title="Google Maps JavaScript API" ready="Mapa geográfico de oportunidades pronto." missing="Adicione NEXT_PUBLIC_GOOGLE_MAPS_API_KEY na Vercel."/></div></section>}
  </div>;
  function Tab({ id, label }: { id: typeof activeTab; label: string }) { return <button onClick={() => setActiveTab(id)} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === id ? 'bg-[#0066ff] text-white' : 'text-[#727687]'}`}>{label}</button>; }
}

function GoalNumber({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-[#f4f2fd] dark:bg-[#10142e] p-2"><p className="text-[10px] text-[#727687]">{label}</p><p className="font-bold text-sm">{value}</p></div>; }
function IntegrationStatus({ configured, title, ready, missing }: { configured: boolean | null; title: string; ready: string; missing: string }) { return <div className={`p-4 rounded-xl border ${configured ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}><p className="text-xs font-bold">{title}: {configured ? 'configurada' : 'chave ausente'}</p><p className="text-[11px] mt-1">{configured ? ready : missing}</p></div>; }
