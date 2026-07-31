import { Building2, Mail, MapPin, MessageCircle, Phone, User } from "lucide-react";
import type { Lead } from "@/lib/prospeccao/types";
import { ResponsiveBottomSheet } from "@/components/shared/ResponsiveBottomSheet";
import { HistoryTimeline } from "@/components/shared/HistoryTimeline";
import { UrgencyBadge } from "@/components/shared/UrgencyBadge";
import { OriginBadge, StatusBadge } from "@/components/shared/StatusBadge";
import { formatDateTime } from "@/lib/prospeccao/date-utils";
import type { ReactNode } from "react";

export function LeadDetailsPanel({
  lead,
  open,
  onOpenChange,
  footer,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  footer?: ReactNode;
}) {
  if (!lead) return null;

  return (
    <ResponsiveBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={lead.empresa}
      description={`${lead.segmento} • ${lead.cidade}`}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <OriginBadge origem={lead.origem} />
          <StatusBadge status={lead.resultado} />
          <UrgencyBadge date={lead.proximaAcao} />
        </div>

        <Secao titulo="Empresa">
          <Linha icon={Building2} label="Segmento" value={lead.segmento || "—"} />
          <Linha icon={MapPin} label="Endereço" value={`${lead.endereco || "—"} • ${lead.cidade || "—"}`} />
          <Linha icon={Phone} label="Telefone" value={lead.telefone || "—"} />
          <Linha icon={MessageCircle} label="WhatsApp" value={lead.whatsapp || "—"} />
          <Linha icon={Mail} label="E-mail" value={lead.email || "—"} />
        </Secao>

        <Secao titulo="Decisor e responsável">
          <Linha icon={User} label="Decisor" value={lead.decisor || "A identificar"} />
          <Linha icon={User} label="Atendente" value={lead.contato || "—"} />
          <Linha icon={User} label="Responsável" value={lead.responsavel || "—"} />
        </Secao>

        <Secao titulo="Próxima ação">
          <div className="rounded-lg border bg-surface-2 p-2.5">
            <p className="text-xs font-medium">{lead.proximaAcaoLabel ?? "Nenhuma ação agendada"}</p>
            <p className="text-[11px] text-muted-foreground">{formatDateTime(lead.proximaAcao)}</p>
          </div>
        </Secao>

        <Secao titulo="Observações">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {lead.ultimaAnotacao || lead.observacoes || "Sem observações registradas."}
          </p>
        </Secao>

        <Secao titulo="Histórico completo">
          <HistoryTimeline itens={lead.historico} />
        </Secao>
      </div>
    </ResponsiveBottomSheet>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Linha({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <p className="flex items-start gap-1.5 text-xs">
      <Icon className="mt-[2px] size-3 shrink-0 text-muted-foreground" />
      <span className="font-medium">{label}:</span>
      <span className="min-w-0 flex-1 break-words text-muted-foreground">{value}</span>
    </p>
  );
}
