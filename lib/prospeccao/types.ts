/**
 * Este é o MESMO formato de dado que a Lovable usa nos componentes visuais
 * (src/types/lead.ts do projeto lead-hub). Mantemos ele idêntico de propósito:
 * é o "contrato" que permite reaproveitar os componentes visuais da Lovable
 * sem precisar reescrever nada de layout/estilo.
 *
 * Quem faz a ponte entre isso e os dados reais do Supabase é o adapter.ts.
 */

export type Origem = "presencial" | "online";

export type Resultado =
  | "novo"
  | "nao_atendeu"
  | "retornar"
  | "sem_interesse"
  | "reuniao_marcada"
  | "em_negociacao"
  | "pago"
  | "perdido";

export type Modulo = "prospeccao" | "followup" | "crm" | "arquivado";

export interface HistoricoItem {
  id: string;
  data: string; // ISO
  tipo: string;
  titulo: string;
  detalhe?: string;
  autor: string;
}

export interface Lead {
  id: string;
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
  origem: Origem;
  modulo: Modulo;
  moduloAnterior?: Modulo;
  resultado: Resultado;
  tentativas: number;
  ultimoContato?: string; // ISO
  proximaAcao?: string; // ISO com horário
  proximaAcaoLabel?: string;
  responsavel: string;
  valorEstimado: number;
  ultimaAnotacao?: string;
  historico: HistoricoItem[];
}
