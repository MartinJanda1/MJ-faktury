import Link from "next/link";
import {
  cancelInvoiceAction,
  duplicateInvoiceAction,
  markPaidAction,
  markUnpaidAction,
} from "@/lib/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/types";

type Props = {
  id: string;
  number: string;
  status: InvoiceStatus;
  editable: boolean;
  returnTo?: string;
};

const actionClass = cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2 text-xs");

export function InvoiceListActions({ id, number, status, editable, returnTo = "/faktury" }: Props) {
  const isPaid = status === "paid";
  const isCancelled = status === "cancelled";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Link href={`/faktury/${id}`} className={actionClass} title="Otevřít">
        Detail
      </Link>
      {editable ? (
        <Link href={`/faktury/${id}/upravit`} className={actionClass} title="Upravit">
          Upravit
        </Link>
      ) : null}
      <Link href={`/tisk/${id}?pdf=1`} className={actionClass} title="PDF">
        PDF
      </Link>
      {!isPaid && !isCancelled ? (
        <form action={markPaidAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" className={actionClass} title="Označit uhrazeno">
            Uhrazeno
          </button>
        </form>
      ) : null}
      {isPaid ? (
        <form action={markUnpaidAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" className={actionClass} title="Zrušit úhradu">
            Zrušit úhradu
          </button>
        </form>
      ) : null}
      <form action={duplicateInvoiceAction}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className={actionClass} title={`Kopírovat ${number}`}>
          Kopie
        </button>
      </form>
      {!isCancelled ? (
        <form action={cancelInvoiceAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" className={cn(actionClass, "text-destructive")} title="Stornovat">
            Storno
          </button>
        </form>
      ) : null}
    </div>
  );
}
