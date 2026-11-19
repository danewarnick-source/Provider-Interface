// Scheduler › Rotations (/dashboard/scheduler/rotations, B6; the demo's
// vRotations): one tab per staffed home and per client with an active code,
// each with its rotation lines (Edit / End) and what they drafted for the
// next 4 weeks. + Add a rotation and Edit open the editor
// (rotation-editor.tsx); End asks for the last day (end-rotation-dialog.tsx).
// Copy this week instead opens the board's Copy week. The tab and the open
// line live in the URL (the route passes them).
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { useCurrentOrg } from "@/hooks/use-org";
import {
  newState,
  placeKeyOf,
  stateFromLine,
  type EditorState,
} from "@/lib/scheduler/rotation-form";
import type { RotationLine } from "@/lib/scheduler/rotation";
import { EndRotationDialog } from "./end-rotation-dialog";
import { RotationEditor } from "./rotation-editor";
import { RotationLines, RotationWeeks } from "./rotation-list";
import { isCurrent, useRotations } from "./use-rotations";

type Search = { place?: string; line?: string };

export function RotationsPage({
  search,
  onSearch,
}: {
  search: Search;
  onSearch: (p: Search) => void;
}) {
  const orgId = useCurrentOrg().data?.organization_id;
  const canEdit = useAccess().canCategory("scheduling", "edit");
  const { data, today, error } = useRotations(orgId);
  const [adding, setAdding] = useState<EditorState | null>(null);
  const [ending, setEnding] = useState<RotationLine | null>(null);

  if (error)
    return (
      <p className="p-8 text-sm text-[var(--hive-danger)]">
        Rotations didn't load: {error.message}. Reload the page to try again.
      </p>
    );
  if (!data || !orgId)
    return <p className="p-8 text-sm text-[var(--hive-text-muted)]">Loading rotations…</p>;

  const place = data.places.find((p) => p.key === search.place) ?? data.places[0] ?? null;
  const lines = place ? data.lines.filter((l) => placeKeyOf(l) === place.key) : [];
  const opened = canEdit ? data.lines.find((l) => l.id === search.line) : undefined;
  const editor = opened ? stateFromLine(opened) : adding;
  const add = () => setAdding(newState(place, today));
  const closeEditor = () => {
    setAdding(null);
    if (search.line) onSearch({ line: undefined });
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 px-3 py-4 sm:px-4">
      <Link to="/dashboard/scheduler" className="text-sm font-semibold underline">
        ‹ Back to the board
      </Link>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">Rotations</h1>
          <p className="text-sm text-[var(--hive-text-muted)]">
            Each home's and client's usual pattern. The next 4 weeks are always drafted from them;
            shifts you edit by hand are never overwritten.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard/scheduler"
              search={{ copy: true }}
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--hive-border)] px-3.5 text-[13px] font-semibold"
            >
              Copy this week instead
            </Link>
            {place && (
              <Button className="min-h-11" onClick={add}>
                <Plus className="mr-1 h-4 w-4" /> Add a rotation
              </Button>
            )}
          </div>
        )}
      </div>
      {!place ? (
        <p className="rounded-xl border border-[var(--hive-border)] p-6 text-sm">
          No homes or clients to schedule yet. Add a home in Settings › Homes, or an active code on
          a client's 1056.
        </p>
      ) : (
        <>
          <div role="tablist" className="flex flex-wrap gap-1.5">
            {data.places.map((p) => {
              const n = data.lines.filter((l) => placeKeyOf(l) === p.key && isCurrent(l, today));
              return (
                <button
                  key={p.key}
                  type="button"
                  role="tab"
                  aria-selected={p.key === place.key}
                  onClick={() => onSearch({ place: p.key, line: undefined })}
                  className={`min-h-11 rounded-full border px-3 text-[13px] font-semibold ${
                    p.key === place.key
                      ? "border-[var(--hive-ink)] bg-[var(--hive-ink)] text-white"
                      : "border-[var(--hive-border)] hover:bg-[var(--hive-hover)]"
                  }`}
                >
                  {p.label} <span className="ml-1 opacity-70">{n.length}</span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <RotationLines
              data={data}
              place={place}
              lines={lines}
              today={today}
              canEdit={canEdit}
              highlight={search.line}
              onAdd={add}
              onEdit={(l) => onSearch({ line: l.id })}
              onEnd={setEnding}
            />
            <RotationWeeks data={data} lines={lines} today={today} />
          </div>
        </>
      )}
      {editor && (
        <RotationEditor
          key={editor.id ?? "new"}
          orgId={orgId}
          data={data}
          today={today}
          initial={editor}
          onClose={closeEditor}
        />
      )}
      {ending && (
        <EndRotationDialog
          orgId={orgId}
          line={ending}
          today={today}
          onClose={() => setEnding(null)}
        />
      )}
    </div>
  );
}
