// Opens a stored receipt. Receipts live in private buckets, so the link is a
// short-lived signed URL made on click.

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** PBA receipts (pba_transactions.receipt_url). */
export const PBA_RECEIPTS_BUCKET = "client_receipt_snapshots";
/** Spending log receipts (client_spending_log.receipt_path). */
export const SPENDING_RECEIPTS_BUCKET = "client-spending-receipts";

export function ReceiptLink({ path, bucket }: { path: string | null; bucket: string }) {
  if (!path) return <span className="text-[11px] text-muted-foreground">—</span>;
  const open = async () => {
    if (/^https?:\/\//.test(path)) {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error("Couldn't open the receipt.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <button type="button" className="text-xs text-primary underline" onClick={() => void open()}>
      Open receipt
    </button>
  );
}
