// Read-only list of the client's active codes next to the plan goals.
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthorizedCodesCard({ clientId, codes }: { clientId: string; codes: string[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Authorized DSPD codes</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link
            to="/dashboard/clients/$clientId"
            params={{ clientId }}
            search={{ section: "services" }}
          >
            Manage in Billing →
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-xs text-muted-foreground">
          Read-only reference. Codes, rates, dates, and staff assignments are managed on the
          Billing tab.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {codes.length === 0 ? (
            <span className="text-muted-foreground">None.</span>
          ) : (
            codes.map((c) => (
              <Badge key={c} variant="outline">
                {c}
              </Badge>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
