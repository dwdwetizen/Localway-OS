'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CalendarCheck, CheckCircle2, Clock, History, Phone, Search, Target } from 'lucide-react';
import { TabType } from './Sidebar';
import { supabase } from '@/lib/supabase';
import { useAuthProfile } from '@/components/AuthGate';

interface DashboardViewProps {
  setActiveTab: (tab: TabType) => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

type Goal = {
  id: string;
  period_start: string;
  period_end: string;
  target_leads: number;
  target_contacts: number;
  target_meetings: number;
};

type Activity = {
  id: string;
  lead_id: string;
  outcome: string;
  notes: string | null;
  occurred_at: string;
  event_type: string;
  new_status: string | null;
  leads: { company_name?: string } | Array<{ company_name?: string }> | null;
};

type LeadSummary = {
  id: string;
  status: string;
  crm_stage: string | null;
  created_at: string;
};

const emptyMetrics = { leads: 0, contacts: 0, meetings: 0, qualified: 0 };

export function DashboardView({ setActiveTab, onShowToast }: DashboardViewProps) {
  const profile = useAuthProfile();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const { data: goalData, error: goalError } = await supabase
      .from('user_goals')
      .select('id,period_start,period_end,target_leads,target_contacts,target_meetings')
      .eq('user_id', profile.id)
      .lte('period_start', today)
      .gte('period_end', today)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (goalError) onShowToast(goalError.message, 'error');
    const activeGoal = (goalData as Goal | null) || null;
    const periodStart = activeGoal?.period_start || monthStart;
    const periodEnd = activeGoal?.period_end || monthEnd;
    const startsAt = `${periodStart}T00:00:00.000Z`;
    const endsAt = `${periodEnd}T23:59:59.999Z`;

    const [leadRequest, activityRequest] = await Promise.all([
      supabase
        .from('leads')
        .select('id,status,crm_stage,created_at')
        .eq('created_by', profile.id)
        .is('archived_at', null)
        .gte('created_at', startsAt)
        .lte('created_at', endsAt),
      supabase
        .from('lead_interactions')
        .select('id,lead_id,outcome,notes,occurred_at,event_type,new_status,leads(company_name)')
        .eq('created_by', profile.id)
        .gte('occurred_at', startsAt)
        .lte('occurred_at', endsAt)
        .order('occurred_at', { ascending: false }),
    ]);

    if (leadRequest.error) onShowToast(leadRequest.error.message, 'error');
    if (activityRequest.error) onShowToast(activityRequest.error.message, 'error');

    const leads = (leadRequest.data || []) as LeadSummary[];
    const history = (activityRequest.data || []) as unknown as Activity[];
    const contacts = history.filter(item => item.event_type !== 'lead_created').length;
    const meetings = new Set(history.filter(item => item.new_status === 'reuniao_marcada').map(item => item.lead_id)).size;
    const qualified = leads.filter(item => item.status === 'qualificado' || item.crm_stage === 'fechado').length;

    setGoal(activeGoal);
    setMetrics({ leads: leads.length, contacts, meetings, qualified });
    setActivities(history.slice(0, 12));
    setLoading(false);
  }, [onShowToast, profile.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const goals = useMemo(() => [
    { label: 'Leads prospectados', current: metrics.leads, target: goal?.target_leads || 0, color: 'bg-[#0066ff]' },
    { label: 'Contatos registrados', current: metrics.contacts, target: goal?.target_contacts || 0, color: 'bg-purple-500' },
    { label: 'Reuniões marcadas', current: metrics.meetings, target: goal?.target_meetings || 0, color: 'bg-emerald-500' },
  ], [goal, metrics]);

  return <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold font-poppins">Visão Geral</h2>
        <p className="text-sm text-[#727687] mt-1">Olá, {profile.nome || profile.username}. Este painel usa seus resultados reais.</p>
      </div>
      <button onClick={() => void loadDashboard()} className="px-4 py-2 rounded-xl border border-[#c2c6d8]/40 text-xs font-bold hover:bg-[#f4f2fd]">Atualizar dados</button>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <Metric icon={Building2} label="Leads prospectados" value={metrics.leads} color="text-[#0066ff] bg-[#0066ff]/10" loading={loading} />
      <Metric icon={Phone} label="Contatos registrados" value={metrics.contacts} color="text-purple-600 bg-purple-500/10" loading={loading} />
      <Metric icon={CalendarCheck} label="Reuniões marcadas" value={metrics.meetings} color="text-amber-600 bg-amber-500/10" loading={loading} />
      <Metric icon={CheckCircle2} label="Leads qualificados" value={metrics.qualified} color="text-emerald-600 bg-emerald-500/10" loading={loading} />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div className="flex items-center gap-2 mb-5"><Target className="w-5 h-5 text-[#0066ff]" /><div><h3 className="font-bold">Minhas metas</h3><p className="text-xs text-[#727687]">{goal ? `${new Date(`${goal.period_start}T12:00:00`).toLocaleDateString('pt-BR')} até ${new Date(`${goal.period_end}T12:00:00`).toLocaleDateString('pt-BR')}` : 'Nenhuma meta definida para este período'}</p></div></div>
        <div className="space-y-5">
          {goals.map(item => {
            const percentage = item.target ? Math.min(100, Math.round((item.current / item.target) * 100)) : 0;
            return <div key={item.label}>
              <div className="flex justify-between text-xs mb-2"><span className="font-semibold">{item.label}</span><span className="font-bold">{item.current} / {item.target || '—'} {item.target ? `(${percentage}%)` : ''}</span></div>
              <div className="h-2.5 rounded-full bg-[#f4f2fd] dark:bg-[#10142e] overflow-hidden"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${percentage}%` }} /></div>
            </div>;
          })}
        </div>
      </section>

      <section className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <h3 className="font-bold mb-4">Ações rápidas</h3>
        <div className="space-y-2">
          <QuickAction icon={Search} label="Prospectar empresas" onClick={() => setActiveTab('prospeccao')} />
          <QuickAction icon={Clock} label="Ver follow-ups" onClick={() => setActiveTab('followup')} />
          <QuickAction icon={CheckCircle2} label="Acompanhar CRM" onClick={() => setActiveTab('crm')} />
        </div>
      </section>
    </div>

    <section className="bg-white dark:bg-[#141936] p-6 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
      <div className="flex items-center gap-2 mb-5"><History className="w-5 h-5 text-[#0066ff]" /><div><h3 className="font-bold">Meu histórico recente</h3><p className="text-xs text-[#727687]">Cadastros, contatos e movimentações realizados por este perfil.</p></div></div>
      {loading && <div className="py-8 text-center text-xs text-[#727687]">Carregando histórico…</div>}
      {!loading && !activities.length && <div className="py-8 text-center text-xs text-[#727687]">Nenhuma atividade registrada neste período.</div>}
      <div className="space-y-4">
        {activities.map(activity => {
          const relation = Array.isArray(activity.leads) ? activity.leads[0] : activity.leads;
          return <article key={activity.id} className="pl-4 border-l-2 border-[#0066ff]/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1"><p className="text-xs font-bold">{activity.outcome}</p><time className="text-[10px] text-[#727687]">{new Date(activity.occurred_at).toLocaleString('pt-BR')}</time></div>
            <p className="text-xs text-[#727687]">{relation?.company_name || 'Empresa'}{activity.notes ? ` • ${activity.notes}` : ''}</p>
          </article>;
        })}
      </div>
    </section>
  </div>;
}

function Metric({ icon: Icon, label, value, color, loading }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string; loading: boolean }) {
  return <div className="bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm"><div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-5 h-5" /></div><p className="text-xs font-semibold text-[#727687] uppercase mt-4">{label}</p><p className="text-2xl font-bold mt-1">{loading ? '…' : value}</p></div>;
}

function QuickAction({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#f4f2fd] dark:bg-[#10142e] hover:bg-[#0066ff]/10 text-xs font-bold text-left"><Icon className="w-4 h-4 text-[#0066ff]" />{label}</button>;
}
