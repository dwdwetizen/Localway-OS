import { AlertTriangle, CalendarClock, CalendarOff, CheckCircle2, Clock } from "lucide-react";
import { getUrgency } from "@/lib/prospeccao/date-utils";
import { cn } from "@/lib/utils";

const toneClasses = {
  danger: "bg-danger/10 text-danger border-danger/25",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  success: "bg-success/10 text-success border-success/25",
  muted: "bg-muted text-muted-foreground border-border",
} as const;

export function UrgencyBadge({
  date,
  compact = false,
  className,
}: {
  date?: string;
  compact?: boolean;
  className?: string;
}) {
  const u = getUrgency(date);
  const Icon =
    u.tone === "danger"
      ? u.level === "atrasado"
        ? AlertTriangle
        : Clock
      : u.tone === "warning"
        ? CalendarClock
        : u.tone === "success"
          ? CheckCircle2
          : CalendarOff;

  return (
    <span
      title={u.label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4",
        toneClasses[u.tone],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span className="whitespace-nowrap">{compact ? u.countdown : u.label}</span>
    </span>
  );
}

export function Countdown({ date, className }: { date?: string; className?: string }) {
  const u = getUrgency(date);
  return (
    <span
      className={cn(
        "tabular-nums text-[11px] font-medium",
        u.tone === "danger"
          ? "text-danger"
          : u.tone === "warning"
            ? "text-warning-foreground"
            : u.tone === "success"
              ? "text-success"
              : "text-muted-foreground",
        className,
      )}
    >
      {u.countdown}
    </span>
  );
}
