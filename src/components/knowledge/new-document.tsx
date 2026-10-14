import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { questionDraftText, SLOT_DRAFT_TEXT } from "@/lib/nectar/library/knowledge-view";
import { AGENCY_GROUPS, LIBRARY_GROUP_LABEL, type AgencyGroup } from "@/lib/nectar/library/library";
import {
  createLibraryDraft,
  getLibraryDraftQuestion,
} from "@/lib/nectar/library/library.functions";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { DocumentSourceInput } from "./document-source-input";
import { KnowledgeError, KnowledgeLoading } from "./knowledge-states";
import {
  knowledgeKey,
  useKnowledgeNav,
  useRefreshKnowledge,
  useRequiredPolicies,
} from "./use-knowledge";
import { sourceReady, useUploadLibraryFile, type SourceValue } from "./use-library-upload";

type SlotOption = { id: string; codeLabel: string; label: string };

/**
 * New document, optionally prefilled from a required slot ("Add" on Required
 * policies) or from a question Nectar couldn't answer ("Add to library").
 */
export function NewDocument({
  orgId,
  slot,
  question,
}: {
  orgId: string;
  slot?: string;
  question?: string;
}) {
  const required = useRequiredPolicies(orgId);
  const questionFn = useServerFn(getLibraryDraftQuestion);
  const asked = useQuery({
    enabled: !!question,
    queryKey: knowledgeKey(orgId, "question", question ?? ""),
    queryFn: () => questionFn({ data: { organizationId: orgId, questionId: question! } }),
  });
  if (required.isLoading || (question && asked.isLoading)) return <KnowledgeLoading />;
  if (required.error || !required.data) return <KnowledgeError error={required.error} />;
  if (asked.error) return <KnowledgeError error={asked.error} />;
  const slots = required.data.rows;
  const fromSlot = slots.find((s) => s.id === slot);
  const initial = {
    name: fromSlot?.label ?? "",
    slot: fromSlot?.id ?? "",
    text: asked.data ? questionDraftText(asked.data.question) : fromSlot ? SLOT_DRAFT_TEXT : "",
  };
  return (
    <NewDocumentForm orgId={orgId} slots={slots} initial={initial} questionId={asked.data?.id} />
  );
}

function NewDocumentForm({
  orgId,
  slots,
  initial,
  questionId,
}: {
  orgId: string;
  slots: SlotOption[];
  initial: { name: string; slot: string; text: string };
  questionId?: string;
}) {
  const nav = useKnowledgeNav();
  const refresh = useRefreshKnowledge(orgId);
  const createFn = useServerFn(createLibraryDraft);
  const upload = useUploadLibraryFile(orgId);
  const [name, setName] = useState(initial.name);
  const [group, setGroup] = useState<AgencyGroup>("agency");
  const [slot, setSlot] = useState(initial.slot);
  const [source, setSource] = useState<SourceValue>({
    mode: "text",
    text: initial.text,
    file: null,
  });
  const save = useMutation({
    mutationFn: async () => {
      const base = {
        organizationId: orgId,
        title: name.trim(),
        group,
        requiredSlot: slot || null,
        resolvesQuestionId: questionId,
      };
      if (source.mode === "file") {
        return createFn({ data: { ...base, upload: await upload(source.file!) } });
      }
      return createFn({ data: { ...base, text: source.text } });
    },
    onSuccess: async (saved) => {
      await refresh();
      toast.success(
        saved.parseStatus === "no_text"
          ? "Saved as a draft. The file has no readable text, so Nectar can't use it."
          : "Saved as a draft.",
      );
      nav.openDocument(saved.id);
    },
    onError: (e) => toast.error(safeErrorMessage(e, "Could not save the draft.")),
  });
  const canSave = name.trim().length > 0 && sourceReady(source) && !save.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) save.mutate();
      }}
      className="max-w-3xl space-y-5 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--hive-text)] sm:text-2xl">
          New document
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved as a draft. Nectar won't use it until you publish it.
          {questionId ? " Saving it marks the question resolved." : ""}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="kb-new-name">Name</Label>
        <Input
          id="kb-new-name"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="kb-new-group">Group</Label>
          <Select value={group} onValueChange={(v) => setGroup(v as AgencyGroup)}>
            <SelectTrigger id="kb-new-group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGENCY_GROUPS.map((g) => (
                <SelectItem key={g} value={g}>
                  {LIBRARY_GROUP_LABEL[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kb-new-slot">Fills a required policy</Label>
          <Select value={slot || "none"} onValueChange={(v) => setSlot(v === "none" ? "" : v)}>
            <SelectTrigger id="kb-new-slot">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {slots.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.codeLabel} {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DocumentSourceInput
        idPrefix="kb-new"
        label="Text"
        value={source}
        onChange={setSource}
        disabled={save.isPending}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!canSave}>
          {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Save draft
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => nav.home()}
          disabled={save.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
