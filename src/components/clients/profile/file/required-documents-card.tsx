// Every document the client's file needs, with status, due / expiry date
// and the file on record. Upload, replace or archive here (never delete);
// items kept elsewhere (photo, PCSP, summaries…) link to their section.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, FileCheck2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import { CLIENT_SECTION_LABEL, isClientProfileSection } from "@/lib/clients/profile-sections";
import { formatDate } from "@/lib/clients/dates";
import { clientFileStatusLabel, type ClientFileStatus } from "@/lib/clients/file";
import type { RequiredDocRow } from "@/lib/clients/file-required";
import { listClientRequiredDocuments } from "@/lib/clients/file.functions";
import { archiveClientFileDocument } from "@/lib/clients/file-documents.functions";
import { DocumentUploadDialog } from "./document-upload-dialog";

const requiredDocsKey = (clientId: string) => ["client-required-docs", clientId] as const;

const TONE: Record<ClientFileStatus, "ok" | "profile" | "danger"> = {
  on_file: "ok",
  due_soon: "profile",
  missing: "danger",
};

/** "Open Plans" for a link to another profile section. */
function openLabel(href: string): string {
  const section = new URLSearchParams(href.split("?")[1] ?? "").get("section");
  return isClientProfileSection(section) ? `Open ${CLIENT_SECTION_LABEL[section]}` : "Open record";
}

async function openFile(path: string) {
  const { data, error } = await supabase.storage
    .from("client-documents")
    .createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return toast.error(error?.message ?? "Couldn't open the file.");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export function RequiredDocumentsCard({
  orgId,
  clientId,
  canEdit,
}: {
  orgId: string;
  clientId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listClientRequiredDocuments);
  const archiveFn = useServerFn(archiveClientFileDocument);
  const [uploading, setUploading] = useState<RequiredDocRow | null>(null);
  const q = useQuery({
    queryKey: requiredDocsKey(clientId),
    enabled: !!orgId,
    queryFn: () => listFn({ data: { organizationId: orgId, clientId } }),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: requiredDocsKey(clientId) });
    void qc.invalidateQueries({ queryKey: ["client-docs"] });
    void qc.invalidateQueries({ queryKey: ["client-overview"] });
  };

  async function archive(row: RequiredDocRow) {
    if (
      !row.current?.id ||
      !confirm(
        `Archive "${row.current.file_name ?? row.label}"? It stays in the record but no longer counts.`,
      )
    )
      return;
    try {
      await archiveFn({ data: { organizationId: orgId, clientId, id: row.current.id } });
      toast.success("Archived");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't archive the document.");
    }
  }

  return (
    <SectionCard
      icon={FileCheck2}
      tone="info"
      title="Required documents"
      description="Every document the client file needs, with its status and due date."
      testId="client-required-documents"
    >
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : q.error ? (
        <p className="text-sm text-destructive">
          {q.error instanceof Error ? q.error.message : "Couldn't load the client file."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-2">Document</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1 pr-2">Expires / due</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((row) => (
                <tr key={row.key} className="border-t" data-testid="client-required-document">
                  <td className="py-2 pr-2">
                    <p className="font-medium">{row.label}</p>
                    {row.current?.file_name && (
                      <p className="text-xs text-muted-foreground">{row.current.file_name}</p>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <StatusTag tone={TONE[row.status]}>
                      {clientFileStatusLabel(row.status)}
                    </StatusTag>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-2 text-muted-foreground">
                    {formatDate(row.dueOn)}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {row.current?.storage_path && (
                        <Button
                          variant="outline"
                          onClick={() => void openFile(row.current!.storage_path!)}
                        >
                          <Eye className="h-4 w-4" />
                          Open file
                        </Button>
                      )}
                      {row.docType && canEdit && (
                        <Button variant="outline" onClick={() => setUploading(row)}>
                          <Upload className="h-4 w-4" />
                          {row.current ? "Replace file" : "Upload file"}
                        </Button>
                      )}
                      {row.href && (
                        <Button variant="outline" asChild>
                          <a href={row.href}>{openLabel(row.href)}</a>
                        </Button>
                      )}
                      {row.docType && canEdit && row.current?.id ? (
                        <RowMenu
                          label={`More actions for ${row.label}`}
                          items={[
                            {
                              label: "Archive document",
                              danger: true,
                              onSelect: () => void archive(row),
                            },
                          ]}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {uploading && (
        <DocumentUploadDialog
          orgId={orgId}
          clientId={clientId}
          row={uploading}
          onClose={() => setUploading(null)}
          onSaved={refresh}
        />
      )}
    </SectionCard>
  );
}
