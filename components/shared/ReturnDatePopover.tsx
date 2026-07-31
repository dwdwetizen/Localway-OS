import { useState, type ReactNode } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, atHour, formatDate, startOfDay } from "@/lib/prospeccao/date-utils";
import { ptBR } from "date-fns/locale";

const atalhos = [
  { label: "Hoje", dias: 0 },
  { label: "Amanhã", dias: 1 },
  { label: "Em 2 dias", dias: 2 },
  { label: "Em 3 dias", dias: 3 },
  { label: "Em 7 dias", dias: 7 },
];

const horarios = ["09:00", "10:30", "14:00", "16:00", "17:30"];

/**
 * Popover ancorado ao botão para agendar retorno — atalhos rápidos,
 * calendário completo (mês/ano automáticos), horário e observação.
 */
export function ReturnDatePopover({
  trigger,
  onConfirm,
  confirmLabel = "Agendar retorno",
  hint,
}: {
  trigger: ReactNode;
  onConfirm: (dataISO: string, observacao?: string) => void;
  confirmLabel?: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [hora, setHora] = useState("09:00");
  const [obs, setObs] = useState("");

  function confirmar() {
    if (!date) return;
    const [h, m] = hora.split(":").map(Number);
    onConfirm(atHour(date, h, m).toISOString(), obs.trim() || undefined);
    setOpen(false);
    setObs("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-[290px] p-0">
        <div className="border-b px-3 py-2">
          <p className="text-xs font-semibold">Quando retornar?</p>
          {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex flex-wrap gap-1 px-3 py-2">
          {atalhos.map((a) => {
            const d = addDays(new Date(), a.dias);
            const ativo = date && startOfDay(date).getTime() === startOfDay(d).getTime();
            return (
              <button
                key={a.label}
                type="button"
                onClick={() => setDate(d)}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                  ativo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface hover:bg-secondary"
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        <div className="border-t px-1 pb-1">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={date}
            onSelect={setDate}
            month={date}
            onMonthChange={(m) => setDate((d) => d ?? m)}
            disabled={{ before: startOfDay(new Date()) }}
            className="w-full p-2"
          />
        </div>
        <div className="flex flex-wrap gap-1 border-t px-3 py-2">
          {horarios.map((hh) => (
            <button
              key={hh}
              type="button"
              onClick={() => setHora(hh)}
              className={`rounded-md border px-2 py-1 text-[11px] font-medium tabular-nums transition-colors ${
                hora === hh
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface hover:bg-secondary"
              }`}
            >
              {hh}
            </button>
          ))}
        </div>
        <div className="px-3 pb-2">
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Observação (opcional)"
            className="min-h-[52px] resize-none text-xs"
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t bg-surface-2 px-3 py-2">
          <span className="text-[11px] text-muted-foreground">
            {date ? `${formatDate(date.toISOString())} • ${hora}` : "Escolha uma data"}
          </span>
          <Button size="sm" className="h-8" onClick={confirmar} disabled={!date}>
            {confirmLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
