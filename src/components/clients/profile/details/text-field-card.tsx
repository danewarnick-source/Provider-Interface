// One editable free-text field on the clients row (mailing address, About
// me): read view, pencil, textarea, Save/Cancel. Saves through updateClient.

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { updateClient } from "@/lib/clients/writes.functions";
import { CardShell } from "@/components/clients/profile/cards/card-shell";

export function TextFieldCard({
  orgId,
  clientId,
  field,
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
  title: string;
  subtitle?: string;
  value: string | null;
  empty: string;
  placeholder?: string;
  rows?: number;
  onChanged: () => void;
}) {
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
    <CardShell
      title={title}
      subtitle={subtitle}
      editing={draft !== null}
      onEdit={() => setDraft(value ?? "")}
      onSave={() => draft !== null && save.mutate(draft)}
      onCancel={() => setDraft(null)}
      saving={save.isPending}
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
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </CardShell>
  );
}
