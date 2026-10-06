// StaffPhotoCard — the team member photo. Read-only outside Edit. While
// editing, <PhotoUpload> stores the file (PNG or JPEG) in staff-photos and hands
// the path back; the profile's Save sends it through updateTeamMember. Nothing
// here writes to profiles.

import { PhotoUpload } from "@/components/person/photo-upload";

export function StaffPhotoCard({
  orgId,
  staffId,
  name,
  photoPath,
  editing = false,
  onChange,
}: {
  orgId: string;
  staffId: string;
  name: string | null;
  photoPath: string | null;
  editing?: boolean;
  onChange: (path: string | null) => void;
}) {
  return (
    <PhotoUpload
      bucket="staff-photos"
      organizationId={orgId}
      subjectId={staffId}
      currentPath={photoPath}
      personName={name}
      avatarClassName="h-28 w-28 text-2xl sm:h-36 sm:w-36 sm:text-3xl"
      className="flex flex-col items-start gap-3"
      readOnly={!editing}
      imageTypes={["image/png", "image/jpeg"]}
      deferSave
      onUploaded={(path) => onChange(path)}
      onCleared={() => onChange(null)}
    />
  );
}
