import { cn } from "@/lib/utils";
import type { Origem, Resultado } from "@/lib/prospeccao/types";

const map: Record<Resultado, { label: string; className: string }> = {
  novo: { label: "Novo", className: "bg-accent text-accent-foreground border-accent" },
  nao_atendeu: { label: "Não atendeu", className: "bg-danger/10 text-danger border-danger/25" },
  retornar: { label: "Retornar", className: "bg-warning/15 text-warning-foreground border-warning/40" },
  sem_interesse: { label: "Sem interesse", className: "bg-muted text-muted-foreground border-border" },
  reuniao_marcada: { label: "Reunião marcada", className: "bg-primary/10 text-primary border-primary/25" },
  em_negociacao: { label: "Em negociação", className: "bg-primary/10 text-primary border-primary/25" },
  pago: { label: "Pago", className: "bg-success/12 text-success border-success/30" },
  perdido: { label: "Perdido", className: "bg-danger/10 text-danger border-danger/25" },
};

export function StatusBadge({ status, className }: { status: Resultado; className?: string }) {
  const s = map[status] ?? map.novo;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  );
}

export function OriginBadge({ origem, className }: { origem: Origem; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4",
        origem === "online"
          ? "border-primary/25 bg-primary/8 text-primary"
          : "border-border bg-surface-2 text-muted-foreground",
        className,
      )}
    >
      {origem === "online" ? "Online" : "Presencial"}
    </span>
  );
}
