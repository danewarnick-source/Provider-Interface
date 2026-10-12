import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Shield, ShieldAlert, HelpCircle } from "lucide-react";
import { RequireHiveExecutive } from "@/components/hive-executive-guard";
import { EXEC_NAV } from "@/lib/exec-nav";
import { useCapability } from "@/hooks/use-exec-capability";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SteveDockPanel } from "@/components/hive-exec/command/steve-panel";
import { OpenCompanyViews } from "@/components/hive-exec/open-company-views";

export const Route = createFileRoute("/dashboard/hive-exec")({
  head: () => ({ meta: [{ title: "Executive Command Center — Provider Interface" }] }),
  component: () => (
    <RequireHiveExecutive>
      <ExecCommandCenterLayout />
    </RequireHiveExecutive>
  ),
});

function ExecCommandCenterLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Match current path to a nav entry to bias Steve's retrieval.
  const currentNav = useMemo(
    () => EXEC_NAV.find((i) => (i.exact ? pathname === i.to : pathname.startsWith(i.to))) ?? null,
    [pathname],
  );
  const { allowed: steveAllowed } = useCapability("steve.use");
  const [guideOpen, setGuideOpen] = useState(false);


  return (
    <div className="space-y-4">
      <header className="denim-band rounded-[24px] p-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--hive-accent)] text-white">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.1em] text-accl">
                PI Platform · Executive Command Center
              </div>
              <h1 className="font-display text-xl font-bold tracking-tight">Platform operations</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {steveAllowed && (
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full bg-acc text-white hover:bg-accd"
                onClick={() => setGuideOpen(true)}
              >
                <HelpCircle className="mr-1 h-3.5 w-3.5" /> Guide me
              </Button>
            )}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-ondark">
              <ShieldAlert className="h-3.5 w-3.5" />
              Account &amp; billing only — no client records or PHI
            </div>
          </div>
        </div>
        <div className="mt-3 text-white">
          <OpenCompanyViews tone="dark" />
        </div>
      </header>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Guide me{currentNav ? ` · ${currentNav.label}` : ""}
            </DialogTitle>
          </DialogHeader>
          <SteveDockPanel
            routeContext={currentNav?.to ?? pathname}
            featureKeyContext={currentNav?.capability ?? null}
            expanded
          />
        </DialogContent>
      </Dialog>


      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
