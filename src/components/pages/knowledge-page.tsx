import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  FileText,
  Globe,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useCurrentOrg } from "@/hooks/use-org";
import { AuthoritativeSourceDrop } from "@/components/nectar/authoritative-source-drop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ingestDocument, deleteDocument, getDocument } from "@/lib/nectar-documents.functions";
import {
  listAuthoritativeSources,
  markAsAuthoritativeSource,
  ingestWebSource,
} from "@/lib/authoritative-sources.functions";

const DOC_KINDS = [
  { value: "state_sow", label: "Scope of Work" },
  { value: "provider_policy", label: "Policy / procedure" },
  { value: "provider_contract", label: "Contract" },
  { value: "other", label: "Other" },
] as const;

const KIND_LABEL: Record<string, string> = {
  state_sow: "Scope of Work",
  provider_policy: "Policy / procedure",
  provider_contract: "Contract",
  dspd_requirement: "DSPD document",
  dhs_requirement: "DHS document",
  public_record: "Public record",
  tool_template: "Tool / template",
  other: "Other",
};

type AuthKind = (typeof DOC_KINDS)[number]["value"];

type SourceRow = {
  id: string;
  title: string;
  authoritative_kind: string | null;
  fiscal_year: string | null;
  effective_start: string | null;
  effective_end: string | null;
  file_name: string;
  uploaded_by_name: string | null;
  created_at: string;
  parse_status: string | null;
  metadata?: Record<string, unknown> | null;
};

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function kindToDocType(kind: string): "sow" | "contract" | "other" {
  if (kind === "state_sow") return "sow";
  if (kind === "provider_contract") return "contract";
  return "other";
}

export function KnowledgePage() {
  const { data: org } = useCurrentOrg();
  const orgId = org?.organization_id;
  const qc = useQueryClient();

  const content = (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--hive-gold)]">
          <BookOpen className="h-3.5 w-3.5" />
          Knowledge
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--hive-text)]">
          Agency documents for Nectar
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Upload your Scope of Work, policies and procedures, or any documents
          the agency wants on file. Nectar ingests them into its knowledge base
          and uses them to answer questions and surface applicable information
          in Nectar search for staff and admins.
        </p>
      </header>

      {orgId ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <DocumentList orgId={orgId} />
          <div data-tour="authsources.upload">
            <UploadCard
              orgId={orgId}
              onUploaded={() => qc.invalidateQueries({ queryKey: ["auth-sources", orgId] })}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
          Loading…
        </div>
      )}
    </div>
  );

  if (!orgId) return content;
  return (
    <AuthoritativeSourceDrop
      orgId={orgId}
      onUploaded={() => qc.invalidateQueries({ queryKey: ["auth-sources", orgId] })}
    >
      {content}
    </AuthoritativeSourceDrop>
  );
}

function DocumentList({ orgId }: { orgId: string }) {
  const listFn = useServerFn(listAuthoritativeSources);
  const { data, isLoading } = useQuery({
    queryKey: ["auth-sources", orgId],
    queryFn: () => listFn({ data: { organizationId: orgId } }),
  });
  const sources = (data?.sources ?? []) as SourceRow[];

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-[var(--hive-text)]">
          Documents on file
        </h2>
        <Badge variant="outline" className="text-[10px]">
          {sources.length} document{sources.length === 1 ? "" : "s"}
        </Badge>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : sources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No documents yet. Upload a Scope of Work, policy, or any agency
          document to add it to Nectar&apos;s knowledge base.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {sources.map((source) => (
            <KnowledgeRow key={source.id} source={source} orgId={orgId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function KnowledgeRow({ source, orgId }: { source: SourceRow; orgId: string }) {
  const qc = useQueryClient();
  const deleteFn = useServerFn(deleteDocument);
  const getFn = useServerFn(getDocument);

  const del = useMutation({
    mutationFn: () => deleteFn({ data: { documentId: source.id } }),
    onSuccess: () => {
      toast.success("Document removed from the knowledge base.");
      qc.invalidateQueries({ queryKey: ["auth-sources", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = useMutation({
    mutationFn: () => getFn({ data: { documentId: source.id } }),
    onSuccess: (r) => {
      if (r?.signedUrl) {
        window.open(r.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }
      toast.error("Could not open this file.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-[var(--hive-gold)]" />
          <span className="min-w-0 break-words text-sm font-medium text-[var(--hive-text)]">
            {source.title}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {KIND_LABEL[source.authoritative_kind ?? "other"] ?? "Document"}
          </Badge>
          <ParseBadge
            status={source.parse_status}
            onRefresh={() => qc.invalidateQueries({ queryKey: ["auth-sources", orgId] })}
          />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="min-w-0 break-all">File: {source.file_name}</span>
          {source.fiscal_year && <span>{source.fiscal_year}</span>}
          <span>by {source.uploaded_by_name ?? "—"}</span>
          <span>{new Date(source.created_at).toLocaleDateString()}</span>
        </div>
        {source.parse_status === "failed" && (
          <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">
            {(source.metadata as { parse_error?: string } | null)?.parse_error ??
              "Parse failed. Re-upload the document to try again."}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={open.isPending}
          onClick={() => open.mutate()}
        >
          {open.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Open
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-destructive"
          disabled={del.isPending}
          onClick={() => {
            if (window.confirm(`Remove "${source.title}" from the knowledge base?`)) {
              del.mutate();
            }
          }}
        >
          {del.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </li>
  );
}

function ParseBadge({
  status,
  onRefresh,
}: {
  status: string | null;
  onRefresh: () => void;
}) {
  if (status === "parsed") {
    return (
      <Badge className="bg-emerald-500/15 text-[10px] text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300">
        In knowledge base
      </Badge>
    );
  }
  if (status === "parsing" || status === "pending") {
    return (
      <>
        <Badge className="bg-[var(--hive-gold)]/15 text-[10px] text-[var(--hive-gold)] hover:bg-[var(--hive-gold)]/15">
          Ingesting…
        </Badge>
        <button
          type="button"
          onClick={onRefresh}
          className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Refresh
        </button>
      </>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="bg-red-500/15 text-[10px] text-red-700 hover:bg-red-500/15 dark:text-red-300">
        Ingest failed
      </Badge>
    );
  }
  if (status === "skipped") {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        Ingest skipped
      </Badge>
    );
  }
  return status ? <Badge variant="outline" className="text-[10px]">{status}</Badge> : null;
}

function UploadCard({
  orgId,
  onUploaded,
}: {
  orgId: string;
  onUploaded: () => void;
}) {
  const [mode, setMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<AuthKind>("state_sow");
  const [fiscalYear, setFiscalYear] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  const ingest = useServerFn(ingestDocument);
  const mark = useServerFn(markAsAuthoritativeSource);
  const ingestUrl = useServerFn(ingestWebSource);

  const resetForm = () => {
    setFile(null);
    setUrl("");
    setTitle("");
    setFiscalYear("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file to upload");
      if (!title.trim()) throw new Error("Title is required");
      const base64 = await fileToBase64(file);
      const r = await ingest({
        data: {
          organizationId: orgId,
          ownerKind: "company",
          documentType: kindToDocType(kind),
          title: title.trim(),
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileBase64: base64,
          fiscalYear: fiscalYear || null,
          tags: ["authoritative-source", kind],
          autoParse: true,
        },
      });
      const doc = (r as { document?: { id?: string } }).document;
      if (!doc?.id) throw new Error("Upload failed");
      await mark({
        data: {
          documentId: doc.id,
          authoritativeKind: kind,
          isAuthoritative: true,
        },
      });
      return doc.id;
    },
    onSuccess: () => {
      toast.success("Uploaded. Nectar is adding this to the knowledge base.");
      resetForm();
      onUploaded();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const captureUrl = useMutation({
    mutationFn: async () => {
      if (!url.trim()) throw new Error("Paste a URL to capture");
      if (!title.trim()) throw new Error("Title is required");
      return ingestUrl({
        data: {
          organizationId: orgId,
          url: url.trim(),
          title: title.trim(),
          authoritativeKind: kind,
          fiscalYear: fiscalYear || null,
        },
      });
    },
    onSuccess: (r) => {
      toast.success(
        `Captured ${new URL(r.sourceUrl).host}. Nectar is adding this to the knowledge base.`,
      );
      resetForm();
      onUploaded();
    },
    onError: (e: Error) => toast.error(e.message, { duration: 9000 }),
  });

  const submitting = upload.isPending || captureUrl.isPending;
  const isUrlMode = mode === "url";

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-[var(--hive-text)]">
        <Upload className="h-4 w-4 text-[var(--hive-gold)]" /> Upload a document
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Scope of Work, policies, or any agency document. Nectar parses the file
        and adds it to search.
      </p>

      <div className="mb-3 inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`rounded-md px-3 py-1.5 transition ${
            mode === "file"
              ? "bg-[var(--hive-gold)] text-[var(--hive-on-gold)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="mr-1 inline h-3.5 w-3.5" /> File
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`rounded-md px-3 py-1.5 transition ${
            mode === "url"
              ? "bg-[var(--hive-gold)] text-[var(--hive-on-gold)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="mr-1 inline h-3.5 w-3.5" /> From URL
        </button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Document type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as AuthKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isUrlMode ? "e.g. Agency policy handbook" : "e.g. Scope of Work — FY26"}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Fiscal year (optional)</Label>
          <Input
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            placeholder="FY26"
          />
        </div>

        {isUrlMode ? (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Page URL</Label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
            <Button
              className="w-full bg-[var(--hive-gold)] text-[var(--hive-on-gold)] hover:bg-[#b8651a]"
              onClick={() => captureUrl.mutate()}
              disabled={submitting || !url.trim() || !title.trim()}
            >
              {captureUrl.isPending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Reading page…
                </>
              ) : (
                <>
                  <Globe className="mr-1 h-4 w-4" /> Add page
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">File (PDF or text)</Label>
              <Input
                ref={fileInput}
                type="file"
                accept=".pdf,.txt,.md,.html,.htm,application/pdf,text/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              className="w-full bg-[var(--hive-gold)] text-[var(--hive-on-gold)] hover:bg-[#b8651a]"
              onClick={() => upload.mutate()}
              disabled={submitting || !file}
            >
              {upload.isPending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-1 h-4 w-4" /> Upload
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
