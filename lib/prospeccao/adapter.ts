import type { Lead as RealLead, LeadInteraction, LeadStatus } from '@/lib/leads';
import type { HistoricoItem, Lead as UILead, Modulo, Resultado } from '@/lib/prospeccao/types';

/**
 * Converte um lead REAL (linha da tabela `leads` no Supabase) para o formato
 * visual que os componentes copiados da Lovable esperam.
 *
 * Nada aqui inventa dado: cada campo vem de uma coluna real. As únicas
 * exceções estão marcadas com comentário "APROXIMAÇÃO".
 */
export function toUILead(lead: RealLead, ownerName: string): UILead {
  return {
    id: lead.id,
    empresa: lead.company_name,
    segmento: lead.category || '',
    cidade: lead.city || '',
    endereco: lead.address || '',
    telefone: lead.phone || '',
    whatsapp: lead.whatsapp || lead.phone || '',
    contato: lead.receptionist_name || '',
    decisor: lead.decision_maker_name || '',
    email: lead.email || '',
    observacoes: lead.notes || '',
    origem: lead.source === 'presencial' ? 'presencial' : 'online',
    modulo: resolveModulo(lead),
    resultado: resolveResultado(lead.status),
    // APROXIMAÇÃO: o número de tentativas ainda não tem uma coluna própria.
    // Dá pra somar a partir do histórico (lead_interactions) numa 2ª etapa.
    tentativas: 0,
    ultimoContato: lead.last_contact_at || undefined,
    proximaAcao: lead.next_action_at || undefined,
    proximaAcaoLabel: proximaAcaoLabel(lead),
    responsavel: ownerName,
    valorEstimado: lead.estimated_value || 0,
    ultimaAnotacao: lead.notes || undefined,
    historico: [],
  };
}

function resolveModulo(lead: RealLead): Modulo {
  if (lead.archived_at) return 'arquivado';
  if (lead.crm_stage) return 'crm';
  if (lead.status === 'retornar_depois' && lead.next_action_at) return 'followup';
  return 'prospeccao';
}

function resolveResultado(status: LeadStatus): Resultado {
  switch (status) {
    case 'novo': return 'novo';
    case 'nao_atendeu': return 'nao_atendeu';
    case 'ligar_depois':
    case 'retornar_depois': return 'retornar';
    case 'sem_interesse': return 'sem_interesse';
    case 'reuniao_marcada': return 'reuniao_marcada';
    case 'qualificado': return 'em_negociacao';
    case 'perdido': return 'perdido';
    default: return 'novo';
  }
}

function proximaAcaoLabel(lead: RealLead): string | undefined {
  if (!lead.next_action_at) return undefined;
  if (lead.status === 'nao_atendeu') return 'Nova tentativa de contato';
  if (lead.status === 'retornar_depois' || lead.status === 'ligar_depois') return 'Retorno agendado';
  return 'Próxima ação';
}

/** Converte o histórico real (lead_interactions) para o formato da linha do tempo da Lovable. */
export function toHistorico(interactions: LeadInteraction[]): HistoricoItem[] {
  return interactions.map((item) => ({
    id: item.id,
    data: item.occurred_at,
    tipo: item.event_type,
    titulo: item.outcome,
    detalhe: item.notes || undefined,
    autor: item.actor_name || 'Equipe',
  }));
}

export interface NovoLeadInput {
  empresa: string;
  segmento: string;
  cidade: string;
  endereco: string;
  telefone: string;
  whatsapp: string;
  contato: string;
  decisor: string;
  email: string;
  observacoes: string;
}

/** Monta o payload de criação no formato real da tabela `leads`, a partir do formulário visual. */
export function fromNovoLeadInput(input: NovoLeadInput, origem: 'presencial' | 'online' = 'presencial') {
  return {
    company_name: input.empresa.trim(),
    category: input.segmento || null,
    city: input.cidade || null,
    address: input.endereco || null,
    phone: input.telefone || null,
    whatsapp: input.whatsapp || input.telefone || null,
    email: input.email || null,
    notes: input.observacoes || null,
    decision_maker_name: input.decisor || null,
    receptionist_name: input.contato || null,
    source: (origem === 'presencial' ? 'presencial' : 'manual') as RealLead['source'],
    status: 'novo' as LeadStatus,
    next_action_at: null,
    google_place_id: null,
    google_maps_url: null,
    website_url: null,
    rating: null,
    review_count: null,
    photo_count: null,
    has_website: null,
    health_score: null,
    opportunity: null,
    latitude: null,
    longitude: null,
    analysis_data: {},
    analysed_at: null,
  };
}
