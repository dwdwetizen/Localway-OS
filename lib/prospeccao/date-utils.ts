export function startOfDay(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(d: Date, days: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + days);
  return date;
}

export function atHour(d: Date, hour = 9, minute = 0) {
  const date = new Date(d);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/** Diferença em dias inteiros (positivo = futuro, negativo = atrasado). */
export function diffDays(iso?: string) {
  if (!iso) return null;
  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(new Date(iso)).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function formatDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export type UrgencyLevel = "atrasado" | "hoje" | "proximo" | "tranquilo" | "sem_data";

export interface UrgencyInfo {
  level: UrgencyLevel;
  tone: "danger" | "warning" | "success" | "muted";
  label: string;
  countdown: string;
  days: number | null;
}

export function getUrgency(iso?: string): UrgencyInfo {
  const days = diffDays(iso);
  if (days === null) {
    return {
      level: "sem_data",
      tone: "muted",
      label: "Sem data agendada",
      countdown: "—",
      days: null,
    };
  }
  if (days < 0) {
    const n = Math.abs(days);
    return {
      level: "atrasado",
      tone: "danger",
      label: n === 1 ? "Atrasado há 1 dia" : `Atrasado há ${n} dias`,
      countdown: n === 1 ? "1 dia atrás" : `${n} dias atrás`,
      days,
    };
  }
  if (days === 0)
    return { level: "hoje", tone: "danger", label: "Contato hoje", countdown: "Hoje", days };
  if (days === 1)
    return { level: "hoje", tone: "danger", label: "Contato amanhã", countdown: "Amanhã", days };
  if (days <= 3)
    return {
      level: "proximo",
      tone: "warning",
      label: `Contato em ${days} dias`,
      countdown: `${days} dias`,
      days,
    };
  return {
    level: "tranquilo",
    tone: "success",
    label: `Contato em ${days} dias`,
    countdown: `${days} dias`,
    days,
  };
}
