import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

/**
 * Confirmação simples com observação opcional — usada em arquivar,
 * sem interesse e movimentação para "Pago".
 */
export function ArchiveConfirmation({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  withNote = false,
  notePlaceholder = "Observação (opcional)",
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  withNote?: boolean;
  notePlaceholder?: string;
  onConfirm: (nota?: string) => void;
}) {
  const [nota, setNota] = useState("");

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-xs">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {withNote && (
          <Textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={notePlaceholder}
            className="min-h-[70px] resize-none text-xs"
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-9">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="h-9"
            onClick={() => {
              onConfirm(nota.trim() || undefined);
              setNota("");
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
