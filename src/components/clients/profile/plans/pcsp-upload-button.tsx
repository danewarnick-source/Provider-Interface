// Upload a PCSP → review → confirm, from one button. Used by the profile
// header ("Upload PCSP") and the Plan goals card ("Upload new PCSP").
// Nothing about the plan is written until the review's Confirm.

import { useRef } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePcspImport } from "./use-pcsp-import";
import { PcspReview } from "./pcsp-review";

export function PcspUploadButton({
  clientId,
  orgId,
  label,
  variant = "default",
  inputTestId,
}: {
  clientId: string;
  orgId: string | undefined;
  label: string;
  variant?: "default" | "outline";
  inputTestId: string;
}) {
  const pcsp = usePcspImport(clientId, orgId);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,application/pdf"
        data-testid={inputTestId}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pcsp.upload(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant={variant}
        disabled={pcsp.reading || !orgId}
        onClick={() => fileRef.current?.click()}
      >
        {pcsp.reading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileUp className="h-4 w-4" />
        )}
        {pcsp.reading ? "Reading the PCSP…" : label}
      </Button>
      {pcsp.read && pcsp.review ? (
        <PcspReview
          read={pcsp.read}
          review={pcsp.review}
          onChange={pcsp.setReview}
          saving={pcsp.saving}
          onConfirm={() => void pcsp.confirm()}
          onClose={pcsp.close}
        />
      ) : null}
    </>
  );
}
