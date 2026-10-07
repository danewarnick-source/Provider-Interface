// One editable free-text field on the clients row (mailing address, About
// me): read view, pencil, textarea, Save/Cancel. Saves through updateClient.

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/hooks/use-access";
import { updateClient } from "@/lib/clients/writes.functions";
import { EditButton, SaveBar, SectionCard } from "@/components/clients/profile/cards/section-card";
import { EmptyState } from "@/components/clients/profile/cards/card-parts";

export function TextFieldCard({
  orgId,
  clientId,
  field,
  icon,
  title,
  subtitle,
  value,
  empty,
  placeholder,
  rows = 3,
  onChanged,
}: {
  orgId: string;
  clientId: string;
  field: "mailing_address" | "about_me";
  icon: LucideIcon;
  title: string;
  subtitle: string;
  value: string | null;
  empty: string;
  placeholder?: string;
  rows?: number;
  onChanged: () => void;
}) {
  const canEdit = useAccess().canCategory("clients", "edit");
  const updateFn = useServerFn(updateClient);
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (v: string) =>
      updateFn({ data: { organizationId: orgId, clientId, patch: { [field]: v.trim() || null } } }),
    onSuccess: () => {
      toast.success("Saved.");
      setDraft(null);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <SectionCard
      icon={icon}
      tone="profile"
      title={title}
      description={subtitle}
      actions={
        canEdit && draft === null ? (
          <EditButton label={`Edit ${title.toLowerCase()}`} onClick={() => setDraft(value ?? "")} />
        ) : null
      }
    >
      {draft !== null ? (
        <Textarea
          value={draft}
          rows={rows}
          aria-label={title}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : value ? (
        <p className="whitespace-pre-wrap text-sm" data-testid={`client-${field}`}>
          {value}
        </p>
      ) : (
        <EmptyState
          action={
            canEdit ? (
              <Button variant="outline" onClick={() => setDraft("")}>
                Add {title.toLowerCase()}
              </Button>
            ) : null
          }
        >
          {empty}
        </EmptyState>
      )}
      {draft !== null ? (
        <SaveBar
          onCancel={() => setDraft(null)}
          onSave={() => save.mutate(draft)}
          saving={save.isPending}
          saveLabel={`Save ${title.toLowerCase()}`}
        />
      ) : null}
    </SectionCard>
  );
}
