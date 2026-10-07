// Add client, first screen: start from their PCSP or enter them by hand, plus
// a smaller link to import several clients from a spreadsheet.

import { FileSpreadsheet, FileText, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FillFromPcsp } from "./fill-from-pcsp";

const TILE = "h-auto w-full flex-col items-start gap-1 whitespace-normal p-4 text-left";

function TileText({ title, line }: { title: string; line: string }) {
  return (
    <>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs font-normal text-muted-foreground">{line}</span>
    </>
  );
}

export function AddClientStart({
  reading,
  onPcsp,
  onByHand,
  onSpreadsheet,
}: {
  reading: boolean;
  onPcsp: (file: File) => void;
  onByHand: () => void;
  onSpreadsheet: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FillFromPcsp
          reading={reading}
          onPick={onPcsp}
          buttonProps={{ variant: "outline", size: "default", className: TILE }}
        >
          <FileText className="h-5 w-5 text-primary" />
          <TileText
            title="Start from their PCSP"
            line="Upload the PCSP PDF. It fills the profile, contacts, plan year, goals and codes; you check it all before saving."
          />
        </FillFromPcsp>
        <Button type="button" variant="outline" className={TILE} onClick={onByHand}>
          <PenLine className="h-5 w-5 text-primary" />
          <TileText title="Enter by hand" line="Type their name, Medicaid ID and address." />
        </Button>
      </div>
      <Button
        type="button"
        variant="link"
        className="h-11 px-0 text-sm"
        onClick={onSpreadsheet}
        data-testid="import-clients-link"
      >
        <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Import several clients from a spreadsheet
      </Button>
    </div>
  );
}
