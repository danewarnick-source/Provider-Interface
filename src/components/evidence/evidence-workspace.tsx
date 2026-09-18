import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, FileText, PenLine, Plus, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { cadenceLabel, packsForSubject, requirementByKey } from "@/lib/evidence/catalog.ts";
import {
  applyEvidenceRequirements,
  linkHostHomeEvidence,
  loadEvidenceBoard,
  recordEvidenceAttestation,
  recordEvidenceUpload,
  removeEvidenceRequirement,
  saveEvidenceTemplate,
  sendEvidenceToStaff,
  upsertEvidenceRequirement,
  type EvidenceBoard,
} from "@/lib/evidence.functions";
import { type EvidenceStep } from "@/lib/evidence/nav.ts";
import {
  cellStatus,
  formatExpiresOn,
  latestFileForItem,
  type EvidenceCellStatus,
} from "@/lib/evidence/status.ts";
import { fetchEvidenceClientPeople } from "@/lib/evidence/fetch-clients.ts";
import { skipGetStartedKey } from "@/lib/evidence/people.ts";
import {
  EVIDENCE_CADENCE_OPTIONS,
  type EvidenceCadence,
  type EvidencePerson,
  type EvidenceSubject,
  type EvidenceType,
} from "@/lib/evidence/types.ts";
import { EvidenceQuestionnaire } from "./evidence-questionnaire";
import { EvidenceStatusGlyph, EvidenceStatusLegend } from "./evidence-status-dot";

type Props = {
  tab: EvidenceSubject;
  step: EvidenceStep;
  personId?: string;
  itemId?: string;
  wizard?: boolean;
  onSearchChange: (next: {
    tab?: EvidenceSubject;
    step?: EvidenceStep;
    person?: string | null;
    item?: string | null;
    wizard?: boolean;
  }) => void;
};

export function EvidenceWorkspace({ tab, step, personId, itemId, wizard, onSearchChange }: Props) {
  const { data: org, isLoading } = useCurrentOrg();
  const qc = useQueryClient();
  const loadFn = useServerFn(loadEvidenceBoard);
  const applyFn = useServerFn(applyEvidenceRequirements);
  const upsertFn = useServerFn(upsertEvidenceRequirement);
  const removeFn = useServerFn(removeEvidenceRequirement);
  const saveTplFn = useServerFn(saveEvidenceTemplate);
  const sendFn = useServerFn(sendEvidenceToStaff);
  const uploadFn = useServerFn(recordEvidenceUpload);
  const attestFn = useServerFn(recordEvidenceAttestation);
  const linkFn = useServerFn(linkHostHomeEvidence);

  const orgId = org?.organization_id;
  const [skippedStart, setSkippedStart] = useState(false);
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

  useEffect(() => {
    if (!orgId || typeof window === "undefined") return;
    setSkippedStart(window.sessionStorage.getItem(skipGetStartedKey(orgId)) === "1");
  }, [orgId]);

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
    }) =>
      applyFn({
        data: { organizationId: orgId!, subjectType: tab, ...args },
      }),
    onSuccess: (res) => {
      toast.success(`Applied ${res.count} row${res.count === 1 ? "" : "s"}.`);
      invalidate();
      onSearchChange({ tab, step: "grid", person: personId });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const upsertM = useMutation({
    mutationFn: (args: {
      subjectIds: string[];
      title: string;
      evidenceType: EvidenceType;
      attestationText: string | null;
      cadence: EvidenceCadence;
      sowCite: string | null;
    }) => upsertFn({ data: { organizationId: orgId!, subjectType: tab, ...args } }),
    onSuccess: () => {
      toast.success("Requirement saved.");
      invalidate();
      onSearchChange({ tab, step: "grid", person: personId });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeM = useMutation({
    mutationFn: (id: string) => removeFn({ data: { organizationId: orgId!, itemId: id } }),
    onSuccess: () => {
      toast.success("Row removed.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveTplM = useMutation({
    mutationFn: (args: { name: string; packKeys: string[]; requirementKeys: string[] }) =>
      saveTplFn({ data: { organizationId: orgId!, subjectType: tab, ...args } }),
    onSuccess: () => toast.success("Template saved for future staff / clients."),
    onError: (e: Error) => toast.error(e.message),
  });
  const sendM = useMutation({
    mutationFn: (args: { itemIds: string[]; staffId?: string }) =>
      sendFn({ data: { organizationId: orgId!, ...args } }),
    onSuccess: () => {
      toast.success("Sent to staff phone. Notification has no client or clinical detail.");
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
    }) => uploadFn({ data: { organizationId: orgId!, ...args } }),
    onSuccess: () => {
      toast.success("Upload recorded.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const attestM = useMutation({
    mutationFn: (args: { itemId: string; attestationText: string }) =>
      attestFn({ data: { organizationId: orgId!, ...args } }),
    onSuccess: () => {
      toast.success("Attestation recorded.");
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
  const people =
    tab === "client"
      ? clientPeople.length > 0 || clientsQ.isSuccess || clientsQ.isError
        ? clientPeople
        : (board?.people ?? [])
      : (board?.people ?? []);
  const person =
    people.find((p) => p.id === personId) ??
    board?.people.find((p) => p.id === personId) ??
    board?.staffPicker.find((p) => p.id === personId) ??
    null;
  const activeItem =
    board?.items.find((i) => i.id === itemId) ??
    (person ? board?.items.find((i) => i.subject_id === person.id) : undefined) ??
    null;

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

  const showQuiz = step === "quiz" || wizard;
  const onGrid = !showQuiz && step === "grid";
  const peopleError =
    tab === "client"
      ? clientsQ.error instanceof Error
        ? clientsQ.error.message
        : (board?.peopleError ?? null)
      : (board?.peopleError ?? null);
  const orgItemCount = board?.orgItemCount ?? 0;
  const showGetStarted =
    onGrid && !!board && !boardQ.isLoading && orgItemCount === 0 && !skippedStart && !wizard;
  const peopleLoading =
    tab === "client" ? clientsQ.isLoading || boardQ.isLoading : boardQ.isLoading;

  const skipGetStarted = () => {
    if (orgId && typeof window !== "undefined") {
      window.sessionStorage.setItem(skipGetStartedKey(orgId), "1");
    }
    setSkippedStart(true);
    onSearchChange({ tab, step: "grid", wizard: false });
  };

  const openQuizFor = (nextTab: EvidenceSubject, nextPerson: string | null) => {
    onSearchChange({
      tab: nextTab,
      step: "quiz",
      person: nextPerson,
      wizard: true,
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--hive-text)]">Evidence</h1>
        {!onGrid ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSearchChange({ tab, step: "grid", person: personId, wizard: false })}
          >
            Back to Evidence
          </Button>
        ) : null}
      </header>

      {showGetStarted ? (
        <GetStartedPanel
          tab={tab}
          staff={board?.staffPicker ?? []}
          clients={clientPeople}
          clientsLoading={clientsQ.isLoading}
          clientsError={clientsQ.error instanceof Error ? clientsQ.error.message : null}
          companyId={org.organization_id}
          onOpenQuiz={openQuizFor}
          onSkip={skipGetStarted}
        />
      ) : showQuiz ? (
        <>
          {person ? (
            <p className="text-sm text-muted-foreground">
              Adding evidence for{" "}
              <span className="font-medium text-foreground">{person.full_name}</span>
            </p>
          ) : tab === "company" ? (
            <p className="text-sm text-muted-foreground">Adding company evidence</p>
          ) : null}
          <EvidenceQuestionnaire
            subject={tab}
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
              });
            }}
            onSaveTemplate={(args) =>
              saveTplM.mutate({
                name: args.name,
                packKeys: args.packKeys,
                requirementKeys: args.requirementKeys,
              })
            }
            pending={applyM.isPending || saveTplM.isPending}
          />
        </>
      ) : step === "pack" ? (
        <PackSettingsPanel
          board={board}
          tab={tab}
          onClose={() => onSearchChange({ tab, step: "grid", person: personId })}
          onRemove={(id) => removeM.mutate(id)}
          onAddCustom={() => onSearchChange({ tab, step: "newtype", person: personId })}
        />
      ) : step === "newtype" ? (
        <NewRequirementPanel
          tab={tab}
          people={tab === "company" ? [] : people}
          peopleLoading={peopleLoading}
          defaultSubjectIds={personId ? [personId] : tab === "company" ? [org.organization_id] : []}
          onCancel={() => onSearchChange({ tab, step: "grid", person: personId })}
          onSave={(payload) => upsertM.mutate(payload)}
          pending={upsertM.isPending}
        />
      ) : step === "review" ? (
        <ReviewPanel
          board={board}
          itemId={activeItem?.id ?? null}
          orgId={org.organization_id}
          onClose={() => onSearchChange({ tab, step: "grid", person: personId })}
          onUpload={(payload) => uploadM.mutate(payload)}
          onAttest={(text) => {
            if (!activeItem) return;
            attestM.mutate({ itemId: activeItem.id, attestationText: text });
          }}
          pending={uploadM.isPending || attestM.isPending}
        />
      ) : (
        <GridPanel
          board={board}
          people={people}
          peopleError={peopleError}
          tab={tab}
          loading={peopleLoading}
          orgItemCount={orgItemCount}
          onTabChange={(next) => onSearchChange({ tab: next, step: "grid" })}
          onOpenPerson={(id) => onSearchChange({ tab, step: "grid", person: id })}
          onOpenCell={(id, item) => onSearchChange({ tab, step: "review", person: id, item })}
          onAddForPerson={(id) => openQuizFor(tab === "company" ? "company" : tab, id)}
        />
      )}

      {step === "grid" && !showGetStarted && person ? (
        <PersonPackEditor
          board={board}
          person={person}
          personId={person.id}
          tab={tab}
          staffPicker={board?.staffPicker ?? []}
          onClose={() => onSearchChange({ tab, step: "grid" })}
          onQuiz={() => onSearchChange({ tab, step: "quiz", person: person.id, wizard: true })}
          onReview={(item) => onSearchChange({ tab, step: "review", person: person.id, item })}
          onRemove={(id) => removeM.mutate(id)}
          onSend={(ids, staffId) => sendM.mutate({ itemIds: ids, staffId })}
          onLink={(item, peer) => linkM.mutate({ itemId: item, peerSubjectId: peer })}
          pending={removeM.isPending || sendM.isPending || linkM.isPending}
        />
      ) : null}
    </div>
  );
}

function GridPanel({
  board,
  people: roster,
  peopleError,
  tab,
  loading,
  orgItemCount,
  onTabChange,
  onOpenPerson,
  onOpenCell,
  onAddForPerson,
}: {
  board: EvidenceBoard | undefined;
  people: EvidencePerson[];
  peopleError: string | null;
  tab: EvidenceSubject;
  loading: boolean;
  orgItemCount: number;
  onTabChange: (tab: EvidenceSubject) => void;
  onOpenPerson: (id: string) => void;
  onOpenCell: (personId: string, itemId: string | null) => void;
  onAddForPerson: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | EvidenceCellStatus>("all");
  const today = new Date().toISOString().slice(0, 10);
  const people = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return roster;
    return roster.filter((p) => p.full_name.toLowerCase().includes(needle));
  }, [roster, q]);

  const cellOf = (subjectId: string, requirementKey: string) => {
    const fromBoard = board?.cells.find(
      (c) => c.subjectId === subjectId && c.requirementKey === requirementKey,
    );
    if (fromBoard) return fromBoard;
    const found = board?.items.find(
      (i) => i.subject_id === subjectId && i.requirement_key === requirementKey,
    );
    if (!found) return undefined;
    const file = latestFileForItem(board?.files ?? [], found.id);
    return {
      subjectId,
      requirementKey,
      itemId: found.id,
      status: cellStatus({ item: found, file, today }),
      expiresOn: found.expires_on,
    };
  };

  const emptyCopy =
    tab === "client"
      ? "No clients yet."
      : tab === "company"
        ? "Company file is empty."
        : "No staff yet.";

  return (
    <section className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as EvidenceSubject)}>
        <TabsList className="h-auto">
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="client">Clients</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
        </TabsList>
      </Tabs>

      {orgItemCount === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            No evidence rows yet. Add a pack on a person to start tracking.
          </p>
          {tab === "company" && people[0] ? (
            <Button type="button" size="sm" onClick={() => onAddForPerson(people[0]!.id)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="h-9 pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">Status: all</option>
          <option value="done">Done</option>
          <option value="expiring">Expiring soon</option>
          <option value="missing">Missing</option>
        </select>
      </div>

      {peopleError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Could not load {tab === "client" ? "clients" : "people"}: {peopleError}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading Evidence…</div>
        ) : !people.length ? (
          <div className="p-8 text-sm text-muted-foreground">
            {peopleError ? `Could not load this list. ${peopleError}` : emptyCopy}
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                {(board?.columns ?? []).map((col) => (
                  <th key={col.requirementKey} className="px-3 py-3 text-center font-medium">
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-medium">
                  <span className="sr-only">Add evidence</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const visibleCols = (board?.columns ?? []).filter((col) => {
                  if (status === "all") return true;
                  return cellOf(person.id, col.requirementKey)?.status === status;
                });
                if (
                  status !== "all" &&
                  visibleCols.length === 0 &&
                  (board?.columns ?? []).length > 0
                ) {
                  return null;
                }
                return (
                  <tr key={person.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenPerson(person.id)}
                        className="flex items-center gap-3 text-left"
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                          {person.initials}
                        </span>
                        <span>
                          <span className="block font-medium text-[var(--hive-text)]">
                            {person.full_name}
                          </span>
                          {person.subtitle ? (
                            <span className="block text-xs text-muted-foreground">
                              {person.subtitle}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </td>
                    {(board?.columns ?? []).map((col) => {
                      const cell = cellOf(person.id, col.requirementKey);
                      const glyph = cell?.status ?? "missing";
                      return (
                        <td key={col.requirementKey} className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => onOpenCell(person.id, cell?.itemId ?? null)}
                            className="inline-flex"
                          >
                            <EvidenceStatusGlyph status={glyph} />
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onAddForPerson(person.id)}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <EvidenceStatusLegend />
    </section>
  );
}

function SubjectAssignPicker({
  tab,
  people,
  loading,
  selectedIds,
  onChange,
}: {
  tab: EvidenceSubject;
  people: EvidencePerson[];
  loading: boolean;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  if (tab === "company") {
    return (
      <div className="grid gap-1.5">
        <Label>Assign to</Label>
        <p className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">Company</p>
      </div>
    );
  }

  const noun = tab === "client" ? "client" : "staff";
  const needle = query.trim().toLowerCase();
  const selected = people.filter((p) => selectedIds.includes(p.id));
  const filtered = people.filter((p) => {
    if (needle && !p.full_name.toLowerCase().includes(needle)) return false;
    return true;
  });

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((row) => row !== id) : [...selectedIds, id],
    );
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor="ev-assign-search">
        {tab === "client" ? "Assign to client" : "Assign to staff"}
      </Label>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800"
            >
              {p.full_name}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="ev-assign-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "client" ? "Search clients" : "Search staff"}
          className="h-9 pl-9"
        />
      </div>
      <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
        {loading ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">Loading {noun}s…</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            {people.length === 0 ? `No ${noun}s in this organization.` : `No matching ${noun}s.`}
          </p>
        ) : (
          <ul>
            {filtered.map((p) => {
              const on = selectedIds.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/60"
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
                        on
                          ? "border-[var(--hive-text)] bg-[var(--hive-text)] text-white"
                          : "border-input bg-background"
                      }`}
                    >
                      {on ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span>
                      <span className="block font-medium">{p.full_name}</span>
                      {p.subtitle ? (
                        <span className="block text-xs text-muted-foreground">{p.subtitle}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function PackSettingsPanel({
  board,
  tab,
  onClose,
  onRemove,
  onAddCustom,
}: {
  board: EvidenceBoard | undefined;
  tab: EvidenceSubject;
  onClose: () => void;
  onRemove: (id: string) => void;
  onAddCustom: () => void;
}) {
  const packs = packsForSubject(tab);
  const uniqueRows = new Map<
    string,
    { title: string; sow: string | null; count: number; itemIds: string[] }
  >();
  for (const item of board?.items ?? []) {
    const cur = uniqueRows.get(item.requirement_key) ?? {
      title: item.title,
      sow: item.sow_cite,
      count: 0,
      itemIds: [],
    };
    cur.count += 1;
    cur.itemIds.push(item.id);
    uniqueRows.set(item.requirement_key, cur);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {tab === "staff" ? "Staff pack" : tab === "client" ? "Client pack" : "Company pack"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Requirements on this tab. Remove a row or add a custom one.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <ul className="mt-5 space-y-2">
        {[...uniqueRows.entries()].map(([key, row]) => (
          <li
            key={key}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-3"
          >
            <div>
              <p className="text-sm font-medium">{row.title}</p>
              <p className="text-xs text-muted-foreground">
                {requirementByKey(key)?.evidenceType === "attestation" ? "Attest" : "Upload"} ·{" "}
                {cadenceLabel(requirementByKey(key)?.cadence ?? "once")} · {row.sow ?? "Custom"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Assigned to {row.count}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(row.itemIds[0]!)}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={onAddCustom}>
          Add requirement
        </Button>
        <p className="self-center text-xs text-muted-foreground">
          {packs.map((p) => p.title).join(" · ")}
        </p>
      </div>
    </section>
  );
}

function NewRequirementPanel({
  tab,
  people,
  peopleLoading,
  defaultSubjectIds,
  onCancel,
  onSave,
  pending,
}: {
  tab: EvidenceSubject;
  people: EvidenceBoard["people"];
  peopleLoading: boolean;
  defaultSubjectIds: string[];
  onCancel: () => void;
  onSave: (payload: {
    subjectIds: string[];
    title: string;
    evidenceType: EvidenceType;
    attestationText: string | null;
    cadence: EvidenceCadence;
    sowCite: string | null;
  }) => void;
  pending: boolean;
}) {
  const [kind, setKind] = useState<EvidenceType | null>(null);
  const [title, setTitle] = useState("");
  const [attest, setAttest] = useState("");
  const [cadence, setCadence] = useState<EvidenceCadence>("annual");
  const [sowCite, setSowCite] = useState("");
  const [ids, setIds] = useState<string[]>(defaultSubjectIds);
  const defaultKey = defaultSubjectIds.join(",");

  useEffect(() => {
    setIds(defaultKey ? defaultKey.split(",") : []);
  }, [defaultKey]);

  if (!kind) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">New requirement</h2>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Close
          </Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setKind("upload")}
            className="rounded-2xl border border-border p-5 text-left hover:border-[var(--hive-text)]"
          >
            <Upload className="h-5 w-5" />
            <p className="mt-3 font-semibold">Request upload</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask staff to upload IDs, licenses, certificates, screenshots.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setKind("attestation")}
            className="rounded-2xl border border-border p-5 text-left hover:border-[var(--hive-text)]"
          >
            <PenLine className="h-5 w-5" />
            <p className="mt-3 font-semibold">Attest or sign</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Checkbox attestation or e-sign. Still optional file.
            </p>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold">
          {kind === "upload" ? "Request upload" : "Attest or sign"}
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Close
        </Button>
      </div>
      <div className="mt-4 grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ev-title">Title</Label>
          <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        {kind === "attestation" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="ev-attest">Statement the signer must affirm</Label>
            <textarea
              id="ev-attest"
              value={attest}
              onChange={(e) => setAttest(e.target.value)}
              className="min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor="ev-cadence">Renew</Label>
          <select
            id="ev-cadence"
            value={cadence}
            onChange={(e) => setCadence(e.target.value as EvidenceCadence)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {EVIDENCE_CADENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ev-sow">SOW cite (optional)</Label>
          <Input id="ev-sow" value={sowCite} onChange={(e) => setSowCite(e.target.value)} />
        </div>
        <SubjectAssignPicker
          tab={tab}
          people={people}
          loading={peopleLoading}
          selectedIds={ids}
          onChange={setIds}
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setKind(null)}>
          Back
        </Button>
        <Button
          type="button"
          disabled={!title.trim() || ids.length === 0 || pending}
          onClick={() =>
            onSave({
              subjectIds: ids,
              title: title.trim(),
              evidenceType: kind,
              attestationText: kind === "attestation" ? attest.trim() || title.trim() : null,
              cadence,
              sowCite: sowCite.trim() || null,
            })
          }
        >
          {pending ? "Saving…" : "Save requirement"}
        </Button>
      </div>
    </section>
  );
}

function ReviewPanel({
  board,
  itemId,
  orgId,
  onClose,
  onUpload,
  onAttest,
  pending,
}: {
  board: EvidenceBoard | undefined;
  itemId: string | null;
  orgId: string;
  onClose: () => void;
  onUpload: (payload: {
    itemId: string;
    storagePath: string;
    filename: string;
    expiresOn: string | null;
  }) => void;
  onAttest: (text: string) => void;
  pending: boolean;
}) {
  const item = board?.items.find((i) => i.id === itemId) ?? null;
  const file = item ? latestFileForItem(board?.files ?? [], item.id) : null;
  const person = board?.people.find((p) => p.id === item?.subject_id);
  const [expires, setExpires] = useState(item?.expires_on ?? "");
  const [preview, setPreview] = useState<string | null>(null);

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
        Pick a cell on the grid to review a file.{" "}
        <Button type="button" variant="outline" size="sm" className="ml-2" onClick={onClose}>
          Back to grid
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
          {cadenceLabel(item.cadence)}
        </p>
        {item.expires_on ? (
          <p className="mt-3 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
            Done · expires {formatExpiresOn(item.expires_on)}
          </p>
        ) : (
          <p className="mt-3 rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-800">Missing</p>
        )}
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
                  expiresOn: expires || null,
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
                onAttest(item.attestation_text || `I attest that ${item.title} is complete.`)
              }
            >
              Mark attested
            </Button>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="ev-exp">Expiration</Label>
            <Input
              id="ev-exp"
              type="date"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
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

function PersonPackEditor({
  board,
  person,
  personId,
  tab,
  staffPicker,
  onClose,
  onQuiz,
  onReview,
  onRemove,
  onSend,
  onLink,
  pending,
}: {
  board: EvidenceBoard | undefined;
  person: EvidencePerson;
  personId: string;
  tab: EvidenceSubject;
  staffPicker: EvidenceBoard["staffPicker"];
  onClose: () => void;
  onQuiz: () => void;
  onReview: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onSend: (itemIds: string[], staffId?: string) => void;
  onLink: (itemId: string, peerSubjectId: string) => void;
  pending: boolean;
}) {
  const rows = (board?.items ?? []).filter((i) => i.subject_id === personId);
  const [selected, setSelected] = useState<string[]>([]);
  const [peerId, setPeerId] = useState("");
  const [sendStaff, setSendStaff] = useState(personId);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{person.full_name}</h2>
          <p className="text-sm text-muted-foreground">{person.subtitle ?? "Pack"}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close person pack"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
          >
            <label className="flex min-w-0 items-center gap-3">
              <Checkbox
                checked={selected.includes(row.id)}
                onCheckedChange={(v) =>
                  setSelected((prev) =>
                    v === true ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                  )
                }
              />
              <button type="button" className="text-left" onClick={() => onReview(row.id)}>
                <span className="block text-sm font-medium">{row.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {row.evidence_type} · {cadenceLabel(row.cadence)} · {row.sow_cite ?? "Custom"}
                  {row.sent_to_staff ? " · sent to staff" : ""}
                  {row.dual_link_peer_id ? " · dual-linked" : ""}
                </span>
              </button>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => onRemove(row.id)}
            >
              Remove
            </Button>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="text-sm text-muted-foreground">No rows yet. Use Add to apply a pack.</li>
        ) : null}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onQuiz}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add
        </Button>
        {tab !== "staff" ? (
          <select
            value={sendStaff}
            onChange={(e) => setSendStaff(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {staffPicker.map((s) => (
              <option key={s.id} value={s.id}>
                Send as {s.full_name}
              </option>
            ))}
          </select>
        ) : null}
        <Button
          type="button"
          disabled={selected.length === 0 || pending}
          onClick={() => onSend(selected, tab === "staff" ? personId : sendStaff)}
        >
          Send to staff
        </Button>
        {rows.some((r) => r.dual_link_key === "host_home_cert" && !r.dual_link_peer_id) ? (
          <div className="flex items-center gap-2">
            <Input
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              placeholder={tab === "staff" ? "Client id to dual-link" : "Staff id to dual-link"}
              className="h-9 w-56"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!peerId || pending}
              onClick={() => {
                const host = rows.find((r) => r.dual_link_key === "host_home_cert");
                if (host) onLink(host.id, peerId.trim());
              }}
            >
              Dual-link Host Home Cert
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function GetStartedPanel({
  tab,
  staff,
  clients,
  clientsLoading,
  clientsError,
  companyId,
  onOpenQuiz,
  onSkip,
}: {
  tab: EvidenceSubject;
  staff: EvidencePerson[];
  clients: EvidencePerson[];
  clientsLoading: boolean;
  clientsError: string | null;
  companyId: string;
  onOpenQuiz: (tab: EvidenceSubject, personId: string | null) => void;
  onSkip: () => void;
}) {
  const [which, setWhich] = useState<EvidenceSubject>(tab === "company" ? "staff" : tab);
  const list = which === "client" ? clients : which === "staff" ? staff : [];
  const loading = which === "client" && clientsLoading;
  const error = which === "client" ? clientsError : null;
  const noun = which === "client" ? "client" : "staff";

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-[var(--hive-text)]">Get started with Evidence</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Add the first staff or client pack. Suggested rows stay suggestions until you apply them. If
        your agency already tracks this elsewhere, skip and add a person from the grid later.
      </p>

      <Tabs value={which} onValueChange={(v) => setWhich(v as EvidenceSubject)} className="mt-6">
        <TabsList className="h-auto">
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="client">Clients</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
        </TabsList>
      </Tabs>

      {which === "company" ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-4">
          <div>
            <p className="text-sm font-medium">Company file</p>
            <p className="text-xs text-muted-foreground">
              Policies and agency-wide evidence. No person list.
            </p>
          </div>
          <Button type="button" onClick={() => onOpenQuiz("company", companyId)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      ) : loading ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading {noun}s…</p>
      ) : error ? (
        <p role="alert" className="mt-5 text-sm text-destructive">
          Could not load {noun}s: {error}
        </p>
      ) : list.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          {which === "client" ? "No clients yet." : "No staff yet."}
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
          {list.map((person) => (
            <li key={person.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  {person.initials}
                </span>
                <span>
                  <span className="block text-sm font-medium">{person.full_name}</span>
                  {person.subtitle ? (
                    <span className="block text-xs text-muted-foreground">{person.subtitle}</span>
                  ) : null}
                </span>
              </div>
              <Button type="button" size="sm" onClick={() => onOpenQuiz(which, person.id)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <Button type="button" variant="ghost" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
    </section>
  );
}
