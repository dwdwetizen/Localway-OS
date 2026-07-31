import { useState } from "react";
import {
  Archive,
  ChevronDown,
  Clock3,
  MapPin,
  MessageCircle,
  Phone,
  PhoneOff,
  RotateCcw,
  ThumbsDown,
  User,
} from "lucide-react";
import type { Lead } from "@/lib/prospeccao/types";
import { UrgencyBadge } from "@/components/shared/UrgencyBadge";
import { OriginBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { ReturnDatePopover } from "@/components/shared/ReturnDatePopover";
import { ArchiveConfirmation } from "@/components/shared/ArchiveConfirmation";
import { formatDate, formatDateTime } from "@/lib/prospeccao/date-utils";
import { cn } from "@/lib/utils";

interface Props {
  lead: Lead;
  onNaoAtendeu?: (lead: Lead) => void;
  onRetornar?: (lead: Lead, dataISO: string, obs?: string) => void;
  onSemInteresse?: (lead: Lead, obs?: string) => void;
  onArquivar?: (lead: Lead) => void;
  onRestaurar?: (lead: Lead) => void;
  onOpen?: (lead: Lead) => void;
}

export function CompactLeadRow({
  lead,
  onNaoAtendeu,
  onRetornar,
  onSemInteresse,
  onArquivar,
  onRestaurar,
  onOpen,
}: Props) {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="border-b border-border/70 last:border-b-0 transition-colors hover:bg-surface-2/60">
      <div className="flex min-w-0 items-start gap-2 px-2.5 pt-2 sm:px-3">
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-secondary"
          aria-label={expandido ? "Recolher informações" : "Expandir informações"}
          aria-expanded={expandido}
        >
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              expandido && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expandido}
        >
          <div className="flex flex-wrap items-center gap-1">
            <span className="truncate text-[12px] font-semibold leading-4 sm:text-[13px]">{lead.empresa}</span>
            <OriginBadge origem={lead.origem} />
            <StatusBadge status={lead.resultado} />
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] leading-4 text-muted-foreground">
            <span>{lead.segmento}</span>
            <span className="inline-flex items-center gap-1">
              <Phone className="size-2.5" />
              {lead.telefone || lead.whatsapp}
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="size-2.5" />
              {lead.decisor || lead.contato}
            </span>
            <span className="hidden lg:inline">Último contato: {formatDate(lead.ultimoContato)}</span>
          </div>
        </button>

        <div className="hidden shrink-0 items-start gap-1.5 sm:flex">
          <div className="min-w-[118px] text-right">
            <p className="truncate text-[9px] font-medium leading-4">
              {lead.proximaAcaoLabel ?? "Sem próxima ação"}
            </p>
            <p className="text-[9px] tabular-nums leading-3 text-muted-foreground">
              {lead.proximaAcao ? formatDateTime(lead.proximaAcao) : "—"}
            </p>
          </div>
          <UrgencyBadge date={lead.proximaAcao} compact />
        </div>
      </div>

      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-2.5 pb-2 pt-1.5 sm:px-3 sm:pl-8">
        {onNaoAtendeu && (
          <button
            type="button"
            onClick={() => onNaoAtendeu(lead)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border/80 bg-surface px-2.5 text-[11px] font-medium transition-colors hover:bg-secondary"
          >
            <PhoneOff className="size-3" /> Não atendeu
          </button>
        )}
        {onRetornar && (
          <ReturnDatePopover
            hint="O lead será enviado para o Follow-up."
            onConfirm={(data, obs) => onRetornar(lead, data, obs)}
            trigger={
              <button
                type="button"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border/80 bg-surface px-2.5 text-[11px] font-medium transition-colors hover:bg-secondary"
              >
                <RotateCcw className="size-3" /> Retornar depois
              </button>
            }
          />
        )}
        {onSemInteresse && (
          <ArchiveConfirmation
            title="Registrar sem interesse?"
            description="O resultado ficará no histórico do lead. Ele continua na prospecção até ser arquivado."
            confirmLabel="Registrar"
            withNote
            onConfirm={(nota) => onSemInteresse(lead, nota)}
            trigger={
              <button
                type="button"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border/80 bg-surface px-2.5 text-[11px] font-medium transition-colors hover:bg-secondary"
              >
                <ThumbsDown className="size-3" /> Sem interesse
              </button>
            }
          />
        )}
        {onArquivar && (
          <ArchiveConfirmation
            title="Arquivar este lead?"
            description="Arquivar não exclui. O lead vai para a aba Arquivados e pode ser restaurado a qualquer momento."
            confirmLabel="Arquivar"
            onConfirm={() => onArquivar(lead)}
            trigger={
              <button
                type="button"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border/80 bg-surface px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary"
              >
                <Archive className="size-3" /> Arquivar
              </button>
            }
          />
        )}
        {onRestaurar && (
          <button
            type="button"
            onClick={() => onRestaurar(lead)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/8 px-2.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
          >
            <RotateCcw className="size-3" /> Restaurar
          </button>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:hidden">
          <UrgencyBadge date={lead.proximaAcao} compact />
        </div>
        {onOpen && (
          <button
            type="button"
            onClick={() => onOpen(lead)}
            className="ml-auto inline-flex h-8 shrink-0 items-center rounded-md px-2 text-[10px] font-medium text-primary hover:bg-primary/8"
          >
            Ver detalhes
          </button>
        )}
      </div>

      {expandido && (
        <div className="grid gap-x-6 gap-y-1 border-t border-border/70 bg-surface-2 px-3 py-2 text-[10px] sm:grid-cols-2 sm:pl-8">
          <Info icon={MapPin} label="Endereço" value={`${lead.endereco} • ${lead.cidade}`} />
          <Info icon={MessageCircle} label="WhatsApp" value={lead.whatsapp || "—"} />
          <Info icon={User} label="Atendente" value={lead.contato || "—"} />
          <Info icon={Phone} label="E-mail" value={lead.email || "—"} />
          <Info icon={Clock3} label="Tentativas" value={`${lead.tentativas}`} />
          <Info icon={User} label="Responsável" value={lead.responsavel} />
          {lead.ultimaAnotacao && (
            <p className="sm:col-span-2">
              <span className="font-medium">Última anotação: </span>
              <span className="text-muted-foreground">{lead.ultimaAnotacao}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <p className="flex min-w-0 items-center gap-1.5">
      <Icon className="size-3 shrink-0 text-muted-foreground" />
      <span className="font-medium">{label}:</span>
      <span className="truncate text-muted-foreground">{value}</span>
    </p>
  );
}
