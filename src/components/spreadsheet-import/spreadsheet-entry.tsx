// Shared first step of the team member and client imports: download the
// Excel or CSV template, then drop or choose the filled-in file.

import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function TemplateButtons({
  disabled,
  onExcel,
  onCsv,
}: {
  disabled?: boolean;
  onExcel: () => Promise<void> | void;
  onCsv: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          void Promise.resolve(onExcel()).catch(() =>
            toast.error("Couldn't build the Excel template. Try the CSV template."),
          );
        }}
      >
        <Download className="mr-2 h-4 w-4" /> Download Excel template
      </Button>
      <Button type="button" variant="outline" disabled={disabled} onClick={onCsv}>
        <Download className="mr-2 h-4 w-4" /> Download CSV template
      </Button>
    </div>
  );
}

/** Drop a CSV or Excel file, or click to choose one. */
export function SpreadsheetDrop({
  disabled,
  onFile,
}: {
  disabled?: boolean;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      data-testid="import-drop-zone"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (!disabled && file) onFile(file);
      }}
      className={
        "grid min-h-[44px] cursor-pointer gap-2 rounded-md border border-dashed p-6 text-center text-sm " +
        (dragging ? "border-[var(--hive-primary)] bg-muted/50" : "border-border")
      }
    >
      <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
      <span>Drop a CSV or Excel file, or click to choose</span>
      <input
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}
