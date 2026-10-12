// Whether EVV applies to this client's service addresses: a tag plus one
// line, from the client's active codes (lib/clients/evv.ts).

import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { evvAddressNote } from "@/lib/clients/evv";

export function EvvNote({ codes }: { codes: readonly string[] }) {
  const note = evvAddressNote(codes);
  return (
    <div className="mb-4 space-y-1.5" data-testid="client-evv-note">
      <StatusTag tone={note.required ? "ok" : "neutral"}>{note.tag}</StatusTag>
      <p className="text-xs text-muted-foreground">{note.text}</p>
    </div>
  );
}
