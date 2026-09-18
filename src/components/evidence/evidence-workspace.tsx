import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { cadenceLabel, parseServiceCodeFlags } from "@/lib/evidence/catalog.ts";
import {
  applyEvidenceRequirements,
  linkHostHomeEvidence,
  loadEvidenceBoard,
  recordEvidenceAttestation,
  recordEvidenceUpload,
  removeEvidenceRequirement,
  sendEvidenceToStaff,
  type EvidenceBoard,
} from "@/lib/evidence.functions";
import { type EvidenceStep } from "@/lib/evidence/nav.ts";
import { fetchEvidenceClientPeople } from "@/lib/evidence/fetch-clients.ts";
import { formatExpiresOn, latestFileForItem } from "@/lib/evidence/status.ts";
import {
  type EvidencePerson,
  type EvidenceSubject,
  type EvidenceType,
} from "@/lib/evidence/types.ts";
import { EvidenceQuestionnaire } from "./evidence-questionnaire";

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
  const qc = useQueryClient();
  const loadFn = useServerFn(loadEvidenceBoard);
  const applyFn = useServerFn(applyEvidenceRequirements);
  const removeFn = useServerFn(removeEvidenceRequirement);
  const sendFn = useServerFn(sendEvidenceToStaff);
  const uploadFn = useServerFn(recordEvidenceUpload);
  const attestFn = useServerFn(recordEvidenceAttestation);
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
  const removeM = useMutation({
    mutationFn: (id: string) => removeFn({ data: { organizationId: orgId!, itemId: id } }),
    onSuccess: () => {
      toast.success("Row removed.");
      invalidate();
    },
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
  const peopleError =
    tab === "client"
      ? clientsQ.error instanceof Error
        ? clientsQ.error.message
        : (board?.peopleError ?? null)
      : (board?.peopleError ?? null);
  const peopleLoading =
    tab === "client" ? clientsQ.isLoading || boardQ.isLoading : boardQ.isLoading;
  const showQuiz = step === "quiz";

  const openPackFor = (nextTab: EvidenceSubject, nextPerson: string) => {
    onSearchChange({ tab: nextTab, step: "quiz", person: nextPerson, item: null });
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

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--hive-text)]">Evidence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Staff, client, and company files. Add opens packs for that person only.
        </p>
      </header>

      {step === "review" ? (
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
        <RosterPanel
          board={board}
          people={people}
          peopleError={peopleError}
          tab={tab}
          loading={peopleLoading}
          selectedId={personId}
          onTabChange={(next) =>
            onSearchChange({ tab: next, step: "grid", person: null, item: null })
          }
          onOpenPerson={(id) => onSearchChange({ tab, step: "grid", person: id, item: null })}
          onAddForPerson={(id) => openPackFor(tab, id)}
        />
      )}

      {step === "grid" && person ? (
        <PersonPackEditor
          board={board}
          person={person}
          personId={person.id}
          tab={tab}
          staffPicker={board?.staffPicker ?? []}
          onClose={() => onSearchChange({ tab, step: "grid", person: null })}
          onQuiz={() => openPackFor(tab, person.id)}
          onReview={(item) => onSearchChange({ tab, step: "review", person: person.id, item })}
          onRemove={(id) => removeM.mutate(id)}
          onSend={(ids, staffId) => sendM.mutate({ itemIds: ids, staffId })}
          onLink={(item, peer) => linkM.mutate({ itemId: item, peerSubjectId: peer })}
          pending={removeM.isPending || sendM.isPending || linkM.isPending}
        />
      ) : null}

      {showQuiz ? (
        <EvidenceQuestionnaire
          subject={tab}
          personName={
            person?.full_name ??
            (tab === "company" ? "Company" : tab === "client" ? "Client" : "Staff")
          }
          initialCodes={initialCodes}
          onClose={() => onSearchChange({ tab, step: "grid", person: personId })}
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
          pending={applyM.isPending}
        />
      ) : null}
    </div>
  );
}

function RosterPanel({
  board,
  people: roster,
  peopleError,
  tab,
  loading,
  selectedId,
  onTabChange,
  onOpenPerson,
  onAddForPerson,
}: {
  board: EvidenceBoard | undefined;
  people: EvidencePerson[];
  peopleError: string | null;
  tab: EvidenceSubject;
  loading: boolean;
  selectedId?: string;
  onTabChange: (tab: EvidenceSubject) => void;
  onOpenPerson: (id: string) => void;
  onAddForPerson: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const people = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return roster;
    return roster.filter((p) => p.full_name.toLowerCase().includes(needle));
  }, [roster, q]);

  const countFor = (id: string) =>
    (board?.items ?? []).filter((item) => item.subject_id === id).length;

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="h-9 pl-9"
        />
      </div>

      {peopleError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Could not load {tab === "client" ? "clients" : "people"}: {peopleError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading Evidence…</div>
        ) : !people.length ? (
          <div className="p-8 text-sm text-muted-foreground">
            {peopleError ? `Could not load this list. ${peopleError}` : emptyCopy}
          </div>
        ) : (
          <ul>
            {people.map((person) => {
              const count = countFor(person.id);
              return (
                <li
                  key={person.id}
                  className={`flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 ${
                    selectedId === person.id ? "bg-muted/40" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenPerson(person.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                      {person.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-[var(--hive-text)]">
                        {person.full_name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {person.subtitle ? `${person.subtitle} · ` : ""}
                        {count > 0
                          ? `${count} requirement${count === 1 ? "" : "s"}`
                          : "no packs yet"}
                      </span>
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Add evidence for ${person.full_name}`}
                    onClick={() => onAddForPerson(person.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="ml-1.5">Add</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
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
