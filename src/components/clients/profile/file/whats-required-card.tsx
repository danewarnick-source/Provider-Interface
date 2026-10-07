// "What's required for <first name>": the packs on this client, each marked
// where it came from ("From HHS", "Every client", "Added by hand"). Owners
// and agency admins can add or remove a pack and add one item; everyone else
// sees the same list read-only. Agency-wide changes live in Evidence.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { RowMenu } from "@/components/clients/profile/cards/row-menu";
import { addClientFilePack, removeClientFilePack } from "@/lib/clients/file-evidence.functions";
import { clientPack } from "@/lib/clients/file-packs";
import { packOrigin } from "@/lib/clients/file-rows";
import { AddItemDialog } from "./add-item-dialog";
import { AddPackDialog } from "./add-pack-dialog";

export function WhatsRequiredCard({
  orgId,
  clientId,
  firstName,
  activePackKeys,
  activeCodes,
  existingKeys,
  canManage,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  firstName: string;
  activePackKeys: readonly string[];
  activeCodes: readonly string[];
  existingKeys: ReadonlySet<string>;
  canManage: boolean;
  onChanged: () => void;
}) {
  const addFn = useServerFn(addClientFilePack);
  const removeFn = useServerFn(removeClientFilePack);
  const [dialog, setDialog] = useState<"pack" | "item" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      onChanged();
      setDialog(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the change.");
    } finally {
      setBusy(false);
    }
  }
  const input = (packKey: string) => ({ data: { organizationId: orgId, clientId, packKey } });
  const remove = (packKey: string, title: string) => {
    if (!confirm(`Remove ${title}? Its documents stay on record and show as Not needed.`)) return;
    void run(() => removeFn(input(packKey)), `${title} removed`);
  };

  return (
    <SectionCard
      icon={ListChecks}
      tone="info"
      title={`What's required for ${firstName}`}
      description="The document packs on this client's file and where each came from."
      testId="client-file-whats-required"
      actions={
        canManage ? (
          <>
            <Button variant="outline" onClick={() => setDialog("pack")} disabled={busy}>
              <Plus className="h-4 w-4" />
              Add a pack
            </Button>
            <Button variant="outline" onClick={() => setDialog("item")} disabled={busy}>
              <Plus className="h-4 w-4" />
              Add one item
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard/evidence" search={{ tab: "client", person: clientId }}>
                Open in Evidence
              </Link>
            </Button>
          </>
        ) : undefined
      }
    >
      <ul className="mt-4 divide-y divide-hive-border" data-testid="client-file-packs">
        {activePackKeys.map((key) => {
          const pack = clientPack(key);
          if (!pack) return null;
          return (
            <li key={key} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-hive-ink">{pack.title}</p>
                <p className="text-xs text-muted-foreground">{pack.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusTag tone="neutral">{packOrigin(key, activeCodes)}</StatusTag>
                {canManage ? (
                  <RowMenu
                    label={`More actions for ${pack.title}`}
                    items={[
                      {
                        label: "Remove pack",
                        danger: true,
                        disabled: busy,
                        onSelect: () => remove(key, pack.title),
                      },
                    ]}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <AddPackDialog
        open={dialog === "pack"}
        activePackKeys={activePackKeys}
        pending={busy}
        onClose={() => setDialog(null)}
        onAdd={(key) => void run(() => addFn(input(key)), "Pack added")}
      />
      <AddItemDialog
        open={dialog === "item"}
        orgId={orgId}
        clientId={clientId}
        activeCodes={activeCodes}
        existingKeys={existingKeys}
        onClose={() => setDialog(null)}
        onSaved={onChanged}
      />
    </SectionCard>
  );
}
