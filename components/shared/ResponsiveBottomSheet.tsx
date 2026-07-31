import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

/**
 * Painel lateral no desktop, bottom sheet no celular.
 */
export function ResponsiveBottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "right" | "bottom";
}) {
  const isMobile = useIsMobile();
  const resolvedSide = isMobile ? "bottom" : side;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={resolvedSide}
        className={
          resolvedSide === "bottom"
            ? "flex h-[88vh] flex-col gap-0 rounded-t-2xl p-0"
            : "flex w-full flex-col gap-0 p-0 sm:max-w-[460px]"
        }
      >
        {resolvedSide === "bottom" && (
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />
        )}
        <SheetHeader className="gap-1 border-b px-4 py-3">
          <SheetTitle className="text-base leading-tight">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="text-xs">{description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">Detalhes do lead</SheetDescription>
          )}
        </SheetHeader>
        <div className="thin-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {children}
        </div>
        {footer && <div className="border-t bg-surface-2 px-4 py-3">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}
