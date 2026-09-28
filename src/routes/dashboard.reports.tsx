import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-org";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, FileBarChart } from "lucide-react";
import { toast } from "sonner";

import { RequirePermission } from "@/components/rbac-guard";
import { BehaviorSupportsReport } from "@/components/behavior-support/behavior-supports-report";

export const Route = createFileRoute("/dashboard/reports")({
  component: () => (
    <RequirePermission perm="export_reports">
      <ReportsPage />
    </RequirePermission>
  ),
});

function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-semibold">Audit-ready reports</h2>
        <p className="text-sm text-muted-foreground">
          Export compliance evidence as CSV or PDF anytime.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Training exports use assignments on the team member record. Certificates live in Evidence.
        </p>
      </div>
      <Tabs defaultValue="standard">
        <TabsList>
          <TabsTrigger value="standard">Standard Reports</TabsTrigger>
          <TabsTrigger value="behavior">Behavior Supports</TabsTrigger>
        </TabsList>
        <TabsContent value="standard" className="mt-4">
          <StandardReports />
        </TabsContent>
        <TabsContent value="behavior" className="mt-4">
          <BehaviorSupportsReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StandardReports() {
  const { data: org } = useCurrentOrg();

  const { data: staffTraining } = useQuery({
    enabled: !!org,
    queryKey: ["report-staff-training", org?.organization_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_other_assignments")
        .select("staff_id, title, status, completed_at, due_date, assignment_type")
        .eq("organization_id", org!.organization_id)
        .eq("assignment_type", "training");
      return data ?? [];
    },
  });

  const staffTrainingUserIds = useMemo(
    () => [...new Set((staffTraining ?? []).map((r) => r.staff_id).filter(Boolean))],
    [staffTraining],
  );
  const { data: staffTrainingProfiles } = useQuery({
    enabled: staffTrainingUserIds.length > 0,
    queryKey: ["report-staff-training-profiles", staffTrainingUserIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", staffTrainingUserIds as string[]);
      return data ?? [];
    },
  });
  const staffTrainingNameMap = useMemo(
    () =>
      new Map(
        (staffTrainingProfiles ?? []).map((p) => [
          p.id,
          p.full_name ?? p.email ?? p.id.slice(0, 8),
        ]),
      ),
    [staffTrainingProfiles],
  );

  const download = (
    filename: string,
    headers: string[],
    rows: Array<Array<string | number | null>>,
  ) => {
    const all = [headers, ...rows];
    const csv = all
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const today = new Date().toISOString().slice(0, 10);
  const nameOf = (staffId: string) => staffTrainingNameMap.get(staffId) ?? staffId;

  const exportAssignedTraining = () => {
    const list = staffTraining ?? [];
    if (!list.length) return toast.error("No assigned training to export yet");
    download(
      "assigned-training",
      ["team_member", "title", "status", "due_date", "completed_at"],
      list.map((a) => [
        nameOf(a.staff_id),
        a.title,
        a.status,
        a.due_date ?? "",
        a.completed_at ?? "",
      ]),
    );
  };

  const exportCompletedTraining = () => {
    const list = (staffTraining ?? []).filter((a) => a.status === "completed" || !!a.completed_at);
    if (!list.length) return toast.error("No completed training to export yet.");
    download(
      "training-completion",
      ["team_member", "title", "completed_at"],
      list.map((a) => [nameOf(a.staff_id), a.title, a.completed_at ?? ""]),
    );
  };

  const exportOverdueTraining = () => {
    const list = (staffTraining ?? []).filter((a) => {
      if (a.status === "completed" || a.completed_at) return false;
      return !!a.due_date && a.due_date.slice(0, 10) < today;
    });
    if (!list.length) return toast.error("No overdue training to export — nothing is past due");
    download(
      "overdue-training",
      ["team_member", "title", "status", "due_date"],
      list.map((a) => [nameOf(a.staff_id), a.title, a.status, a.due_date ?? ""]),
    );
  };

  const reports = [
    {
      name: "Assigned training",
      desc: "Training assignments on the team member record.",
      onExport: exportAssignedTraining,
    },
    {
      name: "Training completion",
      desc: "Completed training on the team member record.",
      onExport: exportCompletedTraining,
    },
    {
      name: "Overdue training",
      desc: "Team member training past its due date.",
      onExport: exportOverdueTraining,
    },
  ];

  return (
    <div className="grid gap-3">
      {reports.map((r) => (
        <div
          key={r.name}
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <FileBarChart className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={r.onExport}>
            <FileDown className="mr-2 h-3.5 w-3.5" /> Download CSV
          </Button>
        </div>
      ))}
    </div>
  );
}
