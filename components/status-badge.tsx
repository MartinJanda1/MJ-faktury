import { Badge } from "@/components/ui/badge";
import { displayStatus, statusLabel, type DisplayStatus } from "@/lib/status";
import type { InvoiceStatus } from "@/lib/types";
import { cn } from "cn";

const tones: Record<DisplayStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-[oklch(0.93_0.03_230)] text-[oklch(0.32_0.06_240)]",
  partial: "bg-[oklch(0.95_0.04_85)] text-[oklch(0.4_0.08_70)]",
  paid: "bg-[oklch(0.93_0.04_155)] text-[oklch(0.32_0.06_155)]",
  overdue: "bg-destructive/12 text-destructive",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export function StatusBadge({
  status,
  dueDate,
  paidDate,
  size = "sm",
}: {
  status: InvoiceStatus;
  dueDate: string;
  paidDate: string | null;
  size?: "sm" | "lg";
}) {
  const shown = displayStatus({ status, dueDate, paidDate });
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent",
        tones[shown],
        size === "lg" && "h-auto rounded-full px-3.5 py-1.5 text-base font-semibold tracking-wide",
      )}
    >
      {statusLabel(shown)}
    </Badge>
  );
}
