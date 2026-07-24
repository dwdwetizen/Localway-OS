export type LeadStatus =
  | 'novo'
  | 'ligar_depois'
  | 'retornar_depois'
  | 'reuniao_marcada'
  | 'qualificado'
  | 'sem_interesse'
  | 'perdido';

export type LeadSource = 'presencial' | 'google_places' | 'manual';

export interface Lead {
  id: string;
  company_name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  decision_maker_name: string | null;
  receptionist_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  website_url: string | null;
  rating: number | null;
  review_count: number | null;
  photo_count: number | null;
  has_website: boolean | null;
  health_score: number | null;
  opportunity: string | null;
  source: LeadSource;
  status: LeadStatus;
  next_action_at: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadInteraction {
  id: string;
  lead_id: string;
  outcome: string;
  notes: string | null;
  occurred_at: string;
  next_action_at: string | null;
}

export const statusLabel: Record<LeadStatus, string> = {
  novo: 'Não contatado',
  ligar_depois: 'Ligar depois',
  retornar_depois: 'Retornar depois',
  reuniao_marcada: 'Reunião marcada',
  qualificado: 'Enviar para CRM',
  sem_interesse: 'Sem interesse',
  perdido: 'Perdido',
};

export function normalizePhone(value: string | null) {
  return (value || '').replace(/\D/g, '');
}

export function whatsappLink(value: string | null) {
  const phone = normalizePhone(value);
  return phone ? `https://wa.me/55${phone.replace(/^55/, '')}` : null;
}

export function googleCalendarLink(lead: Lead, start: string) {
  const begins = new Date(start);
  const ends = new Date(begins.getTime() + 60 * 60 * 1000);
  const stamp = (date: Date) =>
    date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const details = [
    `Empresa: ${lead.company_name}`,
    lead.decision_maker_name ? `Decisor: ${lead.decision_maker_name}` : '',
    lead.phone ? `Telefone: ${lead.phone}` : '',
    lead.address ? `Endereço: ${lead.address}` : '',
  ].filter(Boolean).join('\n');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Reunião — ${lead.company_name}`,
    dates: `${stamp(begins)}/${stamp(ends)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
