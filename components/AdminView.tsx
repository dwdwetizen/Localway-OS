'use client';

/* Signed Supabase avatar URLs expire, so the native image element is intentional here. */
/* eslint-disable @next/next/no-img-element */

import React, { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, KeyRound, Plus, Settings, Upload, Loader2, Trash2, Target, Pencil, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AdminViewProps { onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void; }
type Profile = { id: string; username: string; nome: string | null; role: string | null; job_title: string | null; permissions: string[] | null; photo_url: string | null; is_active: boolean; };
type Goal = { id: string; user_id: string; period_start: string; period_end: string; target_leads: number; target_contacts: number; target_meetings: number; };
type ActivityLead = { company_name?: string; source?: string };
type Activity = { id: string; created_by: string | null; actor_name: string | null; actor_email: string | null; outcome: string; notes: string | null; occurred_at: string; leads: ActivityLead | ActivityLead[] | null; };
const pages = ['Análises', 'Mapa', 'Raio-X', 'Prospecção', 'Follow-up', 'CRM', 'Propostas', 'Meus Serviços', 'Equipe', 'Avaliações'];
const initialForm = { nome: '', username: '', password: '', jobTitle: 'SDR', permissions: ['Prospecção', 'Follow-up', 'CRM', 'Equipe'] };
const now = new Date();
const initialGoal = {
  userId: '',
  periodStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
  periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  targetLeads: 100,
  targetContacts: 60,
  targetMeetings: 10,
};

function activityOwnerKey(item: Activity) {
  if (item.created_by) return `id:${item.created_by}`;
  if (item.actor_email) return `email:${item.actor_email.toLocaleLowerCase('pt-BR')}`;
  return `name:${item.actor_name || 'usuario-removido'}`;
}

function sourceLabel(source?: string) {
  if (source === 'google_places') return 'Prospecção online';
  if (source === 'presencial') return 'Prospecção presencial';
  return null;
}

export function AdminView({ onShowToast }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'metas' | 'historico' | 'servicos' | 'integracoes'>('usuarios');
  const [profiles, setProfiles] = useState<Profile[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [deletingId, setDeletingId] = useState<string | null>(null); const [form, setForm] = useState(initialForm);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalForm, setGoalForm] = useState(initialGoal);
  const [savingGoal, setSavingGoal] = useState(false);
  const [placesConfigured, setPlacesConfigured] = useState<boolean | null>(null);
  const [mapsConfigured, setMapsConfigured] = useState<boolean | null>(null);
  const [placesKeyInput, setPlacesKeyInput] = useState('');
  const [mapsKeyInput, setMapsKeyInput] = useState('');
  const [savingIntegrations, setSavingIntegrations] = useState(false);
  const [history, setHistory] = useState<Activity[]>([]);
  const [historyUserId, setHistoryUserId] = useState('all');
  const [editingPermissionsId, setEditingPermissionsId] = useState<string | null>(null);
  const [permissionsDraft, setPermissionsDraft] = useState<string[]>([]);
  const [jobTitleDraft, setJobTitleDraft] = useState('');
  const [savingPermissionsId, setSavingPermissionsId] = useState<string | null>(null);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [showPasswordDraft, setShowPasswordDraft] = useState(false);
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);
  const load = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    setLoading(true);
    const { data: sessionData } = await client.auth.getSession();
    const accessToken = sessionData.session?.access_token || '';
    const [profilesRequest, goalsRequest, historyRequest, placesRequest] = await Promise.all([
      client.from('profiles').select('id,username,nome,role,job_title,permissions,photo_url,is_active').eq('is_active', true).order('nome'),
      client.from('user_goals').select('id,user_id,period_start,period_end,target_leads,target_contacts,target_meetings').order('period_start', { ascending: false }),
      client.from('lead_interactions').select('id,created_by,actor_name,actor_email,outcome,notes,occurred_at,leads(company_name,source)').order('occurred_at', { ascending: false }),
      fetch('/api/places', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }).then(response => response.json()).catch(() => ({ placesConfigured: false, mapsConfigured: false })),
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
  const startEditingPermissions = (profile: Profile) => {
    setEditingPermissionsId(profile.id);
    setPermissionsDraft(profile.permissions || []);
    setJobTitleDraft(profile.job_title || 'SDR / Colaborador');
  };
  const togglePermissionDraft = (item: string) => {
    setPermissionsDraft(current => current.includes(item) ? current.filter(value => value !== item) : [...current, item]);
  };
  const savePermissions = async (profile: Profile) => {
    if (!supabase) return;
    setSavingPermissionsId(profile.id);
    const { data, error } = await supabase
      .from('profiles')
      .update({ permissions: permissionsDraft, job_title: jobTitleDraft.trim() || 'SDR / Colaborador' })
      .eq('id', profile.id)
      .select('id,permissions,job_title')
      .maybeSingle();
    setSavingPermissionsId(null);
    if (error || !data) return onShowToast(error?.message || 'Não foi possível atualizar os acessos.', 'error');
    setProfiles(current => current.map(item => item.id === profile.id ? { ...item, permissions: data.permissions, job_title: data.job_title } : item));
    setEditingPermissionsId(null);
    setPermissionsDraft([]);
    setJobTitleDraft('');
    onShowToast(`Acessos de ${profile.nome || profile.username} atualizados.`);
  };
  const createLogin = async () => { if (!supabase) return; setSaving(true); const { data } = await supabase.auth.getSession(); const response = await fetch('/api/admin/create-user', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify(form) }); const result = await response.json(); setSaving(false); if (!response.ok) return onShowToast(result.error || 'Não foi possível criar o login.', 'error'); onShowToast('Login criado. Passe o nome de usuário e a senha por um canal seguro.'); setForm(initialForm); void load(); };
  const resetPassword = async (profile: Profile) => {
    if (!supabase) return;
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(usernameDraft)) return onShowToast('Use um nome de usuário válido, com 3 a 32 caracteres.', 'error');
    if (passwordDraft && passwordDraft.length < 8) return onShowToast('A nova senha deve ter pelo menos 8 caracteres.', 'error');
    setResettingPasswordId(profile.id);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/admin/create-user', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session?.access_token || ''}`,
      },
      body: JSON.stringify({ userId: profile.id, username: usernameDraft, password: passwordDraft }),
    });
    const result = await response.json();
    setResettingPasswordId(null);
    if (!response.ok) return onShowToast(result.error || 'Não foi possível atualizar o login.', 'error');
    setProfiles(current => current.map(item => item.id === profile.id ? { ...item, username: result.username } : item));
    setPasswordUserId(null);
    setPasswordDraft('');
    setUsernameDraft('');
    setShowPasswordDraft(false);
    onShowToast(`Login de ${profile.nome || profile.username} atualizado.`);
  };
  const deleteUser = async (profile: Profile) => { if (!supabase || !window.confirm(`Excluir o login de ${profile.nome || profile.username}? O histórico de leads será preservado.`)) return; setDeletingId(profile.id); const { data } = await supabase.auth.getSession(); const response = await fetch('/api/admin/create-user', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }, body: JSON.stringify({ userId: profile.id }) }); const result = await response.json(); setDeletingId(null); if (!response.ok) return onShowToast(result.error || 'Não foi possível excluir o usuário.', 'error'); onShowToast('Usuário excluído e login desativado.'); void load(); };
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
  const saveIntegrations = async () => {
    if (!supabase) return;
    const googleKey = placesKeyInput.trim();
    const mapsKey = mapsKeyInput.trim();
    if (!googleKey && !mapsKey) return onShowToast('Cole pelo menos uma chave para salvar.', 'error');
    setSavingIntegrations(true);
    const patch: { id: number; google_key?: string; google_maps_browser_key?: string; updated_at: string } = {
      id: 1,
      updated_at: new Date().toISOString(),
    };
    if (googleKey) patch.google_key = googleKey;
    if (mapsKey) patch.google_maps_browser_key = mapsKey;
    const { error } = await supabase.from('settings').upsert(patch, { onConflict: 'id' });
    setSavingIntegrations(false);
    if (error) return onShowToast(error.message, 'error');
    setPlacesKeyInput('');
    setMapsKeyInput('');
    onShowToast('Integrações salvas. As chaves já estão disponíveis para a equipe.', 'success');
    void load();
  };
  const historyOwners = useMemo(() => {
    const owners = new Map<string, string>();
    profiles.forEach(profile => owners.set(`id:${profile.id}`, profile.nome || profile.username));
    history.forEach(item => {
      const key = activityOwnerKey(item);
      owners.set(key, item.actor_name || item.actor_email || 'Usuário removido');
    });
    return Array.from(owners, ([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [history, profiles]);
  const visibleHistory = useMemo(
    () => history.filter(item => historyUserId === 'all' || activityOwnerKey(item) === historyUserId),
    [history, historyUserId],
  );
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
        <input placeholder="Nome de usuário" autoComplete="off" value={form.username} onChange={e => setForm({...form,username:e.target.value.toLowerCase()})} className="input"/>
        <input placeholder="Cargo (ex.: SDR, Vendedor, Closer)" value={form.jobTitle} onChange={e => setForm({...form,jobTitle:e.target.value})} className="input"/>
        <input type="password" autoComplete="new-password" placeholder="Senha inicial (mínimo 8 caracteres)" value={form.password} onChange={e => setForm({...form,password:e.target.value})} className="input"/>
        <div>
          <p className="text-xs font-bold mb-2">Acessos liberados</p>
          <div className="grid grid-cols-2 gap-2">
            {pages.map(page => <label key={page} className="text-[11px] flex gap-1.5"><input type="checkbox" checked={form.permissions.includes(page)} onChange={() => toggle(page)}/>{page}</label>)}
          </div>
          <label className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex gap-2 text-xs font-bold">
            <input type="checkbox" checked={form.permissions.includes('analises_solucoes')} onChange={() => toggle('analises_solucoes')}/> Pode ver soluções e ROI na análise
          </label>
          <label className="mt-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex gap-2 text-xs font-bold">
            <input type="checkbox" checked={form.permissions.includes('crm_gestao')} onChange={() => toggle('crm_gestao')}/> Pode administrar e movimentar o CRM da equipe
          </label>
        </div>
        <button disabled={saving} onClick={() => void createLogin()} className="w-full py-2.5 bg-[#0066ff] text-white rounded-xl text-xs font-bold flex justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>} Criar login
        </button>
      </section>
      <section className="bg-white dark:bg-[#141936] rounded-2xl border overflow-hidden">
        <div className="p-4 font-bold text-sm">Usuários cadastrados</div>
        {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin"/></div> : <div className="divide-y">
          {profiles.map(profile => {
            const isAdmin = ['administrador', 'admin'].includes((profile.role || '').toLowerCase());
            const isEditing = editingPermissionsId === profile.id;
            const isPasswordEditing = passwordUserId === profile.id;
            return <div key={profile.id} className="p-4">
              <div className="flex gap-3 items-center">
                <div className="w-11 h-11 rounded-full bg-[#0066ff]/10 overflow-hidden flex items-center justify-center font-bold">
                  {profile.photo_url ? <img src={profile.photo_url} className="w-full h-full object-cover" alt=""/> : (profile.nome || profile.username).slice(0,1)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs">{profile.nome || 'Sem nome'}</p>
                  <p className="text-[11px] text-[#727687] truncate">@{profile.username}</p>
                  <p className="text-[10px] text-[#0066ff] font-semibold mt-0.5">{profile.job_title || (isAdmin ? 'Administrador' : 'SDR / Colaborador')}</p>
                  <span className={`inline-block mt-2 px-2 py-1 rounded-lg text-[10px] font-bold ${(profile.permissions || []).includes('analises_solucoes') || isAdmin ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {(profile.permissions || []).includes('analises_solucoes') || isAdmin ? 'Soluções na análise: liberadas' : 'Soluções na análise: bloqueadas'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!isAdmin && <button onClick={() => isEditing ? setEditingPermissionsId(null) : startEditingPermissions(profile)} className="px-2 py-2 rounded-lg text-[#0066ff] hover:bg-blue-50 text-xs font-bold flex items-center gap-1" aria-label={`Editar acessos de ${profile.nome || profile.username}`} title="Editar acessos">
                    {isEditing ? <X className="w-4 h-4"/> : <Pencil className="w-4 h-4"/>}<span>{isEditing ? 'Fechar' : 'Acessos'}</span>
                  </button>}
                  <button
                    onClick={() => {
                      if (isPasswordEditing) {
                        setPasswordUserId(null);
                        setPasswordDraft('');
                        setUsernameDraft('');
                        setShowPasswordDraft(false);
                      } else {
                        setPasswordUserId(profile.id);
                        setPasswordDraft('');
                        setUsernameDraft(profile.username);
                        setShowPasswordDraft(false);
                        setEditingPermissionsId(null);
                      }
                    }}
                    className="px-2 py-2 rounded-lg text-amber-700 hover:bg-amber-50 text-xs font-bold flex items-center gap-1"
                    aria-label={`Editar login de ${profile.nome || profile.username}`}
                    title="Editar usuário e senha"
                  >
                    {isPasswordEditing ? <X className="w-4 h-4"/> : <KeyRound className="w-4 h-4"/>}
                    <span>{isPasswordEditing ? 'Fechar' : 'Login'}</span>
                  </button>
                  <label className="text-xs text-[#0066ff] font-bold cursor-pointer"><Upload className="w-4 h-4 inline mr-1"/>Foto<input className="hidden" type="file" accept="image/*" onChange={e => void uploadPhoto(profile,e)}/></label>
                  <button disabled={deletingId === profile.id} onClick={() => void deleteUser(profile)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50" aria-label={`Excluir ${profile.nome || profile.username}`} title="Excluir usuário">
                    {deletingId === profile.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
              {isAdmin && <p className="mt-3 text-[10px] text-[#727687]">Administrador tem acesso completo ao aplicativo.</p>}
              {isPasswordEditing && <div className="mt-4 p-4 rounded-xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20">
                <p className="text-xs font-bold">Alterar usuário e senha</p>
                <p className="text-[10px] text-[#727687] mt-1">Altere o nome de usuário abaixo. Deixe a nova senha vazia para manter a senha atual.</p>
                <label className="block text-[11px] font-bold mt-3">
                  Nome de usuário
                  <input
                    autoComplete="off"
                    value={usernameDraft}
                    onChange={event => setUsernameDraft(event.target.value.toLowerCase())}
                    placeholder="Ex.: ricardo"
                    className="input mt-1"
                  />
                </label>
                <label className="block text-[11px] font-bold mt-3">
                  Nova senha — opcional
                  <div className="relative mt-1">
                    <input
                      type={showPasswordDraft ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={passwordDraft}
                      onChange={event => setPasswordDraft(event.target.value)}
                      placeholder="Mínimo de 8 caracteres"
                      className="input pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordDraft(current => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#727687]"
                      aria-label={showPasswordDraft ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                    >
                      {showPasswordDraft ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </button>
                  </div>
                </label>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => { setPasswordUserId(null); setPasswordDraft(''); setUsernameDraft(''); setShowPasswordDraft(false); }} className="px-3 py-2 rounded-xl border text-xs font-bold">Cancelar</button>
                  <button disabled={resettingPasswordId === profile.id || !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(usernameDraft) || (!!passwordDraft && passwordDraft.length < 8)} onClick={() => void resetPassword(profile)} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                    {resettingPasswordId === profile.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <KeyRound className="w-4 h-4"/>} Salvar login
                  </button>
                </div>
              </div>}
              {isEditing && <div className="mt-4 p-4 rounded-xl border bg-[#f8f9ff] dark:bg-[#10142e]">
                <p className="text-xs font-bold">Editar acessos liberados</p>
                <p className="text-[10px] text-[#727687] mt-1">As mudanças aparecem para este usuário no próximo carregamento da conta.</p>
                <label className="block text-[11px] font-bold mt-3">Cargo<input value={jobTitleDraft} onChange={event => setJobTitleDraft(event.target.value)} placeholder="Ex.: SDR, Vendedor, Closer" className="input mt-1"/></label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                  {pages.map(page => <label key={page} className="text-[11px] flex gap-1.5 items-center"><input type="checkbox" checked={permissionsDraft.includes(page)} onChange={() => togglePermissionDraft(page)}/>{page}</label>)}
                </div>
                <label className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex gap-2 text-xs font-bold">
                  <input type="checkbox" checked={permissionsDraft.includes('analises_solucoes')} onChange={() => togglePermissionDraft('analises_solucoes')}/> Pode ver soluções e ROI na análise
                </label>
                <label className="mt-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex gap-2 text-xs font-bold">
                  <input type="checkbox" checked={permissionsDraft.includes('crm_gestao')} onChange={() => togglePermissionDraft('crm_gestao')}/> Pode administrar e movimentar o CRM da equipe
                </label>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => { setEditingPermissionsId(null); setPermissionsDraft([]); setJobTitleDraft(''); }} className="px-3 py-2 rounded-xl border text-xs font-bold">Cancelar</button>
                  <button disabled={savingPermissionsId === profile.id} onClick={() => void savePermissions(profile)} className="px-4 py-2 rounded-xl bg-[#0066ff] text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                    {savingPermissionsId === profile.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Salvar acessos
                  </button>
                </div>
              </div>}
            </div>;
          })}
        </div>}
      </section>
    </div>}
    {activeTab === 'metas' && <div className="grid lg:grid-cols-[380px_1fr] gap-6">
      <section className="bg-white dark:bg-[#141936] p-5 rounded-2xl border space-y-4">
        <div className="flex items-center gap-2"><Target className="w-5 h-5 text-[#0066ff]"/><div><h3 className="font-bold text-sm">Definir meta individual</h3><p className="text-[11px] text-[#727687]">A meta aparecerá no dashboard do colaborador.</p></div></div>
        <label className="text-xs font-semibold block">Colaborador<select value={goalForm.userId} onChange={event => setGoalForm({ ...goalForm, userId: event.target.value })} className="input mt-1"><option value="">Selecione</option>{profiles.filter(profile => profile.role !== 'admin').map(profile => <option key={profile.id} value={profile.id}>{profile.nome || profile.username}</option>)}</select></label>
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
          return <div key={goal.id} className="p-4"><div className="flex justify-between gap-3"><div><p className="font-bold text-xs">{owner?.nome || owner?.username || 'Usuário removido'}</p><p className="text-[11px] text-[#727687]">{new Date(`${goal.period_start}T12:00:00`).toLocaleDateString('pt-BR')} até {new Date(`${goal.period_end}T12:00:00`).toLocaleDateString('pt-BR')}</p></div><button onClick={() => setGoalForm({ userId: goal.user_id, periodStart: goal.period_start, periodEnd: goal.period_end, targetLeads: goal.target_leads, targetContacts: goal.target_contacts, targetMeetings: goal.target_meetings })} className="text-xs text-[#0066ff] font-bold">Editar</button></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><GoalNumber label="Leads" value={goal.target_leads}/><GoalNumber label="Contatos" value={goal.target_contacts}/><GoalNumber label="Reuniões" value={goal.target_meetings}/></div></div>;
        })}</div>
      </section>
    </div>}
    {activeTab === 'historico' && <section className="bg-white dark:bg-[#141936] rounded-2xl border overflow-hidden">
      <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h3 className="font-bold text-sm">Histórico individual da equipe</h3><p className="text-[11px] text-[#727687]">Ações comerciais vinculadas à conta que as realizou, inclusive de usuários removidos.</p></div><select value={historyUserId} onChange={event => setHistoryUserId(event.target.value)} className="px-3 py-2 rounded-xl border bg-[#f4f2fd] dark:bg-[#10142e] text-xs"><option value="all">Todos os colaboradores</option>{historyOwners.map(owner => <option key={owner.value} value={owner.value}>{owner.label}</option>)}</select></div>
      {!visibleHistory.length && <div className="p-10 text-center text-xs text-[#727687]">Nenhuma atividade registrada para este perfil.</div>}
      <div className="divide-y">{visibleHistory.map(item => {
        const relation = Array.isArray(item.leads) ? item.leads[0] : item.leads;
        const origin = sourceLabel(relation?.source);
        return <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><p className="text-xs font-bold">{item.outcome}</p><p className="text-[11px] text-[#727687]">{relation?.company_name || 'Empresa'} • {item.actor_name || item.actor_email || 'Usuário removido'}{origin ? ` • ${origin}` : ''}{item.notes ? ` • ${item.notes}` : ''}</p></div><time className="text-[10px] text-[#727687] whitespace-nowrap">{new Date(item.occurred_at).toLocaleString('pt-BR')}</time></div>;
      })}</div>
    </section>}
    {activeTab === 'servicos' && <section className="bg-white dark:bg-[#141936] p-6 rounded-2xl border"><h3 className="font-bold">Cadastrar novo serviço</h3><p className="text-xs text-[#727687] mt-1">Esta área foi movida para Administração.</p></section>}
    {activeTab === 'integracoes' && <section className="bg-white dark:bg-[#141936] p-6 rounded-2xl border"><Settings className="text-[#0066ff]"/><h3 className="font-bold mt-3">Integrações</h3><p className="text-xs text-[#727687] mt-1">Use duas chaves diferentes: uma para o servidor e outra para o navegador.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><IntegrationStatus configured={placesConfigured} title="Servidor — Places API (New)" ready="Geração de leads, análises e ranking local prontos." missing="Cole abaixo a chave de servidor da Places API (New)."/><IntegrationStatus configured={mapsConfigured} title="Navegador — Maps JavaScript API" ready="Exibição do mapa e da grade pronta." missing="Cole abaixo a chave de navegador do Maps JavaScript."/></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-bold">Chave de servidor — Google Places API (New)<input type="password" autoComplete="off" value={placesKeyInput} onChange={event => setPlacesKeyInput(event.target.value)} placeholder={placesConfigured ? 'Chave de servidor configurada — cole somente para substituir' : 'Cole a chave de servidor do Google Places'} className="input mt-1"/><span className="block text-[10px] font-normal text-[#727687] mt-1">Usada no servidor para buscar empresas, analisar perfis e calcular rankings. Restrinja somente à Places API (New).</span></label><label className="text-xs font-bold">Chave de navegador — Google Maps JavaScript API<input type="password" autoComplete="off" value={mapsKeyInput} onChange={event => setMapsKeyInput(event.target.value)} placeholder={mapsConfigured ? 'Chave de navegador configurada — cole somente para substituir' : 'Cole a chave de navegador do Google Maps'} className="input mt-1"/><span className="block text-[10px] font-normal text-[#727687] mt-1">Usada para exibir o mapa. Restrinja à Maps JavaScript API e aos domínios do aplicativo.</span></label></div><button disabled={savingIntegrations || (!placesKeyInput.trim() && !mapsKeyInput.trim())} onClick={() => void saveIntegrations()} className="mt-5 px-5 py-2.5 bg-[#0066ff] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2">{savingIntegrations ? <Loader2 className="w-4 h-4 animate-spin"/> : <Settings className="w-4 h-4"/>}Salvar integrações</button><GoogleCalendarIntegrationCard onShowToast={onShowToast}/><GoogleAdsIntegrationCard onShowToast={onShowToast}/><IntegrationGuide/></section>}
  </div>;
  function Tab({ id, label }: { id: typeof activeTab; label: string }) { return <button onClick={() => setActiveTab(id)} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === id ? 'bg-[#0066ff] text-white' : 'text-[#727687]'}`}>{label}</button>; }
}

function GoalNumber({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-[#f4f2fd] dark:bg-[#10142e] p-2"><p className="text-[10px] text-[#727687]">{label}</p><p className="font-bold text-sm">{value}</p></div>; }
function IntegrationStatus({ configured, title, ready, missing }: { configured: boolean | null; title: string; ready: string; missing: string }) { return <div className={`p-4 rounded-xl border ${configured ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}><p className="text-xs font-bold">{title}: {configured ? 'configurada' : 'chave ausente'}</p><p className="text-[11px] mt-1">{configured ? ready : missing}</p></div>; }

type GoogleCalendarStatus = {
  credentialsConfigured: boolean;
  connected: boolean;
  oauthClientId: string;
  connectedEmail: string;
  calendarId: string;
  connectedAt: string | null;
};

function GoogleCalendarIntegrationCard({ onShowToast }: AdminViewProps) {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [form, setForm] = useState({
    oauthClientId: '',
    oauthClientSecret: '',
    calendarId: 'primary',
  });

  const loadStatus = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/google-calendar/config', {
      headers: { Authorization: `Bearer ${data.session?.access_token || ''}` },
      cache: 'no-store',
    });
    const result = await response.json();
    setLoadingStatus(false);
    if (!response.ok) return;
    setStatus(result);
    setForm(current => ({
      ...current,
      oauthClientId: result.oauthClientId || current.oauthClientId,
      calendarId: result.calendarId || 'primary',
    }));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  useEffect(() => {
    const receiveConnection = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'localway-google-calendar') return;
      setConnecting(false);
      if (event.data.success) {
        onShowToast('Google Agenda conectado com sucesso.', 'success');
        void loadStatus();
      } else {
        onShowToast('O Google não autorizou o acesso à agenda.', 'error');
      }
    };
    window.addEventListener('message', receiveConnection);
    return () => window.removeEventListener('message', receiveConnection);
  }, [loadStatus, onShowToast]);

  const saveCredentials = async (reuseGoogleAds = false) => {
    if (!supabase) return;
    setSavingCalendar(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/google-calendar/config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session?.access_token || ''}`,
      },
      body: JSON.stringify({ ...form, reuseGoogleAds }),
    });
    const result = await response.json();
    setSavingCalendar(false);
    if (!response.ok) return onShowToast(result.error || 'Não foi possível salvar o Google Agenda.', 'error');
    setStatus(result);
    setForm(current => ({
      ...current,
      oauthClientId: result.oauthClientId || current.oauthClientId,
      oauthClientSecret: '',
      calendarId: result.calendarId || 'primary',
    }));
    onShowToast(reuseGoogleAds ? 'Credenciais OAuth do Google Ads reaproveitadas.' : 'Credenciais do Google Agenda salvas.', 'success');
  };

  const connectCalendar = async () => {
    if (!supabase) return;
    setConnecting(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/google-calendar/connect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session?.access_token || ''}` },
    });
    const result = await response.json();
    if (!response.ok) {
      setConnecting(false);
      return onShowToast(result.error || 'Não foi possível iniciar a conexão com o Google Agenda.', 'error');
    }
    const popup = window.open(result.authorizationUrl, 'localway-google-calendar', 'width=620,height=720');
    if (!popup) {
      setConnecting(false);
      onShowToast('O navegador bloqueou a janela do Google. Libere pop-ups e tente novamente.', 'error');
    }
  };

  return <div className="mt-7 rounded-2xl border border-[#c2c6d8]/45 bg-[#f8f9ff] dark:bg-[#10142e] p-5">
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div><h4 className="font-bold text-sm">Google Agenda — reuniões da equipe</h4><p className="text-[11px] text-[#727687] mt-1">As reuniões marcadas por qualquer colaborador entram na agenda central conectada.</p></div>
      <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${status?.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
        {loadingStatus ? 'Verificando…' : status?.connected ? `Conectado • ${status.connectedEmail}` : status?.credentialsConfigured ? 'Credenciais salvas' : 'Não configurado'}
      </span>
    </div>
    <div className="grid md:grid-cols-2 gap-3 mt-4">
      <label className="text-xs font-bold">OAuth Client ID<input value={form.oauthClientId} onChange={event => setForm({...form, oauthClientId: event.target.value})} placeholder="...apps.googleusercontent.com" className="input mt-1"/></label>
      <label className="text-xs font-bold">OAuth Client Secret<input type="password" autoComplete="off" value={form.oauthClientSecret} onChange={event => setForm({...form, oauthClientSecret: event.target.value})} placeholder={status?.credentialsConfigured ? 'Configurado — cole apenas para substituir' : 'Segredo do cliente OAuth'} className="input mt-1"/></label>
      <label className="text-xs font-bold md:col-span-2">ID da agenda<input value={form.calendarId} onChange={event => setForm({...form, calendarId: event.target.value})} placeholder="primary" className="input mt-1"/><span className="block text-[10px] font-normal text-[#727687] mt-1">Use <strong>primary</strong> para a agenda principal da conta conectada.</span></label>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button disabled={savingCalendar} onClick={() => void saveCredentials(false)} className="px-4 py-2.5 rounded-xl bg-[#0066ff] text-white text-xs font-bold disabled:opacity-50">{savingCalendar ? 'Salvando…' : 'Salvar credenciais'}</button>
      <button disabled={savingCalendar} onClick={() => void saveCredentials(true)} className="px-4 py-2.5 rounded-xl border border-[#0066ff]/40 text-[#0066ff] text-xs font-bold disabled:opacity-50">Usar OAuth do Google Ads</button>
      <button disabled={connecting || !status?.credentialsConfigured} onClick={() => void connectCalendar()} className="px-4 py-2.5 rounded-xl border border-emerald-500 text-emerald-700 text-xs font-bold disabled:opacity-50">{connecting ? 'Abrindo Google…' : status?.connected ? 'Reconectar agenda' : 'Conectar Google Agenda'}</button>
    </div>
    <p className="mt-3 text-[10px] text-[#727687]">URL de redirecionamento OAuth: <code className="select-all">https://localway-os-2qwb.vercel.app/api/google-calendar/callback</code></p>
  </div>;
}

type GoogleAdsStatus = {
  credentialsConfigured: boolean;
  connected: boolean;
  customerId: string;
  loginCustomerId: string;
  oauthClientId: string;
  connectedEmail: string;
  connectedAt: string | null;
};

function GoogleAdsIntegrationCard({ onShowToast }: AdminViewProps) {
  const [status, setStatus] = useState<GoogleAdsStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [savingAds, setSavingAds] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [form, setForm] = useState({
    developerToken: '',
    customerId: '',
    loginCustomerId: '',
    oauthClientId: '',
    oauthClientSecret: '',
  });

  const loadStatus = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/google-ads/config', {
      headers: { Authorization: `Bearer ${data.session?.access_token || ''}` },
      cache: 'no-store',
    });
    const result = await response.json();
    setLoadingStatus(false);
    if (!response.ok) return;
    setStatus(result);
    setForm(current => ({
      ...current,
      customerId: result.customerId || current.customerId,
      loginCustomerId: result.loginCustomerId || current.loginCustomerId,
      oauthClientId: result.oauthClientId || current.oauthClientId,
    }));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);
  useEffect(() => {
    const receiveConnection = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'localway-google-ads') return;
      setConnecting(false);
      if (event.data.success) {
        onShowToast('Google Ads conectado com sucesso.', 'success');
        void loadStatus();
      } else {
        onShowToast('O Google Ads não autorizou a conexão.', 'error');
      }
    };
    window.addEventListener('message', receiveConnection);
    return () => window.removeEventListener('message', receiveConnection);
  }, [loadStatus, onShowToast]);

  const saveCredentials = async () => {
    if (!supabase) return;
    setSavingAds(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/google-ads/config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session?.access_token || ''}`,
      },
      body: JSON.stringify(form),
    });
    const result = await response.json();
    setSavingAds(false);
    if (!response.ok) return onShowToast(result.error || 'Não foi possível salvar o Google Ads.', 'error');
    setStatus(result);
    setForm(current => ({ ...current, developerToken: '', oauthClientSecret: '' }));
    onShowToast('Credenciais do Google Ads salvas com segurança.', 'success');
  };

  const connectGoogleAds = async () => {
    if (!supabase) return;
    setConnecting(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/google-ads/connect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session?.access_token || ''}` },
    });
    const result = await response.json();
    if (!response.ok) {
      setConnecting(false);
      return onShowToast(result.error || 'Não foi possível iniciar a conexão.', 'error');
    }
    const popup = window.open(result.authorizationUrl, 'localway-google-ads', 'width=620,height=720');
    if (!popup) {
      setConnecting(false);
      return onShowToast('O navegador bloqueou a janela do Google. Libere pop-ups e tente novamente.', 'error');
    }
  };

  return <div className="mt-7 rounded-2xl border border-[#c2c6d8]/45 bg-[#f8f9ff] dark:bg-[#10142e] p-5">
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div><h4 className="font-bold text-sm">Google Ads — volume de palavras-chave</h4><p className="text-[11px] text-[#727687] mt-1">Credenciais ficam criptografadas e são usadas somente pelo servidor.</p></div>
      <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${status?.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
        {loadingStatus ? 'Verificando…' : status?.connected ? `Conectado${status.connectedEmail ? ` • ${status.connectedEmail}` : ''}` : status?.credentialsConfigured ? 'Credenciais salvas' : 'Não configurado'}
      </span>
    </div>
    <div className="grid md:grid-cols-2 gap-3 mt-4">
      <label className="text-xs font-bold">Developer Token<input type="password" autoComplete="off" value={form.developerToken} onChange={event => setForm({...form, developerToken: event.target.value})} placeholder={status?.credentialsConfigured ? 'Configurado — cole apenas para substituir' : 'Token obtido no API Center do Google Ads'} className="input mt-1"/></label>
      <label className="text-xs font-bold">ID da conta Google Ads<input inputMode="numeric" value={form.customerId} onChange={event => setForm({...form, customerId: event.target.value})} placeholder="1234567890 — sem traços" className="input mt-1"/></label>
      <label className="text-xs font-bold">ID da conta administradora (opcional)<input inputMode="numeric" value={form.loginCustomerId} onChange={event => setForm({...form, loginCustomerId: event.target.value})} placeholder="Preencha somente se usar uma conta gerente" className="input mt-1"/></label>
      <label className="text-xs font-bold">OAuth Client ID<input value={form.oauthClientId} onChange={event => setForm({...form, oauthClientId: event.target.value})} placeholder="...apps.googleusercontent.com" className="input mt-1"/></label>
      <label className="text-xs font-bold md:col-span-2">OAuth Client Secret<input type="password" autoComplete="off" value={form.oauthClientSecret} onChange={event => setForm({...form, oauthClientSecret: event.target.value})} placeholder={status?.credentialsConfigured ? 'Configurado — cole apenas para substituir' : 'Segredo do cliente OAuth'} className="input mt-1"/></label>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button disabled={savingAds} onClick={() => void saveCredentials()} className="px-4 py-2.5 rounded-xl bg-[#0066ff] text-white text-xs font-bold disabled:opacity-50">{savingAds ? 'Salvando…' : 'Salvar credenciais'}</button>
      <button disabled={connecting || !status?.credentialsConfigured} onClick={() => void connectGoogleAds()} className="px-4 py-2.5 rounded-xl border border-[#0066ff] text-[#0066ff] text-xs font-bold disabled:opacity-50">{connecting ? 'Abrindo Google…' : status?.connected ? 'Reconectar conta Google' : 'Conectar conta Google Ads'}</button>
    </div>
    <p className="mt-3 text-[10px] text-[#727687]">URL de redirecionamento OAuth: <code className="select-all">https://localway-os-2qwb.vercel.app/api/google-ads/callback</code></p>
  </div>;
}

function IntegrationGuide() {
  return <div className="mt-6 rounded-2xl border border-[#c2c6d8]/40 bg-[#f4f2fd]/60 dark:bg-[#10142e] p-5">
    <h4 className="text-sm font-bold">Passo a passo para configurar</h4>
    <ol className="mt-3 space-y-3 text-[11px] text-[#424656] dark:text-[#b0b4ce] list-decimal pl-4">
      <li><strong>Google Cloud:</strong> abra “APIs e serviços” e ative <strong>Places API (New)</strong> e <strong>Maps JavaScript API</strong> no mesmo projeto.</li>
      <li><strong>Chave de servidor:</strong> crie uma chave separada, restrinja-a somente à Places API (New), cole no primeiro campo e salve. Ela gera leads, analisa perfis e calcula o ranking local.</li>
      <li><strong>Chave de navegador:</strong> crie uma segunda chave, restrinja-a à Maps JavaScript API e aos endereços do aplicativo na Vercel, cole no segundo campo e salve.</li>
      <li><strong>Google Ads:</strong> crie ou acesse uma conta administradora, abra o <strong>API Center</strong> e solicite o Developer Token. No Google Cloud, ative a Google Ads API e crie um cliente OAuth do tipo “Aplicativo da Web”.</li>
      <li><strong>OAuth do Google Ads:</strong> adicione <code>https://localway-os-2qwb.vercel.app/api/google-ads/callback</code> às URLs de redirecionamento autorizadas. Cole o token, os IDs, o Client ID e o Client Secret acima; salve e clique em “Conectar conta Google Ads”.</li>
      <li><strong>Google Agenda:</strong> ative a Google Calendar API no mesmo projeto e adicione <code>https://localway-os-2qwb.vercel.app/api/google-calendar/callback</code> às URLs de redirecionamento do cliente OAuth.</li>
      <li><strong>Conectar agenda:</strong> clique em “Usar OAuth do Google Ads”, salve e depois clique em “Conectar Google Agenda”. Entre com a conta cuja agenda receberá as reuniões de toda a equipe.</li>
      <li><strong>Teste:</strong> entre como colaborador, envie um retorno com decisor para o Follow-up e marque uma reunião. O lead deve entrar no CRM e o evento deve aparecer na agenda central.</li>
    </ol>
    <div className="mt-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3 text-[11px] text-blue-800 dark:text-blue-200"><strong>Fluxo conectado:</strong> Prospecção → Follow-up → CRM. Cada colaborador vê somente os próprios leads; administradores veem o histórico da equipe.</div>
  </div>;
}
