// Follow-ups to the Health setup questions: a list to type (allergies,
// diagnoses), saved on the clients row like the Allergies, diagnoses and
// conditions card; and the medication choices (eMAR or a MAR sheet).

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { splitList } from "@/lib/clients/health";
import { NectarAsk } from "@/components/clients/shared/nectar-ask";
import { useLatestDocument } from "@/components/clients/profile/plans/use-latest-document";
import {
  useSaveHealth,
  type ClientHealthRow,
} from "@/components/clients/profile/health/use-client-health";

type ListKey = "allergies" | "diagnoses" | "chronic_conditions";

export function ListAnswer({
  orgId,
  health,
  fields,
  saveLabel,
}: {
  orgId: string;
  health: ClientHealthRow;
  fields: { key: ListKey; label: string }[];
  saveLabel: string;
}) {
  const save = useSaveHealth(orgId, health.id);
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, (health[f.key] ?? []).join("\n")])),
  );
  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <label key={f.key} className="block space-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
          <Textarea
            rows={2}
            placeholder="One per line"
            value={text[f.key]}
            onChange={(e) => setText((t) => ({ ...t, [f.key]: e.target.value }))}
          />
        </label>
      ))}
      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={save.isPending}
          onClick={() =>
            save.mutate(Object.fromEntries(fields.map((f) => [f.key, splitList(text[f.key])])))
          }
        >
          {save.isPending ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}

const MAR_TYPES = ["mar"] as const;

export function MedicationChoices({ orgId, clientId }: { orgId: string; clientId: string }) {
  const mar = useLatestDocument(orgId, clientId, MAR_TYPES);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Add their medications on the eMAR, or upload the MAR sheet you use now.
        </p>
        <Button variant="outline" asChild>
          <Link to="/dashboard/emar">Set up the eMAR</Link>
        </Button>
      </div>
      <NectarAsk
        question="Upload a MAR sheet"
        kind="data_rich_gap"
        clientId={clientId}
        uploadDocumentType="mar"
        answeredSummary={mar.data ? `On file: ${mar.data.file_name}` : null}
      />
    </div>
  );
}
