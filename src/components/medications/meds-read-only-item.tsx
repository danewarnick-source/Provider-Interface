// One medication on the staff read-only list: name and dose, when it's
// given, what it's for, how they take it, what to watch for, signs of a bad
// reaction, PRN rules, psychotropic use, and the safety badges.

import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { recordPhiAccess } from "@/lib/phi-access-audit.functions";
import type { ReadOnlyLine, ReadOnlyMedView } from "@/lib/medications/staff-meds";

function Lines({ lines }: { lines: ReadOnlyLine[] }) {
  return (
    <dl className="space-y-1">
      {lines.map((l) => (
        <div key={l.label} className="text-sm leading-snug">
          <dt className="inline font-medium text-foreground">{l.label}: </dt>
          <dd className="inline whitespace-pre-wrap text-muted-foreground">{l.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-2.5">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function useOpenClientDocument(clientId: string) {
  const record = useServerFn(recordPhiAccess);
  return async (documentId: string) => {
    // Open the tab now so phones don't block it after the await.
    const tab = window.open("", "_blank");
    const { data } = await supabase
      .from("client_documents")
      .select("organization_id, storage_path, file_name")
      .eq("id", documentId)
      .maybeSingle();
    const doc = data as {
      organization_id: string;
      storage_path: string | null;
      file_name: string;
    } | null;
    const signed = doc?.storage_path
      ? await supabase.storage.from("client-documents").createSignedUrl(doc.storage_path, 60)
      : null;
    const url = signed?.data?.signedUrl;
    if (!doc || !url) {
      tab?.close();
      toast.error("Couldn't open the behavior support plan. Ask your supervisor for a copy.");
      return;
    }
    void record({
      data: {
        organizationId: doc.organization_id,
        resourceType: "client_document",
        resourceId: documentId,
        clientId,
        action: "download",
        detail: doc.file_name,
      },
    });
    if (tab) tab.location.href = url;
    else window.location.href = url;
  };
}

export function MedsReadOnlyItem({ med, clientId }: { med: ReadOnlyMedView; clientId: string }) {
  const openDocument = useOpenClientDocument(clientId);
  return (
    <li
      className="space-y-2 rounded-xl border border-border bg-card p-3"
      data-testid="staff-med-item"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-base font-semibold text-foreground">{med.title}</p>
          {med.subtitle ? <p className="text-xs text-muted-foreground">{med.subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {med.isPrn ? <Badge variant="outline">As needed</Badge> : null}
          {med.isRescue ? <Badge className="bg-rose-600 text-white">Rescue</Badge> : null}
          {med.countRequired ? (
            <Badge className="bg-amber-600 text-white">Count required</Badge>
          ) : null}
          {med.swallowingRisk ? (
            <Badge className="bg-rose-600 text-white">
              <AlertTriangle className="mr-1 h-3 w-3" /> Swallowing risk
            </Badge>
          ) : null}
        </div>
      </div>
      <Lines lines={med.lines} />
      <Box title="Signs of a bad reaction">
        {med.badReaction ? (
          <p className="whitespace-pre-wrap text-sm text-foreground">{med.badReaction}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">{med.anyMedBadReaction}</p>
      </Box>
      {med.prn ? (
        <Box title="As-needed rules">
          {med.prn.length ? (
            <Lines lines={med.prn} />
          ) : (
            <p className="text-sm text-muted-foreground">No rules on file. Ask your supervisor.</p>
          )}
        </Box>
      ) : null}
      {med.psychotropic ? (
        <Box title="Psychotropic">
          <Lines lines={med.psychotropic} />
          {med.bspDocumentId ? (
            <button
              type="button"
              onClick={() => void openDocument(med.bspDocumentId as string)}
              className="mt-1 inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-sky-700 hover:underline"
            >
              <FileText className="h-4 w-4" /> Behavior support plan
            </button>
          ) : med.usedForBehavior ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Behavior support plan: not linked yet. Ask your supervisor.
            </p>
          ) : null}
        </Box>
      ) : null}
    </li>
  );
}
