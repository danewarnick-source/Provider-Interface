import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg, useOrgDisplayName } from "@/hooks/use-org";
import { EvidenceDueFields } from "@/components/evidence/evidence-due-fields.tsx";
import { EvidenceRoster } from "@/components/evidence/evidence-roster.tsx";
import { EvidenceStatusChip } from "@/components/evidence/evidence-status-chip.tsx";
import { EvidenceSubjectCards } from "@/components/evidence/evidence-subject-cards.tsx";
import { parseServiceCodeFlags } from "@/lib/evidence/catalog.ts";
import { denverYmd } from "@/lib/denver-date.ts";
import {
  draftFromItem,
  dueSubtitleFromItem,
  type EvidenceDueDraft,
} from "@/lib/evidence/due.ts";
import {
  applyEvidenceRequirements,
  createEvidenceChecklist,
  linkHostHomeEvidence,
  loadEvidenceBoard,
  recordEvidenceAttestation,
  recordEvidenceUpload,
  removeEvidenceRequirement,
  sendEvidenceToStaff,
  updateEvidenceDue,
  upsertEvidenceRequirement,
  type EvidenceBoard,
} from "@/lib/evidence.functions";
import { leaveEvidenceWizard, type EvidenceStep } from "@/lib/evidence/nav.ts";
import { fetchEvidenceClientPeople } from "@/lib/evidence/fetch-clients.ts";
import { fetchEvidenceEmployees } from "@/lib/evidence/fetch-employees.ts";
import {
  companyEvidencePerson,
  itemsForEvidenceTab,
  peopleForEvidenceTab,
} from "@/lib/evidence/people.ts";
import { formatExpiresOn, latestFileForItem, matrixChip } from "@/lib/evidence/status.ts";
import {
  EVIDENCE_SEND_MESSAGE_UNAVAILABLE,
  EVIDENCE_STORAGE_UNAVAILABLE,
  type EvidencePerson,
  type EvidenceSubject,
  type EvidenceType,
} from "@/lib/evidence/types.ts";
import { EvidenceQuestionnaire } from "./evidence-questionnaire";
import { SendEvidenceDialog, type SendEvidenceDraft } from "./send-evidence-dialog";

type Props = {
  tab: EvidenceSubject;
  step: EvidenceStep;
  personId?: string;
  itemId?: string;
  onSearchChange: (next: {
    tab?: EvidenceSubject;
    step?: EvidenceStep;
    person?: string | null;
    item?: string | null;
  }) => void;
};

export function EvidenceWorkspace({ tab, step, personId, itemId, onSearchChange }: Props) {
  const { data: org, isLoading } = useCurrentOrg();
  const { displayName } = useOrgDisplayName();
  const qc = useQueryClient();
  const loadFn = useServerFn(loadEvidenceBoard);
  const applyFn = useServerFn(applyEvidenceRequirements);
  const customFn = useServerFn(upsertEvidenceRequirement);
  const formFn = useServerFn(createEvidenceChecklist);
  const removeFn = useServerFn(removeEvidenceRequirement);
  const sendFn = useServerFn(sendEvidenceToStaff);
  const uploadFn = useServerFn(recordEvidenceUpload);
  const attestFn = useServerFn(recordEvidenceAttestation);
  const dueFn = useServerFn(updateEvidenceDue);
  const linkFn = useServerFn(linkHostHomeEvidence);

  const orgId = org?.organization_id;
  const boardQ = useQuery({
    enabled: !!orgId,
    queryKey: ["evidence-board", orgId, tab],
    queryFn: () => loadFn({ data: { organizationId: orgId!, subject: tab } }),
  });
  const clientsQ = useQuery({
    enabled: !!orgId,
    queryKey: ["evidence-clients", orgId],
    queryFn: async (): Promise<EvidencePerson[]> => {
      const listed = await fetchEvidenceClientPeople(orgId!);
      if (listed.error) throw new Error(listed.error);
      return listed.people;
    },
  });
  const employeesQ = useQuery({
    enabled: !!orgId,
    queryKey: ["evidence-employees", orgId],
    queryFn: async (): Promise<EvidencePerson[]> => {
      const listed = await fetchEvidenceEmployees(orgId!);
      if (listed.error) throw new Error(listed.error);
      return listed.people;
    },
  });
  const companyPerson = orgId
    ? companyEvidencePerson(orgId, displayName || org?.organization_name || "Company")
    : null;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["evidence-board", orgId] });
    void qc.invalidateQueries({ queryKey: ["my-sent-evidence", orgId] });
  };

  const applyM = useMutation({
    mutationFn: (args: {
      subjectIds: string[];
      requirementKeys: string[];
      suggestedKeys: string[];
      packKeys: string[];
      typeOverrides?: Record<string, EvidenceType>;
      dueOverrides?: Record<string, EvidenceDueDraft>;
    }) =>
      applyFn({
        data: { organizationId: orgId!, subjectType: tab, ...args },
      }),
    onSuccess: (res) => {
      toast.success(`Applied ${res.count} row${res.count === 1 ? "" : "s"}.`);
      invalidate();
      onSearchChange({ tab, step: "grid", person: personId });
    },
    onError: (e: Error) =>
      toast.error(/feature_config/i.test(e.message) ? EVIDENCE_STORAGE_UNAVAILABLE : e.message),
  });
  const customM = useMutation({
    mutationFn: (args: {
      title: string;
      evidenceType: EvidenceType;
      attestationText: string | null;
      sowCite?: string | null;
      due: EvidenceDueDraft;
    }) => {
      const subjectIds = personId ? [personId] : tab === "company" && orgId ? [orgId] : [];
      if (subjectIds.length === 0) throw new Error("Open Add on a person to apply a pack.");
      return customFn({
        data: {
          organizationId: orgId!,
          subjectType: tab,
          subjectIds,
          title: args.title,
          evidenceType: args.evidenceType,
          attestationText: args.attestationText,
          sowCite: args.sowCite ?? null,
          due: args.due,
          hireDate: (employeesQ.data ?? []).find((p) => p.id === personId)?.hire_date ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Custom evidence added.");
      invalidate();
      onSearchChange({ tab, step: "grid", person: personId });
    },
    onError: (e: Error) =>
      toast.error(/feature_config/i.test(e.message) ? EVIDENCE_STORAGE_UNAVAILABLE : e.message),
  });
  const formM = useMutation({
    mutationFn: (args: {
      title: string;
      description: string;
      questions: string[];
      due: EvidenceDueDraft;
    }) => {
      const subjectIds = personId ? [personId] : tab === "company" && orgId ? [orgId] : [];
      if (subjectIds.length === 0) throw new Error("Open Add on a person to create a form.");
      return formFn({
        data: {
          organizationId: orgId!,
          subjectType: tab,
          subjectIds,
          title: args.title,
          description: args.description,
          questions: args.questions,
          due: args.due,
          hireDate: (employeesQ.data ?? []).find((p) => p.id === personId)?.hire_date ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Form created and added to this file.");
      invalidate();
      onSearchChange({ tab, step: "grid", person: personId });
    },
    onError: (e: Error) =>
      toast.error(/feature_config/i.test(e.message) ? EVIDENCE_STORAGE_UNAVAILABLE : e.message),
  });
  const removeM = useMutation({
    mutationFn: (id: string) => removeFn({ data: { organizationId: orgId!, itemId: id } }),
    onSuccess: () => {
      toast.success("Row removed.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [sendDraft, setSendDraft] = useState<SendEvidenceDraft | null>(null);
  const sendM = useMutation({
    mutationFn: (args: { itemIds: string[]; staffId?: string; message?: string }) =>
      sendFn({ data: { organizationId: orgId!, ...args } }),
    onSuccess: (res) => {
      setSendDraft(null);
      if (res && "messageSkipped" in res && res.messageSkipped) {
        toast.message(res.skipReason ?? EVIDENCE_SEND_MESSAGE_UNAVAILABLE);
      } else {
        toast.success("Sent to the employee.");
      }
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const uploadM = useMutation({
    mutationFn: (args: {
      itemId: string;
      storagePath: string;
      filename: string;
      expiresOn: string | null;
      documentDate?: string | null;
      nextDueOn?: string | null;
    }) => uploadFn({ data: { organizationId: orgId!, ...args } }),
    onSuccess: () => {
      toast.success("Upload recorded.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const attestM = useMutation({
    mutationFn: (args: {
      itemId: string;
      attestationText: string;
      documentDate?: string | null;
      nextDueOn?: string | null;
    }) => attestFn({ data: { organizationId: orgId!, ...args } }),
    onSuccess: () => {
      toast.success("Attestation recorded.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const dueM = useMutation({
    mutationFn: (args: {
      itemId: string;
      due: EvidenceDueDraft;
      hireDate?: string | null;
      documentDate?: string | null;
      hasFile?: boolean;
    }) => dueFn({ data: { organizationId: orgId!, ...args } }),
    onSuccess: () => {
      toast.success("Due dates saved.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const linkM = useMutation({
    mutationFn: (args: { itemId: string; peerSubjectId: string }) =>
      linkFn({ data: { organizationId: orgId!, ...args } }),
    onSuccess: () => {
      toast.success("Host Home Certification dual-linked.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const board = boardQ.data;
  const clientPeople = clientsQ.data ?? [];
  const employeePeople = employeesQ.data ?? [];
  const people = peopleForEvidenceTab({
    tab,
    employees: employeePeople,
    clients: clientPeople,
    company: companyPerson,
  });
  const rosterItems = itemsForEvidenceTab(board?.items ?? [], tab, people);
  const person =
    people.find((p) => p.id === personId) ??
    (companyPerson?.id === personId ? companyPerson : null) ??
    employeePeople.find((p) => p.id === personId) ??
    clientPeople.find((p) => p.id === personId) ??
    board?.people.find((p) => p.id === personId) ??
    board?.staffPicker.find((p) => p.id === personId) ??
    null;
  const activeItem =
    board?.items.find((i) => i.id === itemId) ??
    (person ? board?.items.find((i) => i.subject_id === person.id) : undefined) ??
    null;
  const peopleError =
    tab === "client"
      ? clientsQ.error instanceof Error
        ? clientsQ.error.message
        : null
      : tab === "staff"
        ? employeesQ.error instanceof Error
          ? employeesQ.error.message
          : null
        : null;
  const peopleLoading =
    tab === "client" ? clientsQ.isLoading : tab === "staff" ? employeesQ.isLoading : false;
  const showQuiz = step === "quiz";

  const openPackFor = (nextTab: EvidenceSubject, nextPerson: string) => {
    onSearchChange({ tab: nextTab, step: "quiz", person: nextPerson, item: null });
  };

  const closeWizard = () => {
    const next = leaveEvidenceWizard(tab);
    onSearchChange({
      tab: (next.tab as EvidenceSubject) ?? tab,
      step: "grid",
      person: null,
      item: null,
    });
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!org) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Select an organization to open Evidence.
      </div>
    );
  }

  const initialCodes = person?.subtitle ? parseServiceCodeFlags(person.subtitle.split(/,\s*/)) : [];

  const companyLabel =
    (org.display_acronym ?? "").trim() || companyPerson?.initials || "Company";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--hive-text)]">Evidence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Records & renewals. Your people. Your selected records. One place.
        </p>
      </header>

      <EvidenceSubjectCards
        tab={tab}
        employeeCount={employeePeople.length}
        clientCount={clientPeople.length}
        companyLabel={companyLabel}
        companyHint="OL licenses · policies"
        onSelect={(next) => onSearchChange({ tab: next, step: "grid", person: null, item: null })}
      />

      {step === "review" ? (
        <ReviewPanel
          board={board}
          itemId={activeItem?.id ?? null}
          orgId={org.organization_id}
          staffPicker={board?.staffPicker ?? []}
          onClose={() => onSearchChange({ tab, step: "grid", person: personId })}
          onUpload={(payload) => uploadM.mutate(payload)}
          onAttest={(args) => {
            if (!activeItem) return;
            attestM.mutate({ itemId: activeItem.id, ...args });
          }}
          onSaveDue={(args) => dueM.mutate(args)}
          onSend={(draft) => setSendDraft(draft)}
          onRemove={(id) => removeM.mutate(id)}
          onLink={(item, peer) => linkM.mutate({ itemId: item, peerSubjectId: peer })}
          pending={
            uploadM.isPending ||
            attestM.isPending ||
            dueM.isPending ||
            sendM.isPending ||
            removeM.isPending ||
            linkM.isPending
          }
        />
      ) : (
        <RosterPanel
          items={rosterItems}
          files={board?.files ?? []}
          people={people}
          peopleError={peopleError}
          tab={tab}
          loading={peopleLoading || boardQ.isLoading}
          selectedId={step === "grid" ? personId : undefined}
          onTogglePerson={(id) =>
            onSearchChange({
              tab,
              step: "grid",
              person: personId === id ? null : id,
              item: null,
            })
          }
          onAddForPerson={(id) => openPackFor(tab, id)}
          onReview={(id, item) => onSearchChange({ tab, step: "review", person: id, item })}
          onSend={(draft) => setSendDraft(draft)}
        />
      )}

      {showQuiz ? (
        <EvidenceQuestionnaire
          subject={tab}
          personName={
            person?.full_name ??
            (tab === "company"
              ? (companyPerson?.full_name ?? "Company")
              : tab === "client"
                ? "Client"
                : "Employee")
          }
          hireDate={person?.hire_date ?? null}
          initialCodes={initialCodes}
          onClose={closeWizard}
          onApply={(args) => {
            const subjectIds = personId
              ? [personId]
              : tab === "company"
                ? [org.organization_id]
                : [];
            if (subjectIds.length === 0) {
              toast.error("Open Add on a person to apply a pack.");
              return;
            }
            applyM.mutate({
              subjectIds,
              requirementKeys: args.requirementKeys,
              suggestedKeys: args.suggestedKeys,
              packKeys: args.packKeys,
              typeOverrides: args.typeOverrides,
              dueOverrides: args.dueOverrides,
            });
          }}
          onApplyCustom={(args) => customM.mutate(args)}
          onCreateForm={(args) => formM.mutate(args)}
          pending={applyM.isPending || customM.isPending || formM.isPending}
        />
      ) : null}

      <SendEvidenceDialog
        draft={sendDraft}
        staffPicker={board?.staffPicker ?? []}
        pending={sendM.isPending}
        onClose={() => setSendDraft(null)}
        onSend={(args) => sendM.mutate(args)}
      />
    </div>
  );
}

function RosterPanel({
  items,
  files,
  people: roster,
  peopleError,
  tab,
  loading,
  selectedId,
  onTogglePerson,
  onAddForPerson,
  onReview,
  onSend,
}: {
  items: EvidenceBoard["items"];
  files: EvidenceBoard["files"];
  people: EvidencePerson[];
  peopleError: string | null;
  tab: EvidenceSubject;
  loading: boolean;
  selectedId?: string;
  onTogglePerson: (id: string) => void;
  onAddForPerson: (id: string) => void;
  onReview: (personId: string, itemId: string) => void;
  onSend: (draft: SendEvidenceDraft) => void;
}) {
  const [q, setQ] = useState("");
  const people = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return roster;
    return roster.filter((p) => p.full_name.toLowerCase().includes(needle));
  }, [roster, q]);

  const emptyCopy = tab === "client" ? "No clients yet." : "No employees yet.";
  const listLabel = tab === "client" ? "clients" : tab === "company" ? "company" : "employees";
  const searchPlaceholder =
    tab === "client" ? "Search clients…" : tab === "company" ? "Search company…" : "Search employees…";

  return (
    <EvidenceRoster
      people={people}
      items={items}
      files={files}
      today={denverYmd()}
      search={q}
      onSearchChange={setQ}
      searchPlaceholder={searchPlaceholder}
      peopleError={peopleError}
      listLabel={listLabel}
      emptyCopy={tab === "company" ? "Company file is ready when packs are added." : emptyCopy}
      loading={loading}
      selectedId={selectedId}
      onTogglePerson={onTogglePerson}
      onAddForPerson={onAddForPerson}
      onReview={onReview}
      onSend={(person, itemIds, titles) =>
        onSend({
          itemIds,
          titles,
          staffId: tab === "staff" ? person.id : "",
          needsStaffPicker: tab !== "staff",
        })
      }
    />
  );
}

function ReviewPanel({
  board,
  itemId,
  orgId,
  staffPicker,
  onClose,
  onUpload,
  onAttest,
  onSaveDue,
  onSend,
  onRemove,
  onLink,
  pending,
}: {
  board: EvidenceBoard | undefined;
  itemId: string | null;
  orgId: string;
  staffPicker: EvidenceBoard["staffPicker"];
  onClose: () => void;
  onUpload: (payload: {
    itemId: string;
    storagePath: string;
    filename: string;
    expiresOn: string | null;
    documentDate?: string | null;
    nextDueOn?: string | null;
  }) => void;
  onAttest: (args: {
    attestationText: string;
    documentDate?: string | null;
    nextDueOn?: string | null;
  }) => void;
  onSaveDue: (args: {
    itemId: string;
    due: EvidenceDueDraft;
    hireDate?: string | null;
    documentDate?: string | null;
    hasFile?: boolean;
  }) => void;
  onSend: (draft: SendEvidenceDraft) => void;
  onRemove: (itemId: string) => void;
  onLink: (itemId: string, peerSubjectId: string) => void;
  pending: boolean;
}) {
  const item = board?.items.find((i) => i.id === itemId) ?? null;
  const file = item ? latestFileForItem(board?.files ?? [], item.id) : null;
  const person = board?.people.find((p) => p.id === item?.subject_id);
  const chip = item
    ? matrixChip({ item, file, today: denverYmd() })
    : { kind: "na" as const, label: "N/A", itemId: null };
  const [peerId, setPeerId] = useState("");
  const [due, setDue] = useState<EvidenceDueDraft | null>(item ? draftFromItem(item) : null);
  const [documentDate, setDocumentDate] = useState(item?.document_date ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!item) {
      setDue(null);
      setDocumentDate("");
      return;
    }
    setDue(draftFromItem(item));
    setDocumentDate(item.document_date ?? "");
  }, [item?.id]);

  const openPreview = async () => {
    if (!file?.storage_path) return;
    const { data, error } = await supabase.storage
      .from("evidence-files")
      .createSignedUrl(file.storage_path, 300);
    if (error || !data?.signedUrl) {
      toast.error(
        error?.message ?? "Could not open file. Apply the Evidence SQL handoff for the bucket.",
      );
      return;
    }
    setPreview(data.signedUrl);
  };

  if (!item) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Pick a requirement to review.{" "}
        <Button type="button" variant="outline" size="sm" className="ml-2" onClick={onClose}>
          Back to Evidence
        </Button>
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-[260px_1fr]">
      <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-semibold">{person?.full_name ?? "Person"}</p>
        <p className="text-xs text-muted-foreground">{item.title}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          {item.evidence_type === "attestation" ? "Attestation" : "Upload"} ·{" "}
          {dueSubtitleFromItem(item)}
        </p>
        <div className="mt-3">
          <EvidenceStatusChip
            chip={chip}
            ariaLabel={`${item.title}, ${chip.label}`}
          />
        </div>
        {item.next_due_on || item.first_due_on ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {file && item.next_due_on
              ? `Next due ${formatExpiresOn(item.next_due_on)}`
              : item.first_due_on
                ? `First due ${formatExpiresOn(item.first_due_on)}`
                : null}
          </p>
        ) : null}
        <div className="mt-4 grid gap-2">
          <label className="block">
            <span className="sr-only">Replace file</span>
            <Input
              type="file"
              onChange={async (e) => {
                const picked = e.target.files?.[0];
                if (!picked) return;
                const safe = picked.name.replace(/[^\w.-]+/g, "_");
                const path = `${orgId}/${item.id}/${Date.now()}-${safe}`;
                const up = await supabase.storage
                  .from("evidence-files")
                  .upload(path, picked, { upsert: true });
                if (up.error) {
                  toast.error(up.error.message);
                  return;
                }
                onUpload({
                  itemId: item.id,
                  storagePath: path,
                  filename: picked.name,
                  expiresOn: due?.nextDueOn ?? item.next_due_on,
                  documentDate: documentDate || null,
                  nextDueOn: due?.nextDueOn ?? null,
                });
              }}
            />
          </label>
          {file?.storage_path ? (
            <Button type="button" variant="outline" onClick={() => void openPreview()}>
              Preview
            </Button>
          ) : null}
          {item.evidence_type === "attestation" ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                onAttest({
                  attestationText:
                    item.attestation_text || `I attest that ${item.title} is complete.`,
                  documentDate: documentDate || null,
                  nextDueOn: due?.nextDueOn ?? null,
                })
              }
            >
              Mark attested
            </Button>
          ) : null}
          {due ? (
            <EvidenceDueFields
              subject={item.subject_type}
              hireDate={person?.hire_date}
              value={due}
              onChange={setDue}
              showDocumentDate={due.nextDueMode === "years"}
              documentDate={documentDate}
              onDocumentDateChange={setDocumentDate}
            />
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={pending || !due}
            onClick={() =>
              due
                ? onSaveDue({
                    itemId: item.id,
                    due,
                    hireDate: person?.hire_date ?? null,
                    documentDate: documentDate || null,
                    hasFile: !!file,
                  })
                : undefined
            }
          >
            Save due dates
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              onSend({
                itemIds: [item.id],
                titles: [item.title],
                staffId: item.subject_type === "staff" ? item.subject_id : (staffPicker[0]?.id ?? ""),
                needsStaffPicker: item.subject_type !== "staff",
              })
            }
          >
            Send to employee
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onRemove(item.id)}
          >
            Remove
          </Button>
          {item.dual_link_key === "host_home_cert" && !item.dual_link_peer_id ? (
            <div className="grid gap-2 pt-1">
              <Input
                value={peerId}
                onChange={(e) => setPeerId(e.target.value)}
                placeholder={
                  item.subject_type === "staff"
                    ? "Client id to dual-link"
                    : "Employee id to dual-link"
                }
                className="h-9"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!peerId || pending}
                onClick={() => onLink(item.id, peerId.trim())}
              >
                Dual-link Host Home Cert
              </Button>
            </div>
          ) : null}
        </div>
      </aside>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{file?.filename ?? "No file yet."}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {preview ? (
          <iframe
            title="Evidence preview"
            src={preview}
            className="mt-4 h-[480px] w-full rounded-xl border"
          />
        ) : (
          <div className="mt-6 flex h-64 items-center justify-center rounded-xl bg-slate-50 text-sm text-muted-foreground">
            <FileText className="mr-2 h-4 w-4" />
            {file ? "Open preview to view the stored file." : "Nothing uploaded yet."}
          </div>
        )}
      </div>
    </section>
  );
}
