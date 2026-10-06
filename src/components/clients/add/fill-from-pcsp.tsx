import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { readPcspForNewClient } from "@/lib/clients/create.functions";
import type { PcspResult } from "@/lib/clients/pcsp/parser-shared";
import { fileToBase64 } from "@/components/clients/shared/file-to-base64";

/** "Fill from PCSP": read a USTEPS PCSP and hand the result to the form. Saves nothing. */
export function FillFromPcsp({
  organizationId,
  onRead,
}: {
  organizationId: string;
  onRead: (p: PcspResult) => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const readFn = useServerFn(readPcspForNewClient);
  const [reading, setReading] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      onRead(await readFn({ data: { organizationId, fileBase64: await fileToBase64(file) } }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        className="hidden"
        data-testid="fill-from-pcsp-input"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={reading}
        onClick={() => input.current?.click()}
      >
        {reading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Fill from PCSP
      </Button>
    </>
  );
}
