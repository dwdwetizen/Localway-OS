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
    <div className="border-b last:border-b-0">
      <div className="flex flex-col gap-1.5 px-3 py-2 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          aria-expanded={expandido}
        >
          <ChevronDown
            className={cn(
              "mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform",
              expandido && "rotate-180",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{lead.empresa}</span>
              <OriginBadge origem={lead.origem} />
              <StatusBadge status={lead.resultado} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>{lead.segmento}</span>
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" />
                {lead.telefone || lead.whatsapp}
              </span>
              <span className="inline-flex items-center gap-1">
                <User className="size-3" />
                {lead.decisor || lead.contato}
              </span>
              <span className="hidden sm:inline">Último contato: {formatDate(lead.ultimoContato)}</span>
            </div>
          </div>
        </button>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-5 sm:pl-0">
          <div className="hidden min-w-[130px] flex-col items-end sm:flex">
            <span className="truncate text-[11px] font-medium">
              {lead.proximaAcaoLabel ?? "Sem próxima ação"}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {lead.proximaAcao ? formatDateTime(lead.proximaAcao) : "—"}
            </span>
          </div>
          <UrgencyBadge date={lead.proximaAcao} compact />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 sm:pl-8">
        {onNaoAtendeu && (
          <button
            type="button"
            onClick={() => onNaoAtendeu(lead)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[12px] font-medium transition-colors hover:bg-secondary"
          >
            <PhoneOff className="size-3.5" /> Não atendeu
          </button>
        )}
        {onRetornar && (
          <ReturnDatePopover
            hint="O lead será enviado para o Follow-up."
            onConfirm={(data, obs) => onRetornar(lead, data, obs)}
            trigger={
              <button
                type="button"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[12px] font-medium transition-colors hover:bg-secondary"
              >
                <RotateCcw className="size-3.5" /> Retornar depois
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
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[12px] font-medium transition-colors hover:bg-secondary"
              >
                <ThumbsDown className="size-3.5" /> Sem interesse
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
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary"
              >
                <Archive className="size-3.5" /> Arquivar
              </button>
            }
          />
        )}
        {onRestaurar && (
          <button
            type="button"
            onClick={() => onRestaurar(lead)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/8 px-2.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/15"
          >
            <RotateCcw className="size-3.5" /> Restaurar
          </button>
        )}
        {onOpen && (
          <button
            type="button"
            onClick={() => onOpen(lead)}
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-primary hover:bg-primary/8"
          >
            Ver detalhes
          </button>
        )}
      </div>

      {expandido && (
        <div className="grid gap-x-6 gap-y-1.5 border-t bg-surface-2 px-3 py-2.5 text-[11px] sm:grid-cols-2 sm:pl-8">
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
