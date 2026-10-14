// "View & download document": after the support strategies are approved, a
// preview of the document for the support coordinator (agency, client, plan
// year, coordinator, approver, every goal → support with codes and strategy
// bullets) and a "Download PDF" button. Built by getSupportStrategiesDocument.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSupportStrategiesDocument } from "@/lib/clients/strategies-doc.functions";
import { NO_STRATEGY_TEXT, type StrategiesDoc } from "@/lib/clients/strategies-doc";

function downloadPdf(base64: string, filename: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function Preview({ doc }: { doc: StrategiesDoc }) {
  const facts: [string, string][] = [
    ["Client", doc.client],
    ["Service provider", doc.provider],
    ["PCSP plan year", doc.planYear],
    ["Support coordinator", doc.coordinator],
    ["Date prepared", doc.prepared],
    ["Approved", doc.approved],
  ];
  return (
    <div className="space-y-4 rounded-xl border border-hive-border bg-hive-surface p-4 text-sm">
      <div className="border-b border-hive-ink pb-2">
        <p className="text-xs font-medium text-muted-foreground">{doc.provider}</p>
        <p className="text-lg font-semibold text-hive-ink">{doc.title}</p>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {k}
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {doc.goals.map((g, i) => (
        <section key={`${g.goal}-${i}`} className="space-y-2 border-t border-hive-border pt-3">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Goal {i + 1}</p>
          <p className="font-semibold text-hive-ink">{g.goal}</p>
          {g.supports.map((s, j) => (
            <div key={j} className="space-y-1 pl-2">
              <p className="font-medium">{s.support}</p>
              {s.details ? (
                <p className="text-xs text-muted-foreground">Support details: {s.details}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Service codes: {s.codes.join(", ") || "None"}
              </p>
              {s.bullets.length ? (
                <ul className="list-disc space-y-0.5 pl-5">
                  {s.bullets.map((b, k) => (
                    <li key={k}>{b}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">{NO_STRATEGY_TEXT}</p>
              )}
            </div>
          ))}
        </section>
      ))}
      {doc.notNeeded.length ? (
        <section className="space-y-1 border-t border-hive-border pt-3">
          <p className="font-semibold text-hive-ink">Services without a separate strategy</p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            {doc.notNeeded.map((n, i) => (
              <li key={i}>
                {n.support || "Support"} ({n.codes.join(", ")}): {n.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="space-y-1 border-t border-hive-border pt-3 text-[11px] text-muted-foreground">
        {doc.footer.map((f, i) => (
          <p key={i}>{f}</p>
        ))}
      </div>
    </div>
  );
}

export function StrategiesDocumentButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const getDoc = useServerFn(getSupportStrategiesDocument);
  const q = useQuery({
    enabled: open,
    queryKey: ["support-strategies-document", clientId],
    queryFn: () => getDoc({ data: { clientId } }),
    staleTime: 0,
  });
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        data-testid="strategies-document-button"
      >
        <FileText className="h-4 w-4" />
        View &amp; download document
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle>Support strategies document</DialogTitle>
            <DialogDescription>
              For the support coordinator: every goal and support with its codes and approved
              strategies.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {q.isLoading ? (
              <p className="text-sm text-muted-foreground">
                <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />
                Building the document…
              </p>
            ) : q.error ? (
              <p className="text-sm text-hive-danger">{(q.error as Error).message}</p>
            ) : q.data ? (
              <Preview doc={q.data.doc} />
            ) : null}
          </div>
          <DialogFooter className="max-md:[&_button]:min-h-11">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              disabled={!q.data}
              onClick={() => q.data && downloadPdf(q.data.pdfBase64, q.data.filename)}
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
