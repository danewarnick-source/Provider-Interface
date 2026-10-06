import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { generateEmployeeFaceSheetFn } from "@/lib/team-members/staff-record-pdf.functions";
import { safeErrorMessage } from "@/lib/safe-error-message";

export type StaffRecordAction = "download" | "print" | "save";

/**
 * Staff record PDF for the profile ⋯ menu:
 *   • Download — save the PDF.
 *   • Print — open the PDF and invoke the browser print dialog.
 *   • Save to documents — snapshot the record into the team member's documents.
 */
export function useStaffRecord(staffId: string, organizationId: string) {
  const gen = useServerFn(generateEmployeeFaceSheetFn);
  const [busy, setBusy] = useState<StaffRecordAction | null>(null);

  async function run(kind: StaffRecordAction) {
    setBusy(kind);
    try {
      const { pdfBase64, filename, shipped } = await gen({
        data: { staffId, organizationId, ship: kind === "save" },
      });
      if (kind === "save") {
        if (shipped) toast.success("Staff record saved to documents.");
        else toast.error("Could not save the staff record to documents.");
        return;
      }
      const bin = atob(pdfBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      try {
        if (kind === "download") {
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else {
          const win = window.open(url, "_blank", "noopener,noreferrer");
          if (win) win.addEventListener("load", () => win.print(), { once: true });
          else toast.error("Enable popups to print the staff record.");
        }
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (e) {
      toast.error(safeErrorMessage(e, "Could not build the staff record"));
    } finally {
      setBusy(null);
    }
  }

  return { run, busy };
}
