// ClientPhotoCard — mounts <PhotoUpload> against the client-photos bucket
// and persists to clients.client_photo_url + clients.client_photo_taken_on.
// Shows the date taken (editable) and warns once the photo is 5+ years old.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { useAccess } from "@/hooks/use-access";
import { Input } from "@/components/ui/input";
import { PhotoUpload } from "@/components/person/photo-upload";
import { formatDate, todayYmd } from "@/lib/clients/dates";
import { photoStatus } from "@/lib/clients/readiness";
import { updateClient } from "@/lib/clients/writes.functions";
import { SectionCard } from "@/components/clients/profile/cards/section-card";

type Patch = { client_photo_url?: string | null; client_photo_taken_on?: string | null };

export function ClientPhotoCard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: org } = useCurrentOrg();
  const canEdit = useAccess().canCategory("clients", "edit");
  const orgId = org?.organization_id ?? null;
  const [editingDate, setEditingDate] = useState(false);

  const q = useQuery({
    queryKey: ["client-photo-card", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("first_name, last_name, client_photo_url, client_photo_taken_on")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const updateClientFn = useServerFn(updateClient);
  const persist = useMutation({
    mutationFn: async (patch: Patch) => {
      if (!orgId) throw new Error("No organization selected.");
      await updateClientFn({ data: { organizationId: orgId, clientId, patch } });
    },
    onSuccess: () => {
      setEditingDate(false);
      qc.invalidateQueries({ queryKey: ["client-photo-card", clientId] });
      qc.invalidateQueries({ queryKey: ["client-face-sheet-info", clientId] });
      qc.invalidateQueries({ queryKey: ["client-profile"] });
      // Any workspace/header queries that read the photo — refresh broadly.
      qc.invalidateQueries({ queryKey: ["client-workspace"] });
      qc.invalidateQueries({ queryKey: ["caseload"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const c = q.data;
  const name = c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : null;
  const currentPath = (c?.client_photo_url ?? null) as string | null;
  const takenOn = (c?.client_photo_taken_on ?? null) as string | null;
  const status = photoStatus({ url: currentPath, takenOn });

  return (
    <SectionCard
      icon={Camera}
      tone="profile"
      title="Photo"
      description="Used on the face sheet. Recent and front-facing. Retake every 5 years."
      testId="client-photo-card"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          {currentPath ? (
            editingDate ? (
              <Input
                type="date"
                className="h-10 w-44"
                aria-label="Date taken"
                defaultValue={takenOn ?? ""}
                onBlur={(e) => persist.mutate({ client_photo_taken_on: e.target.value || null })}
              />
            ) : (
              <p className="text-sm">
                Taken {takenOn ? formatDate(takenOn) : "on an unknown date"}
                {canEdit ? (
                  <button
                    type="button"
                    className="ml-2 font-medium text-[var(--hive-info-fg)] hover:underline"
                    onClick={() => setEditingDate(true)}
                  >
                    Change date taken
                  </button>
                ) : null}
              </p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">No photo yet.</p>
          )}
          {status === "old" ? (
            <p
              className="flex items-center gap-1 text-xs font-medium text-[var(--hive-danger-fg)]"
              data-testid="client-photo-old"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Over 5 years old. Take a new photo.
            </p>
          ) : null}
        </div>
        {orgId ? (
          <PhotoUpload
            bucket="client-photos"
            organizationId={orgId}
            subjectId={clientId}
            currentPath={currentPath}
            personName={name}
            onUploaded={async (path) => {
              await persist.mutateAsync({
                client_photo_url: path,
                client_photo_taken_on: todayYmd(),
              });
            }}
            onCleared={async () => {
              await persist.mutateAsync({ client_photo_url: null, client_photo_taken_on: null });
            }}
          />
        ) : (
          <p className="text-xs text-muted-foreground">Loading…</p>
        )}
      </div>
    </SectionCard>
  );
}
