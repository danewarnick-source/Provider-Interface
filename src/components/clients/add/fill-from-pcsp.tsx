// "Start from their PCSP": pick the PDF; the parent uploads and reads it
// (use-new-client-pcsp.ts). Saves nothing.
import { useRef, type ReactNode } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function FillFromPcsp({
  reading,
  onPick,
  children,
  buttonProps,
}: {
  reading: boolean;
  onPick: (file: File) => void;
  /** Button content; defaults to "Fill from PCSP". */
  children?: ReactNode;
  buttonProps?: ButtonProps;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        className="hidden"
        data-testid="fill-from-pcsp-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        {...buttonProps}
        disabled={reading}
        onClick={() => input.current?.click()}
      >
        {reading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading the PCSP…
          </>
        ) : (
          (children ?? (
            <>
              <FileText className="mr-2 h-4 w-4" /> Fill from PCSP
            </>
          ))
        )}
      </Button>
    </>
  );
}
