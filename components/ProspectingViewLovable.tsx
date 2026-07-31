'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuthProfile } from '@/components/AuthGate';
import { useLeads } from '@/hooks/use-leads';
import { supabase } from '@/lib/supabase';
import type { Lead as RealLead, LeadInteraction } from '@/lib/leads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchInput } from '@/components/shared/SearchInput';
import { CompactLeadRow } from '@/components/prospeccao/CompactLeadRow';
import { LeadDetailsPanel } from '@/components/shared/LeadDetailsPanel';
import { ResponsiveBottomSheet } from '@/components/shared/ResponsiveBottomSheet';
import { fromNovoLeadInput, toHistorico, toUILead, type NovoLeadInput } from '@/lib/prospeccao/adapter';
import type { Lead as UILead } from '@/lib/prospeccao/types';
import { addDays, atHour } from '@/lib/prospeccao/date-utils';
import { cn } from '@/lib/utils';

interface ProspectingViewProps {
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenAiPitchModal: (companyName: string, lead?: RealLead) => void;
}

type Aba = 'presencial' | 'online' | 'arquivados';

const vazio: NovoLeadInput = {
  empresa: '', segmento: '', cidade: '', endereco: '', telefone: '',
  whatsapp: '', contato: '', decisor: '', email: '', observacoes: '',
};

export function ProspectingViewLovable({ onShowToast }: ProspectingViewProps) {
  const authProfile = useAuthProfile();
  const { leads, archivedLeads, loading, createLead, updateLead, refresh } = useLeads({ scope: 'personal' });
  const [aba, setAba] = useState<Aba>('presencial');
  const [busca, setBusca] = useState('');
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [form, setForm] = useState<NovoLeadInput>(vazio);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<LeadInteraction[]>([]);
  const [gerando, setGerando] = useState(false);
  const [online, setOnline] = useState({ segmento: '', local: '', quantidade: 5 });
  const [owners, setOwners] = useState<Record<string, string>>({});

  // Nomes dos responsáveis, pra exibir "Responsável: Fulano" em vez do ID.
  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data } = await supabase.from('profiles').select('id,nome');
      const map: Record<string, string> = {};
      (data || []).forEach((p: { id: string; nome: string | null }) => { map[p.id] = p.nome || 'Equipe'; });
      setOwners(map);
    })();
  }, []);

  const todosReais = useMemo(() => [...leads, ...archivedLeads], [leads, archivedLeads]);
  const uiLeads = useMemo(
    () => todosReais.map((l) => toUILead(l, owners[l.created_by || ''] || authProfile.nome || 'Você')),
    [todosReais, owners, authProfile.nome],
  );
  const realById = useMemo(() => new Map(todosReais.map((l) => [l.id, l])), [todosReais]);

  const filtrar = (lista: UILead[]) => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((l) =>
      [l.empresa, l.decisor, l.contato, l.telefone, l.whatsapp, l.segmento].join(' ').toLowerCase().includes(q),
    );
  };

  const presenciais = filtrar(uiLeads.filter((l) => l.modulo === 'prospeccao' && l.origem === 'presencial'));
  const onlines = filtrar(uiLeads.filter((l) => l.modulo === 'prospeccao' && l.origem === 'online'));
  const arquivados = filtrar(uiLeads.filter((l) => l.modulo === 'arquivado'));
  const abas: { id: Aba; label: string; count: number }[] = [
    { id: 'presencial', label: 'Presencial', count: presenciais.length },
    { id: 'online', label: 'Online', count: onlines.length },
    { id: 'arquivados', label: 'Arquivados', count: arquivados.length },
  ];
  const lista = aba === 'presencial' ? presenciais : aba === 'online' ? onlines : arquivados;
  const detalhe = detalheId ? uiLeads.find((l) => l.id === detalheId) || null : null;

  useEffect(() => {
    if (!detalheId || !supabase) { setHistorico([]); return; }
    void (async () => {
      const { data } = await supabase.from('lead_interactions').select('*').eq('lead_id', detalheId).order('occurred_at', { ascending: false });
      setHistorico((data || []) as LeadInteraction[]);
    })();
  }, [detalheId]);

  const handlers = {
    onNaoAtendeu: async (uiLead: UILead) => {
      const lead = realById.get(uiLead.id);
      if (!lead) return;
      const amanha = atHour(addDays(new Date(), 1), 9).toISOString();
      const result = await updateLead(lead.id, {
        status: 'nao_atendeu', next_action_at: amanha, last_contact_at: new Date().toISOString(),
      }, { outcome: 'Não atendeu', event_type: 'prospecting_contact', next_action_at: amanha });
      if (result.error) onShowToast(result.error, 'error');
      else onShowToast('Nova tentativa agendada para amanhã', 'success');
    },
    onRetornar: async (uiLead: UILead, dataISO: string, obs?: string) => {
      const lead = realById.get(uiLead.id);
      if (!lead) return;
      const result = await updateLead(lead.id, {
        status: 'retornar_depois', next_action_at: dataISO, notes: obs || lead.notes, last_contact_at: new Date().toISOString(),
      }, { outcome: 'Retorno agendado', notes: obs, event_type: 'prospecting_contact', next_action_at: dataISO });
      if (result.error) onShowToast(result.error, 'error');
      else onShowToast('Retorno agendado — lead enviado ao Follow-up', 'success');
    },
    onSemInteresse: async (uiLead: UILead, obs?: string) => {
      const lead = realById.get(uiLead.id);
      if (!lead) return;
      const result = await updateLead(lead.id, {
        status: 'sem_interesse', notes: obs || lead.notes, archived_at: new Date().toISOString(), archived_by: authProfile.id, last_contact_at: new Date().toISOString(),
      }, { outcome: 'Sem interesse', notes: obs, event_type: 'prospecting_contact' });
      if (result.error) onShowToast(result.error, 'error');
      else onShowToast('Resultado registrado: sem interesse', 'info');
    },
    onArquivar: async (uiLead: UILead) => {
      const lead = realById.get(uiLead.id);
      if (!lead) return;
      const result = await updateLead(lead.id, { archived_at: new Date().toISOString(), archived_by: authProfile.id });
      if (result.error) onShowToast(result.error, 'error');
      else onShowToast('Lead arquivado. Disponível na aba Arquivados.', 'success');
    },
    onRestaurar: async (uiLead: UILead) => {
      const lead = realById.get(uiLead.id);
      if (!lead) return;
      const result = await updateLead(lead.id, { archived_at: null, archived_by: null, status: 'novo' });
      if (result.error) onShowToast(result.error, 'error');
      else onShowToast('Lead restaurado', 'success');
    },
    onOpen: (uiLead: UILead) => setDetalheId(uiLead.id),
  };

  async function salvarLead() {
    if (!form.empresa.trim()) return onShowToast('Informe o nome da empresa', 'error');
    const result = await createLead(fromNovoLeadInput(form, 'presencial'));
    if (result.error) return onShowToast(result.error, 'error');
    setForm(vazio); setCadastroAberto(false); setAba('presencial');
    onShowToast('Lead cadastrado com sucesso', 'success');
  }

  async function gerar() {
    if (!online.segmento.trim() || !online.local.trim()) return onShowToast('Informe segmento e cidade ou bairro', 'error');
    if (!supabase) return onShowToast('Integração com Google Places não configurada.', 'error');
    setGerando(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token || ''}` },
        body: JSON.stringify({ category: online.segmento, city: online.local, maxResults: online.quantidade }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao gerar leads.');
      let added = 0;
      for (const place of data.places || []) {
        if (todosReais.some((l) => l.google_place_id === place.google_place_id)) continue;
        const result = await createLead({ ...place, decision_maker_name: null, receptionist_name: null, email: null, notes: null, source: 'google_places', status: 'novo', next_action_at: null });
        if (!result.error) added += 1;
      }
      onShowToast(added ? `${added} empresa(s) encontrada(s)` : 'Nenhum lead novo encontrado.', added ? 'success' : 'info');
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Erro ao gerar leads.', 'error');
    } finally { setGerando(false); }
  }

  if (loading && !uiLeads.length) {
    return <div className="rounded-lg border bg-surface p-8 text-center text-xs text-muted-foreground">Carregando leads…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Operação comercial</p>
          <h2 className="text-lg font-semibold">Prospecção</h2>
          <p className="text-xs text-muted-foreground">Leads presenciais e online em andamento</p>
        </div>
        <Button size="sm" className="h-9" onClick={() => setCadastroAberto(true)}>
          <Plus className="size-4" /> Cadastrar lead
        </Button>
      </div>

      <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={cn(
              'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[12px] font-medium transition-colors',
              aba === a.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface hover:bg-secondary',
            )}
          >
            {a.label}
            <span className={cn('rounded px-1 text-[10px] tabular-nums', aba === a.id ? 'bg-primary-foreground/20' : 'bg-secondary text-muted-foreground')}>
              {a.count}
            </span>
          </button>
        ))}
        <div className="ml-auto hidden w-64 sm:block">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar empresa, contato..." />
        </div>
      </div>
      <div className="sm:hidden">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar empresa, contato..." />
      </div>

      {aba === 'online' && (
        <div className="grid gap-2 rounded-lg border bg-surface p-3 sm:grid-cols-[1fr_1fr_120px_auto]">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Segmento</Label>
            <Input value={online.segmento} onChange={(e) => setOnline((o) => ({ ...o, segmento: e.target.value }))} placeholder="Ex.: Pizzaria" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Cidade ou bairro</Label>
            <Input value={online.local} onChange={(e) => setOnline((o) => ({ ...o, local: e.target.value }))} placeholder="Ex.: Cambuí, Campinas" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Quantidade</Label>
            <Input type="number" min={1} max={10} value={online.quantidade} onChange={(e) => setOnline((o) => ({ ...o, quantidade: Math.min(10, Number(e.target.value) || 1) }))} />
          </div>
          <div className="flex items-end">
            <Button className="h-9 w-full sm:w-auto" onClick={gerar} disabled={gerando}>{gerando ? 'Buscando...' : 'Gerar leads'}</Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-surface">
        {lista.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            {aba === 'arquivados' ? 'Nenhum lead arquivado.' : 'Nenhum lead encontrado com os filtros atuais.'}
          </p>
        ) : (
          lista.map((lead) =>
            aba === 'arquivados'
              ? <CompactLeadRow key={lead.id} lead={lead} onOpen={handlers.onOpen} onRestaurar={handlers.onRestaurar} />
              : <CompactLeadRow key={lead.id} lead={lead} {...handlers} />,
          )
        )}
      </div>

      <ResponsiveBottomSheet
        open={cadastroAberto}
        onOpenChange={setCadastroAberto}
        title="Cadastrar lead"
        description="Prospecção presencial"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 flex-1" onClick={() => setCadastroAberto(false)}>Cancelar</Button>
            <Button className="h-10 flex-1" onClick={salvarLead}>Salvar lead</Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {([
            ['empresa', 'Empresa', true], ['segmento', 'Segmento', false], ['cidade', 'Cidade', false],
            ['endereco', 'Endereço', true], ['telefone', 'Telefone', false], ['whatsapp', 'WhatsApp', false],
            ['contato', 'Funcionário ou atendente', true], ['decisor', 'Nome do decisor', true], ['email', 'E-mail', true],
          ] as [keyof NovoLeadInput, string, boolean][]).map(([campo, label, full]) => (
            <div key={campo} className={full ? 'col-span-2 space-y-1' : 'space-y-1'}>
              <Label className="text-[11px] text-muted-foreground">{label}</Label>
              <Input value={form[campo]} onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))} />
            </div>
          ))}
          <div className="col-span-2 space-y-1">
            <Label className="text-[11px] text-muted-foreground">Observações</Label>
            <Textarea className="min-h-[70px] resize-none" value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
          </div>
        </div>
      </ResponsiveBottomSheet>

      <LeadDetailsPanel
        lead={detalhe ? { ...detalhe, historico: toHistorico(historico) } : null}
        open={!!detalhe}
        onOpenChange={(o) => { if (!o) setDetalheId(null); void refresh(); }}
      />
    </div>
  );
}
