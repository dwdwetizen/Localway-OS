'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lead, LeadInteraction } from '@/lib/leads';
import { supabase, supabaseConfigurationError } from '@/lib/supabase';
import { useAuthProfile } from '@/components/AuthGate';

type NewLead = Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'last_contact_at' | 'crm_stage' | 'estimated_value' | 'created_by'> & {
  last_contact_at?: string | null;
  crm_stage?: Lead['crm_stage'];
  estimated_value?: Lead['estimated_value'];
};

type ActivityDetails = {
  outcome?: string;
  notes?: string | null;
  next_action_at?: string | null;
  event_type?: string;
};

export function useLeads() {
  const profile = useAuthProfile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError(supabaseConfigurationError());
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: requestError } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (requestError) setError(requestError.message);
    else {
      setLeads((data || []) as Lead[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const createLead = useCallback(async (input: NewLead) => {
    if (!supabase) return { error: supabaseConfigurationError() };
    const { data, error: requestError } = await supabase
      .from('leads')
      .insert({
        ...input,
        created_by: profile.id,
        analysis_data: input.analysis_data ?? {},
      })
      .select()
      .single();
    if (requestError) return { error: requestError.message };
    setLeads(current => [data as Lead, ...current]);
    return { data: data as Lead };
  }, [profile.id]);

  const updateLead = useCallback(async (id: string, patch: Partial<Lead>, activity?: ActivityDetails) => {
    if (!supabase) return { error: supabaseConfigurationError() };
    const previous = leads.find(lead => lead.id === id);
    const { data, error: requestError } = await supabase
      .from('leads')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (requestError) return { error: requestError.message };
    const next = data as Lead;
    setLeads(current => current.map(lead => lead.id === id ? next : lead));
    const changedStatus = patch.status && patch.status !== previous?.status;
    const changedStage = patch.crm_stage && patch.crm_stage !== previous?.crm_stage;
    if (activity || changedStatus || changedStage) {
      const fallbackOutcome = changedStage
        ? `CRM: ${patch.crm_stage}`
        : patch.status
          ? `Status: ${patch.status}`
          : 'Lead atualizado';
      const { error: historyError } = await supabase.from('lead_interactions').insert({
        lead_id: id,
        created_by: profile.id,
        outcome: activity?.outcome || fallbackOutcome,
        notes: activity?.notes || null,
        next_action_at: activity?.next_action_at ?? next.next_action_at,
        event_type: activity?.event_type || (changedStage ? 'crm_stage_change' : 'status_change'),
        previous_status: changedStage ? previous?.crm_stage : previous?.status,
        new_status: changedStage ? next.crm_stage : next.status,
        actor_name: profile.nome,
        actor_email: profile.email,
      });
      if (historyError) return { error: `Lead atualizado, mas o histórico falhou: ${historyError.message}` };
    }
    return { data: next };
  }, [leads, profile.email, profile.id, profile.nome]);

  const deleteLead = useCallback(async (id: string) => {
    if (!supabase) return { error: supabaseConfigurationError() };
    const { error: requestError } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);
    if (requestError) return { error: requestError.message };
    setLeads(current => current.filter(lead => lead.id !== id));
    return {};
  }, []);

  const addInteraction = useCallback(async (interaction: Omit<LeadInteraction, 'id' | 'occurred_at' | 'created_by' | 'actor_name' | 'actor_email'> & { occurred_at?: string }) => {
    if (!supabase) return { error: supabaseConfigurationError() };
    const { error: requestError } = await supabase.from('lead_interactions').insert({
      ...interaction,
      created_by: profile.id,
      occurred_at: interaction.occurred_at || new Date().toISOString(),
      actor_name: profile.nome,
      actor_email: profile.email,
    });
    return requestError ? { error: requestError.message } : {};
  }, [profile.email, profile.id, profile.nome]);

  return { leads, loading, error, refresh, createLead, updateLead, deleteLead, addInteraction };
}
