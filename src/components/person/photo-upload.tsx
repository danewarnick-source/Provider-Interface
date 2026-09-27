import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload, Trash2 } from "lucide-react";
import { safeErrorMessage } from "@/lib/safe-error-message";
import { PersonAvatar } from "./person-avatar";

/**
 * Uploads a photo into a private org-scoped bucket at
 * `{organizationId}/{subjectId}/photo-{timestamp}.{ext}` and calls back
 * with the storage path so the caller can persist it on its own record
 * (clients.client_photo_url / profiles.photo_path / organization_branding.logo_path).
 *
 * The bucket's RLS on storage.objects gates who can write; if the write
 * fails, we surface the DB error verbatim so admins see it.
 */
type Bucket = "client-photos" | "staff-photos" | "org-branding";

type ImageType = "image/jpeg" | "image/png" | "image/webp";

const IMAGE_EXT: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function sniffImageType(file: File): Promise<ImageType | null> {
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function PhotoUpload({
  bucket,
  organizationId,
  subjectId,
  currentPath,
  personName,
  onUploaded,
  onCleared,
  label = "Upload photo",
  avatarClassName = "h-16 w-16",
  readOnly = false,
  className = "flex items-center gap-3",
}: {
  bucket: Bucket;
  organizationId: string;
  subjectId: string;
  currentPath: string | null | undefined;
  personName?: string | null;
  onUploaded: (path: string) => Promise<void> | void;
  onCleared?: () => Promise<void> | void;
  label?: string;
  avatarClassName?: string;
  readOnly?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const displayBucket: "client-photos" | "staff-photos" =
    bucket === "staff-photos" ? "staff-photos" : "client-photos";

  const upload = async (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Photo must be under 8 MB");
      return;
    }
    const imageType = await sniffImageType(file);
    if (!imageType) {
      toast.error("Photo must be a JPEG, PNG, or WebP file");
      return;
    }
    setBusy(true);
    try {
      const path = `${organizationId}/${subjectId}/photo-${Date.now()}.${IMAGE_EXT[imageType]}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: imageType });
      if (error) throw error;
      await onUploaded(path);
      toast.success("Photo saved");
    } catch (e) {
      toast.error(safeErrorMessage(e, "Upload failed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      {bucket === "org-branding" ? null : (
        <PersonAvatar
          bucket={displayBucket}
          path={currentPath ?? null}
          name={personName ?? null}
          className={avatarClassName}
        />
      )}
      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {busy ? "Uploading…" : label}
          </Button>
          {currentPath && onCleared ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await supabase.storage.from(bucket).remove([currentPath]);
                  await onCleared();
                  toast.success("Photo removed");
                } catch (e) {
                  toast.error(safeErrorMessage(e, "Remove failed"));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
