'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, CalendarCheck, Loader2, PhoneCall, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface EquipeViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

type TeamMember = {
  user_id: string;
  name: string;
  email: string;
  job_title: string;
  role: string | null;
  leads_approached: number;
  meetings_scheduled: number;
};

export function EquipeView({ onShowToast }: EquipeViewProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTeam = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc('team_performance');
    setLoading(false);
    if (error) {
      onShowToast(error.message, 'error');
      return;
    }
    setTeamMembers((data || []).map((member: TeamMember) => ({
      ...member,
      leads_approached: Number(member.leads_approached || 0),
      meetings_scheduled: Number(member.meetings_scheduled || 0),
    })));
  }, [onShowToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTeam(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTeam]);

  const totals = useMemo(() => ({
    leads: teamMembers.reduce((total, member) => total + member.leads_approached, 0),
    meetings: teamMembers.reduce((total, member) => total + member.meetings_scheduled, 0),
  }), [teamMembers]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#141936] p-5 rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] shadow-sm">
        <div>
          <h2 className="text-xl font-bold font-poppins text-[#1a1b22] dark:text-[#f8f7ff]">
            Visão da Equipe
          </h2>
          <p className="text-xs text-[#727687]">
            Ranking real dos usuários ativos, calculado pelo histórico individual de prospecção e reuniões.
          </p>
        </div>
        <button type="button" onClick={() => void loadTeam()} disabled={loading} className="px-4 py-2.5 rounded-xl border border-[#0066ff]/35 text-[#0066ff] text-xs font-bold disabled:opacity-50">
          Atualizar ranking
        </button>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Metric icon={Users} label="Usuários ativos" value={teamMembers.length} />
        <Metric icon={PhoneCall} label="Leads abordados" value={totals.leads} />
        <Metric icon={CalendarCheck} label="Reuniões marcadas" value={totals.meetings} />
      </section>

      <section className="bg-white dark:bg-[#141936] rounded-2xl border border-[#c2c6d8]/30 dark:border-[#2e366b] overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-[#0066ff]" /></div>
        ) : !teamMembers.length ? (
          <div className="p-12 text-center">
            <Users className="w-9 h-9 mx-auto text-[#0066ff]/60" />
            <p className="font-semibold text-sm mt-3">Nenhum usuário ativo encontrado</p>
            <p className="text-xs text-[#727687] mt-1">Crie os colaboradores em Administração → Gestão de usuários.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-[#f4f2fd] dark:bg-[#10142e] text-[#727687] font-bold uppercase border-b border-[#c2c6d8]/30">
                <tr>
                  <th className="p-4">Rank</th>
                  <th className="p-4">Vendedor / Colaborador</th>
                  <th className="p-4">Cargo</th>
                  <th className="p-4">Leads abordados</th>
                  <th className="p-4">Reuniões marcadas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c2c6d8]/20 dark:divide-[#2e366b]">
                {teamMembers.map((member, index) => {
                  const rank = index + 1;
                  return (
                    <tr key={member.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="p-4 font-bold">
                        <span className={`w-8 h-8 rounded-full inline-flex items-center justify-center font-black text-xs ${
                          rank === 1
                            ? 'bg-amber-100 text-amber-700'
                            : rank === 2
                              ? 'bg-slate-100 text-slate-600'
                              : rank === 3
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-[#f4f2fd] text-[#727687]'
                        }`}>
                          {rank <= 3 ? <Award className="w-4 h-4" /> : `#${rank}`}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-full bg-[#0066ff]/10 text-[#0066ff] grid place-items-center font-bold">
                            {member.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-bold text-[#1a1b22] dark:text-[#f8f7ff]">{member.name}</p>
                            <p className="text-[10px] text-[#727687]">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-[#727687]">{member.job_title}</td>
                      <td className="p-4 font-bold">{member.leads_approached}</td>
                      <td className="p-4 font-bold text-purple-600">{member.meetings_scheduled}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return <div className="bg-white dark:bg-[#141936] p-4 rounded-xl border border-[#c2c6d8]/30 dark:border-[#2e366b]">
    <div className="flex items-center gap-2 text-[#727687]"><Icon className="w-4 h-4 text-[#0066ff]" /><span className="text-[10px] font-bold uppercase">{label}</span></div>
    <p className="text-2xl font-bold mt-2 text-[#1a1b22] dark:text-[#f8f7ff]">{value}</p>
  </div>;
}
