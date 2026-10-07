// Authorizations (the 1056): every code with its units used vs. left and
// pace, the dollar budget, Fill from 1056, Add, Edit, End and Renew.
// Ended authorizations stay listed (never deleted).

import { useRef, useState } from "react";
import { FileUp, Loader2, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";
import type { AuthorizationRow as Row } from "@/lib/clients/authorizations";
import { AuthorizationRow } from "./authorization-row";
import { money } from "./money";
import { AuthorizationDialog } from "./authorization-dialog";
import { EndAuthorizationDialog } from "./end-authorization-dialog";
import { Fill1056Review } from "./fill-1056-review";
import { use1056Import } from "./use-1056-import";
import { useClientServices, useRefreshServices } from "./use-client-services";

type Editing = { row: Row | null; renew: boolean } | null;

export function AuthorizationsCard({
  orgId,
  clientId,
  canEdit,
}: {
  orgId: string;
  clientId: string;
  canEdit: boolean;
}) {
  const q = useClientServices(orgId, clientId);
  const refresh = useRefreshServices(clientId);
  const imp = use1056Import(orgId, clientId, refresh);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [ending, setEnding] = useState<Row | null>(null);
  const [showEnded, setShowEnded] = useState(false);

  const data = q.data;
  const open = (data?.authorizations ?? []).filter((v) => v.state !== "ended");
  const ended = (data?.authorizations ?? []).filter((v) => v.state === "ended");
  const row = (v: (typeof open)[number]) => (
    <AuthorizationRow
      key={v.row.id}
      v={v}
      history={data?.history[v.row.id] ?? []}
      canEdit={canEdit}
      onEdit={() => setEditing({ row: v.row, renew: v.state === "ended" })}
      onEnd={() => setEnding(v.row)}
    />
  );

  const addButton = (
    <Button onClick={() => setEditing({ row: null, renew: false })}>
      <Plus className="h-4 w-4" />
      Add authorization
    </Button>
  );

  return (
    <SectionCard
      icon={Receipt}
      tone="profile"
      title="Authorizations"
      description={
        data && data.totals.authorized > 0 ? (
          <span className="tabular-nums">
            Budget {money(data.totals.authorized)} · used {money(data.totals.used)} ·{" "}
            <strong>{money(data.totals.left)} left</strong>
          </span>
        ) : (
          "Each code the 1056 authorizes, with units used and left."
        )
      }
      testId="client-authorizations-card"
      actions={
        canEdit ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void imp.upload(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              disabled={imp.reading}
              onClick={() => fileRef.current?.click()}
            >
              {imp.reading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              {imp.reading ? "Reading the 1056…" : "Fill from 1056"}
            </Button>
            {addButton}
          </>
        ) : null
      }
    >
      <div className="space-y-3">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : q.error ? (
          <p className="text-sm text-destructive">
            {q.error instanceof Error ? q.error.message : "Couldn't load authorizations."}
          </p>
        ) : open.length === 0 ? (
          <EmptyState action={canEdit ? addButton : null}>
            No open authorizations. Without one, this client can't be scheduled or billed.
          </EmptyState>
        ) : (
          open.map(row)
        )}
        {ended.length > 0 && (
          <div>
            <Button variant="ghost" onClick={() => setShowEnded((s) => !s)}>
              {showEnded ? "Hide" : "Show"} ended authorizations ({ended.length})
            </Button>
            {showEnded && <div className="mt-2 space-y-2">{ended.map(row)}</div>}
          </div>
        )}
      </div>

      {editing && (
        <AuthorizationDialog
          orgId={orgId}
          clientId={clientId}
          row={editing.row}
          renew={editing.renew}
          agencyCodes={data?.agencyCodes ?? []}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      {ending && (
        <EndAuthorizationDialog
          orgId={orgId}
          clientId={clientId}
          row={ending}
          onClose={() => setEnding(null)}
          onSaved={refresh}
        />
      )}
      {imp.read && imp.review && (
        <Fill1056Review
          read={imp.read}
          review={imp.review}
          onChange={imp.setReview}
          saving={imp.saving}
          onConfirm={() => void imp.confirm()}
          onClose={imp.close}
        />
      )}
    </SectionCard>
  );
}
