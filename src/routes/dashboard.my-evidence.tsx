import { createFileRoute } from "@tanstack/react-router";
import { StaffEvidenceList } from "@/components/evidence/staff-evidence-list";
import { StaffPageHeader } from "@/components/staff-mobile/staff-page-header";

export const Route = createFileRoute("/dashboard/my-evidence")({
  head: () => ({ meta: [{ title: "Evidence — Provider Interface" }] }),
  component: MyEvidencePage,
});

function MyEvidencePage() {
  return (
    <div className="space-y-4">
      <StaffPageHeader
        eyebrow="Evidence"
        title="Sent to you"
        subtitle="Upload or attest only the items admin sent to this phone."
      />
      <StaffEvidenceList />
    </div>
  );
}
