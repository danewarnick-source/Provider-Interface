// Active rights restrictions with their 8-element documentation count.
// Full editing lives on the HRC card and the Human Rights Committee page.

import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeRestrictionCompletion, type RestrictionRecord } from "@/lib/clients/hrc";

export function RightsRestrictionsPanel({ clientId }: { clientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["client-restrictions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hrc_restriction_records" as never)
        .select("*")
        .eq("client_id", clientId)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RestrictionRecord[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rights restrictions</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !data?.length ? (
          <div className="text-sm text-muted-foreground">
            No active rights restrictions on file.
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((r) => {
              const completion = computeRestrictionCompletion(r);
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{r.restriction_title}</span>
                  <Badge
                    variant={completion.isComplete ? "default" : "outline"}
                    className={
                      completion.isComplete
                        ? "shrink-0 bg-emerald-600 hover:bg-emerald-600"
                        : "shrink-0 border-amber-400 text-amber-800"
                    }
                  >
                    {completion.completedCount}/{completion.total} documented
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Full 8-element documentation is managed on the{" "}
          <Link className="underline" to="/dashboard/hrc">
            Human Rights Committee page
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
