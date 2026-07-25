'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lead, LeadInteraction } from '@/lib/leads';
import { supabase, supabaseConfigurationError } from '@/lib/supabase';

type NewLead = Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'last_contact_at' | 'crm_stage' | 'estimated_value'> & {
  last_contact_at?: string | null;
  crm_stage?: Lead['crm_stage'];
  estimated_value?: Lead['estimated_value'];
};

export function useLeads() {
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
      .insert(input)
      .select()
      .single();
    if (requestError) return { error: requestError.message };
    setLeads(current => [data as Lead, ...current]);
    return { data: data as Lead };
  }, []);

  const updateLead = useCallback(async (id: string, patch: Partial<Lead>) => {
    if (!supabase) return { error: supabaseConfigurationError() };
    const { data, error: requestError } = await supabase
      .from('leads')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (requestError) return { error: requestError.message };
    setLeads(current => current.map(lead => lead.id === id ? data as Lead : lead));
    return { data: data as Lead };
  }, []);

  const addInteraction = useCallback(async (interaction: Omit<LeadInteraction, 'id' | 'occurred_at'> & { occurred_at?: string }) => {
    if (!supabase) return { error: supabaseConfigurationError() };
    const { error: requestError } = await supabase.from('lead_interactions').insert({
      ...interaction,
      occurred_at: interaction.occurred_at || new Date().toISOString(),
    });
    return requestError ? { error: requestError.message } : {};
  }, []);

  return { leads, loading, error, refresh, createLead, updateLead, addInteraction };
}
