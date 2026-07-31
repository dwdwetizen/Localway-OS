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
  target_contracts: number;
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
  company_name: string;
  decision_maker_name: string | null;
  status: string;
  next_action_at: string | null;
  crm_stage: string | null;
  crm_closed_at: string | null;
  created_at: string;
};

const emptyMetrics = { leads: 0, contacts: 0, meetings: 0, contracts: 0 };

export function DashboardView({ setActiveTab, onShowToast }: DashboardViewProps) {
  const profile = useAuthProfile();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [dashboardLeads, setDashboardLeads] = useState<LeadSummary[]>([]);
  const [dashboardNow] = useState(() => Date.now());
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
      .select('id,period_start,period_end,target_leads,target_contacts,target_meetings,target_contracts')
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
        .select('id,company_name,decision_maker_name,status,next_action_at,crm_stage,crm_closed_at,created_at')
        .eq('created_by', profile.id)
        .or(`created_at.gte.${startsAt},crm_closed_at.gte.${startsAt}`),
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
    const startTime = new Date(startsAt).getTime();
    const endTime = new Date(endsAt).getTime();
    const periodLeads = leads.filter(item => {
      const createdAt = new Date(item.created_at).getTime();
      return createdAt >= startTime && createdAt <= endTime;
    });
    const contacts = history.filter(item => ['prospecting_contact', 'follow_up'].includes(item.event_type)).length;
    const meetings = new Set(history.filter(item => item.new_status === 'reuniao_marcada').map(item => item.lead_id)).size;
    const contracts = leads.filter(item => {
      if (!item.crm_closed_at) return false;
      const closedAt = new Date(item.crm_closed_at).getTime();
      return closedAt >= startTime && closedAt <= endTime;
    }).length;

    setGoal(activeGoal);
    setDashboardLeads(leads);
    setMetrics({ leads: periodLeads.length, contacts, meetings, contracts });
    setActivities(history.slice(0, 12));
    setLoading(false);
  }, [onShowToast, profile.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const goals = useMemo(() => [
    { label: 'Leads prospectados', current: metrics.leads, target: goal?.target_leads || 0, color: 'bg-[#0066ff]' },
    { label: 'Contatos feitos', current: metrics.contacts, target: goal?.target_contacts || 0, color: 'bg-purple-500' },
    { label: 'Reuniões marcadas', current: metrics.meetings, target: goal?.target_meetings || 0, color: 'bg-emerald-500' },
    { label: 'Fechamento de contratos', current: metrics.contracts, target: goal?.target_contracts || 0, color: 'bg-amber-500' },
  ], [goal, metrics]);
  const upcoming = useMemo(() => dashboardLeads
    .filter(item => item.next_action_at && ['retornar_depois', 'nao_atendeu'].includes(item.status))
    .sort((a, b) => new Date(a.next_action_at || 0).getTime() - new Date(b.next_action_at || 0).getTime())
    .slice(0, 6), [dashboardLeads]);

  return <div className="lw-page space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-[26px] font-bold tracking-tight">Olá, {(profile.nome || profile.username).split(' ')[0]}</h2>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Seus resultados desta semana e o que precisa de ação hoje.</p>
      </div>
      <button onClick={() => setActiveTab('prospeccao')} className="lw-primary-button w-full px-5 sm:w-auto">Novo lead</button>
    </div>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric icon={Building2} label="Leads prospectados" value={metrics.leads} target={goal?.target_leads || 0} color="text-[#0066ff]" loading={loading} />
      <Metric icon={Phone} label="Contatos feitos" value={metrics.contacts} target={goal?.target_contacts || 0} color="text-[#0066ff]" loading={loading} />
      <Metric icon={CalendarCheck} label="Reuniões marcadas" value={metrics.meetings} target={goal?.target_meetings || 0} color="text-[#0066ff]" loading={loading} />
      <Metric icon={CheckCircle2} label="Contratos fechados" value={metrics.contracts} target={goal?.target_contracts || 0} color="text-[#0066ff]" loading={loading} />
    </div>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <section>
        <h3 className="mb-2 text-[13px] font-semibold">Próximos follow-ups</h3>
        <div className="lw-panel overflow-hidden divide-y divide-[var(--border-subtle)]">
          {loading && <div className="p-8 text-center text-xs text-[var(--text-secondary)]">Carregando agenda…</div>}
          {!loading && !upcoming.length && <div className="p-8 text-center text-xs text-[var(--text-secondary)]">Nenhum retorno pendente.</div>}
          {upcoming.map(item => {
            const date = new Date(item.next_action_at!);
            const days = Math.ceil((date.getTime() - dashboardNow) / 86_400_000);
            const urgency = days <= 0 ? 'bg-rose-50 text-rose-600 border-rose-200' : days <= 2 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200';
            const label = days < 0 ? `Atrasado ${Math.abs(days)}d` : days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `Em ${days} dias`;
            return <button key={item.id} onClick={() => setActiveTab('followup')} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-container-low)]">
              <span className="min-w-0">
                <strong className="block truncate text-[13px]">{item.company_name}</strong>
                <span className="block truncate text-[11px] text-[var(--text-secondary)]">{item.decision_maker_name || 'Decisor não identificado'} · {date.toLocaleString('pt-BR')}</span>
              </span>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${urgency}`}>{label}</span>
            </button>;
          })}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="lw-panel p-3.5">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold"><Target className="h-4 w-4 text-[var(--primary-main)]" />Atalhos rápidos</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <QuickAction icon={Search} label="Prospectar" onClick={() => setActiveTab('prospeccao')} />
            <QuickAction icon={Clock} label="Follow-up" onClick={() => setActiveTab('followup')} />
            <QuickAction icon={Building2} label="Mapa de calor" onClick={() => setActiveTab('mapa')} />
            <QuickAction icon={CheckCircle2} label="Analisar perfil" onClick={() => setActiveTab('analises')} />
          </div>
        </section>

        <section className="lw-panel p-3.5">
          <h3 className="text-[13px] font-semibold">Histórico recente</h3>
          <div className="mt-2 space-y-2">
            {!loading && !activities.length && <p className="text-[11px] text-[var(--text-secondary)]">Nenhuma atividade recente.</p>}
            {activities.slice(0, 5).map(activity => {
              const relation = Array.isArray(activity.leads) ? activity.leads[0] : activity.leads;
              return <article key={activity.id} className="text-[11px] leading-4 text-[var(--text-secondary)]"><strong className="font-medium text-[var(--text-primary)]">{activity.outcome}</strong> · {relation?.company_name || 'Empresa'}</article>;
            })}
          </div>
        </section>
      </aside>
    </div>
  </div>;
}

function Metric({ icon: Icon, label, value, target, color, loading }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; target: number; color: string; loading: boolean }) {
  const percentage = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return <div className="lw-panel min-w-0 p-3.5 sm:p-4">
    <div className="flex items-center justify-between gap-2"><p className="text-[10px] sm:text-[11px] font-medium text-[var(--text-secondary)]">{label}</p><Icon className={`h-4 w-4 ${color}`} /></div>
    <p className="mt-2 text-2xl font-semibold tabular-nums">{loading ? '…' : value}</p>
    <div className="mt-2 flex justify-between text-[9px] text-[var(--text-secondary)]"><span>Meta da semana</span><span>{value}/{target || '—'}</span></div>
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-container)]"><div className="h-full rounded-full bg-[#1268ff]" style={{ width: `${percentage}%` }} /></div>
  </div>;
}

function QuickAction({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="min-h-12 w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-main)] p-2.5 text-left text-[12px] font-medium shadow-sm hover:border-[#1268ff]/40 hover:bg-[#1268ff]/5"><Icon className="mb-1 h-4 w-4 text-[var(--primary-main)]" />{label}</button>;
}
