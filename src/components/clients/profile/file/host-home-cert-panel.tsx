// Host-home certifications on file for this client (Client file section).

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReadOnlyTable } from "@/components/clients/profile/read-only-table";

export function HostHomeCertPanel({ clientId, orgId }: { clientId: string; orgId?: string }) {
  const q = useQuery({
    enabled: !!orgId,
    queryKey: ["client-profile-hhcert", orgId, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("host_home_certifications")
        .select("id, inspection_date, next_due_date, determination, inspector_name, cert_type")
        .eq("organization_id", orgId!)
        .eq("client_id", clientId)
        .order("inspection_date", { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Host-home certifications</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ReadOnlyTable
          loading={q.isLoading}
          empty="No host-home certifications on file."
          rows={q.data ?? []}
          columns={[
            { header: "Inspection", cell: (r) => r.inspection_date ?? "—" },
            { header: "Cert type", cell: (r) => r.cert_type ?? "—" },
            { header: "Next due", cell: (r) => r.next_due_date ?? "—" },
            {
              header: "Determination",
              cell: (r) => <Badge variant="outline">{r.determination ?? "—"}</Badge>,
            },
            { header: "Inspector", cell: (r) => r.inspector_name ?? "—" },
          ]}
        />
      </CardContent>
    </Card>
  );
}
