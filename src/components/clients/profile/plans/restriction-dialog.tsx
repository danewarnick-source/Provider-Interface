// The one editor for a rights restriction (HRR), top to bottom:
//   1. upload the signed or draft HRR document — Nectar reads it and fills
//      the blank answers it can match to the document (marked for checking);
//   2. the questions the contract requires (hrc.ts HRR_QUESTIONS);
//   3. informed consent, typed by the client or their guardian;
//   4. signatures: provider admin, support coordinator, Human Rights Committee.
// Changing the answers after signing clears the signatures (warned before Save).
// Opened from the client's Plans section; the HRC page opens it read-only.

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAccess } from "@/hooks/use-access";
import { useOrgDisplayName } from "@/hooks/use-org";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAllClientContacts } from "@/components/clients/shared/hooks/use-client-contacts";
import { guardianStatus } from "@/lib/clients/guardian";
import { primaryContact } from "@/lib/clients/contacts";
import { clientUploadFolder } from "@/lib/clients/document-review";
import {
  CONSENT_CHECKBOX,
  HRR_FIELDS,
  HRR_QUESTIONS,
  HRR_STATUS_LABEL,
  SC_METHODS,
  consentNameWarning,
  consentSigner,
  consentStatement,
  hrrSignatures,
  hrrStatus,
  hrrStatusDetail,
  missingQuestions,
  remainingNectarFields,
  signaturesClearedBy,
  type HrrField,
  type RestrictionRecord,
} from "@/lib/clients/hrc";
import { hrrPdfFilename, renderHrrPdf } from "@/lib/clients/hrr-pdf";
import { attachHrrDocument, draftHrrFromDocument, saveHrr } from "@/lib/clients/hrr.functions";
import {
  clientRestrictionsKey,
  hrcDocumentsKey,
  openClientDocument,
  useHrcDocuments,
  usePeopleNames,
} from "./use-hrr";

type Answers = Record<HrrField, string>;

const MAX_UPLOAD = 15 * 1024 * 1024;
const when = (v: string | null) => (v ? new Date(v).toLocaleString() : "");

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border border-border p-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Stamp({ text }: { text: string | null }) {
  return text ? <p className="text-xs text-emerald-700">{text}</p> : null;
}

export function RestrictionDialog({
  record,
  clientName,
  canManage,
  orgId,
  onClose,
}: {
  record: RestrictionRecord;
  clientName: string;
  canManage: boolean;
  orgId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const clientId = record.client_id;
  const { user } = useAuth();
  const access = useAccess();
  const canSign = canManage && access.canCategory("clients", "edit");
  const provider = useOrgDisplayName().displayName;
  const attachFn = useServerFn(attachHrrDocument);
  const draftFn = useServerFn(draftHrrFromDocument);
  const saveFn = useServerFn(saveHrr);
  const fileRef = useRef<HTMLInputElement>(null);

  const ownGuardian = useQuery({
    queryKey: ["client-own-guardian", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("is_own_guardian").eq("id", clientId).maybeSingle();
      if (error) throw error;
      return data?.is_own_guardian ?? null;
    },
  });
  const contacts = useAllClientContacts(clientId);
  const docs = useHrcDocuments(orgId, clientId);
  const people = usePeopleNames([
    user?.id,
    record.consent_by,
    record.admin_signed_by,
    record.sc_recorded_by,
    record.hrc_recorded_by,
  ]);
  const signer = consentSigner(guardianStatus(ownGuardian.data, contacts.data ?? []), clientName);
  const sc = primaryContact(contacts.data ?? [], "support_coordinator");
  const myName = user?.id ? (people.data?.get(user.id) ?? "") : "";
  const doc = (docs.data ?? []).find((d) => d.id === record.document_id) ?? null;

  const [title, setTitle] = useState(record.restriction_title);
  const [active, setActive] = useState(record.active);
  const [answers, setAnswers] = useState<Answers>(() => {
    const a = {} as Answers;
    for (const f of HRR_FIELDS) a[f] = record[f] ?? "";
    return a;
  });
  const [marks, setMarks] = useState<Set<HrrField>>(() => new Set(remainingNectarFields(record.nectar_fields, [])));
  const [consentName, setConsentName] = useState(record.consent_signer_name ?? "");
  const [consentClient, setConsentClient] = useState(record.consent_client_name ?? "");
  const [agreed, setAgreed] = useState(!!record.consent_signer_name);
  const [adminName, setAdminName] = useState(record.admin_signer_name ?? "");
  const [attest, setAttest] = useState(!!record.admin_signer_name);
  const [scName, setScName] = useState(record.sc_name ?? "");
  const [scOn, setScOn] = useState(record.sc_signed_on ?? "");
  const [scMethod, setScMethod] = useState(record.sc_method ?? "");
  const [hrcDecision, setHrcDecision] = useState(record.hrc_decision ?? "");
  const [hrcOn, setHrcOn] = useState(record.hrc_decision_on ?? "");
  const [busy, setBusy] = useState<null | "upload" | "read" | "pdf">(null);

  // Prefill (still editable): the admin's name from their profile, the SC from contacts.
  useEffect(() => {
    if (!record.admin_signer_name && myName) setAdminName((v) => v || myName);
  }, [myName, record.admin_signer_name]);
  useEffect(() => {
    if (!record.sc_name && sc?.name) setScName((v) => v || sc.name);
  }, [sc?.name, record.sc_name]);

  const missing = missingQuestions(answers);
  const signingOpen = canSign && missing.length === 0;
  const nameWarning = agreed ? consentNameWarning(consentName, signer) : null;

  const setAnswer = (f: HrrField, v: string) => {
    setAnswers((a) => ({ ...a, [f]: v }));
    setMarks((m) => {
      if (!m.has(f)) return m;
      const next = new Set(m);
      next.delete(f);
      return next;
    });
  };
  const confirmMark = (f: HrrField) =>
    setMarks((m) => {
      const next = new Set(m);
      next.delete(f);
      return next;
    });

  const onUpload = async (file: File) => {
    if (file.size > MAX_UPLOAD) {
      toast.error("This file is over 15 MB. Upload a smaller copy.");
      return;
    }
    try {
      setBusy("upload");
      const safe = file.name.replace(/[^\w.-]+/g, "_");
      const path = `${clientUploadFolder(orgId, clientId, "hrc_approval")}${Date.now()}-${safe}`;
      const up = await supabase.storage
        .from("client-documents")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
      const scope = { organizationId: orgId, clientId, restrictionId: record.id };
      await attachFn({ data: { ...scope, fileName: file.name, storagePath: path } });
      void qc.invalidateQueries({ queryKey: hrcDocumentsKey(orgId, clientId) });
      void qc.invalidateQueries({ queryKey: clientRestrictionsKey(clientId) });
      setBusy("read");
      const res = await draftFn({ data: scope });
      if (!res.readable) {
        toast.message(`${file.name} attached. Nectar couldn't read its text (a scan?). Fill the answers by hand.`);
        return;
      }
      const applied: HrrField[] = [];
      setAnswers((a) => {
        const next = { ...a };
        for (const f of res.filled) {
          if (!next[f]?.trim() && res.values[f]) {
            next[f] = res.values[f] as string;
            applied.push(f);
          }
        }
        return next;
      });
      setMarks((m) => new Set([...m, ...applied]));
      const dropped = res.dropped.length
        ? ` ${res.dropped.length} left blank because they didn't match the document.`
        : "";
      toast.success(
        applied.length
          ? `${file.name} attached. Nectar filled ${applied.length} answer${applied.length === 1 ? "" : "s"} — check each one.${dropped}`
          : `${file.name} attached. Nectar found nothing new to fill.${dropped}`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const patch = useMemo(() => {
    const clean = (v: string) => v.trim() || null;
    const consent = agreed ? clean(consentName) : null;
    const scSigned = scOn ? clean(scName) : null;
    const cur: Record<string, unknown> = {
      restriction_title: title.trim(),
      active,
      nectar_fields: [...marks].sort(),
      consent_signer_name: consent,
      consent_signer_role: consent ? signer.role : null,
      consent_client_name: consent && signer.role === "guardian" ? clean(consentClient) : null,
      admin_signer_name: attest ? clean(adminName) : null,
      sc_name: scSigned,
      sc_signed_on: scSigned ? scOn : null,
      sc_method: scSigned ? scMethod || null : null,
      hrc_decision: hrcDecision || null,
      hrc_decision_on: hrcDecision ? hrcOn || null : null,
    };
    for (const f of HRR_FIELDS) cur[f] = clean(answers[f]);
    const before = record as unknown as Record<string, unknown>;
    const changed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(cur)) {
      const was = k === "nectar_fields" ? [...(record.nectar_fields ?? [])].sort() : (before[k] ?? null);
      if (JSON.stringify(was) !== JSON.stringify(v)) changed[k] = v;
    }
    return changed;
  }, [title, active, marks, agreed, consentName, consentClient, signer.role, attest, adminName, scName, scOn, scMethod, hrcDecision, hrcOn, answers, record]);

  // Signatures this save would clear because the answers changed (hrc.ts).
  const clearing = useMemo(() => {
    const keys = signaturesClearedBy(record, patch);
    return hrrSignatures(record)
      .filter((s) => keys.includes(s.key))
      .map((s) => s.label);
  }, [record, patch]);

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Give the restriction a title.");
      if (!agreed && consentName.trim() && consentName.trim() !== (record.consent_signer_name ?? ""))
        throw new Error("Tick the consent box, or clear the name.");
      const typedAdmin = adminName.trim();
      if (!attest && typedAdmin && typedAdmin !== myName && typedAdmin !== (record.admin_signer_name ?? ""))
        throw new Error("Tick the box to sign as provider admin, or clear the name.");
      return saveFn({ data: { organizationId: orgId, clientId, restrictionId: record.id, patch } });
    },
    onSuccess: (res) => {
      toast.success(
        res.cleared.length
          ? "Rights restriction saved. The answers changed, so everyone needs to sign again."
          : "Rights restriction saved",
      );
      void qc.invalidateQueries({ queryKey: ["hrc-restrictions", orgId] });
      void qc.invalidateQueries({ queryKey: clientRestrictionsKey(clientId) });
      void qc.invalidateQueries({ queryKey: ["client-overview"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pdf = async (mode: "view" | "download") => {
    try {
      setBusy("pdf");
      const bytes = await renderHrrPdf(record, { provider, client: clientName, people: people.data ?? new Map() });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      if (mode === "view") window.open(url, "_blank", "noopener,noreferrer");
      else {
        const a = document.createElement("a");
        a.href = url;
        a.download = hrrPdfFilename(record, clientName);
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const savedStatus = hrrStatus(record);
  const who = (id: string | null) => (id ? (people.data?.get(id) ?? "a team member") : "someone");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {record.restriction_title} — {clientName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium">{HRR_STATUS_LABEL[savedStatus]}</span>
          <span className="text-right text-xs text-muted-foreground">{hrrStatusDetail(record)}</span>
        </div>

        <div className="space-y-4" data-testid="hrr-editor">
          <Section title="Upload the signed or draft HRR document" note="Nectar reads it and fills the answers it finds. Check each one.">
            {doc ? (
              <button
                type="button"
                className="flex items-center gap-1.5 text-left text-sm text-primary underline"
                onClick={() => void openClientDocument(doc.storage_path)}
              >
                <FileText className="h-4 w-4 shrink-0" /> {doc.file_name}
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">No document yet.</p>
            )}
            {canManage ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUpload(f);
                  }}
                />
                <Button variant="outline" size="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
                  {busy === "upload" || busy === "read" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {busy === "read" ? "Nectar is reading…" : doc ? "Replace document" : "Upload document"}
                </Button>
              </>
            ) : null}
          </Section>

          <div className="space-y-1">
            <Label htmlFor="hrr-title" className="text-sm">Title</Label>
            <Input id="hrr-title" disabled={!canManage} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {HRR_QUESTIONS.map((q) => {
            const marked = marks.has(q.field) || (q.date ? marks.has(q.date.field) : false);
            return (
              <div key={q.field} className="space-y-2 rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">
                    {q.label}
                    {q.required ? "" : " (optional)"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {q.help}
                    {q.cite ? ` ${q.cite}.` : ""}
                  </div>
                </div>
                {marked ? (
                  <div className="flex items-center justify-between gap-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Filled by Nectar — check this
                    </span>
                    {canManage ? (
                      <button
                        type="button"
                        className="font-medium underline"
                        onClick={() => {
                          confirmMark(q.field);
                          if (q.date) confirmMark(q.date.field);
                        }}
                      >
                        Looks right
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <Textarea
                  disabled={!canManage}
                  rows={2}
                  value={answers[q.field]}
                  onChange={(e) => setAnswer(q.field, e.target.value)}
                />
                {q.date ? (
                  <div className="max-w-[220px] space-y-1">
                    <Label className="text-xs">{q.date.label}</Label>
                    <Input
                      disabled={!canManage}
                      type="date"
                      value={answers[q.date.field]}
                      onChange={(e) => setAnswer(q.date!.field, e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}

          {canManage ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
              Restriction still active
            </label>
          ) : null}

          {canSign && missing.length ? (
            <p className="text-sm text-muted-foreground">Answer every question before anyone signs.</p>
          ) : null}

          <Section title="Informed consent" note="SOW 1.20(b)(7).">
            <p className="text-sm">{consentStatement(clientName)}</p>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                disabled={!signingOpen}
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
              />
              {CONSENT_CHECKBOX}
            </label>
            <div className="space-y-1">
              <Label className="text-xs">{signer.label}</Label>
              <Input
                disabled={!signingOpen}
                value={consentName}
                placeholder={signer.expectedName ?? "Full name"}
                onChange={(e) => setConsentName(e.target.value)}
              />
              {nameWarning ? <p className="text-xs text-amber-700">{nameWarning}</p> : null}
              {signer.role === "guardian" && !signer.expectedName ? (
                <p className="text-xs text-amber-700">No guardian on file. Add one in Contacts.</p>
              ) : null}
            </div>
            {signer.role === "guardian" ? (
              <div className="space-y-1">
                <Label className="text-xs">Client's full name (optional, if they also sign)</Label>
                <Input disabled={!signingOpen} value={consentClient} onChange={(e) => setConsentClient(e.target.value)} />
              </div>
            ) : null}
            <Stamp
              text={record.consent_signer_name ? `Entered by ${who(record.consent_by)} on ${when(record.consent_at)}` : null}
            />
          </Section>

          <Section title="Signatures">
            <div className="space-y-2">
              <div className="text-sm font-medium">Provider admin</div>
              <Input disabled={!signingOpen} value={adminName} onChange={(e) => setAdminName(e.target.value)} />
              <label className="flex items-start gap-2 text-sm">
                <Checkbox className="mt-0.5" disabled={!signingOpen} checked={attest} onCheckedChange={(v) => setAttest(v === true)} />
                I reviewed this rights restriction and sign for {provider || "the provider"}.
              </label>
              <Stamp
                text={record.admin_signer_name ? `Signed by ${who(record.admin_signed_by)} on ${when(record.admin_signed_at)}` : null}
              />
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              <div className="text-sm font-medium">Support coordinator</div>
              <Input disabled={!signingOpen} value={scName} placeholder="Support coordinator's name" onChange={(e) => setScName(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Date they signed</Label>
                  <Input disabled={!signingOpen} type="date" value={scOn} onChange={(e) => setScOn(e.target.value)} />
                </div>
                <div className="min-w-[200px] space-y-1">
                  <Label className="text-xs">How it was obtained</Label>
                  <Select disabled={!signingOpen} value={scMethod} onValueChange={setScMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                    <SelectContent>
                      {SC_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {signingOpen && scName.trim() && !scOn ? (
                <p className="text-xs text-muted-foreground">Add the date they signed to record it.</p>
              ) : null}
              <Stamp
                text={record.sc_name ? `Recorded by ${who(record.sc_recorded_by)} on ${when(record.sc_recorded_at)}` : null}
              />
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              <div className="text-sm font-medium">Human Rights Committee</div>
              <p className="text-xs text-muted-foreground">The committee approves or denies each rights restriction. SOW 1.20(b).</p>
              <div className="flex flex-wrap gap-2">
                <div className="min-w-[200px] space-y-1">
                  <Label className="text-xs">Decision</Label>
                  <Select disabled={!signingOpen} value={hrcDecision} onValueChange={setHrcDecision}>
                    <SelectTrigger>
                      <SelectValue placeholder="Not decided yet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="denied">Denied</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Decision date</Label>
                  <Input disabled={!signingOpen || !hrcDecision} type="date" value={hrcOn} onChange={(e) => setHrcOn(e.target.value)} />
                </div>
              </div>
              <Stamp
                text={record.hrc_decision ? `Recorded by ${who(record.hrc_recorded_by)} on ${when(record.hrc_recorded_at)}` : null}
              />
            </div>
          </Section>
        </div>

        {canManage && clearing.length ? (
          <p
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
            data-testid="hrr-signatures-clearing"
          >
            You changed the answers after signing. Saving clears these signatures, and they must be
            given again: {clearing.join(", ")}.
          </p>
        ) : null}
        <DialogFooter className="flex-wrap gap-2">
          {savedStatus === "signed" ? (
            <>
              <Button variant="outline" disabled={!!busy} onClick={() => void pdf("view")}>
                <Eye className="h-4 w-4" /> View PDF
              </Button>
              <Button variant="outline" disabled={!!busy} onClick={() => void pdf("download")}>
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canManage ? (
            <Button disabled={save.isPending || !!busy || !Object.keys(patch).length} onClick={() => save.mutate()}>
              Save
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
