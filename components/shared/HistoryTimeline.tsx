import type { HistoricoItem } from "@/lib/prospeccao/types";
import { formatDateTime } from "@/lib/prospeccao/date-utils";

export function HistoryTimeline({ itens }: { itens: HistoricoItem[] }) {
  if (!itens.length) {
    return <p className="text-xs text-muted-foreground">Nenhum registro no histórico ainda.</p>;
  }
  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {itens.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-primary ring-4 ring-background" />
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <p className="text-xs font-semibold">{item.titulo}</p>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatDateTime(item.data)}
            </span>
          </div>
          {item.detalhe && <p className="mt-0.5 text-[11px] text-muted-foreground">{item.detalhe}</p>}
          <p className="mt-0.5 text-[11px] text-muted-foreground">por {item.autor}</p>
        </li>
      ))}
    </ol>
  );
}
