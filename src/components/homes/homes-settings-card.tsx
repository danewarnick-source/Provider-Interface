// The Homes card on the Settings page; opens Settings › Homes. Shown to those
// who can see homes (home-setup.ts homesAccess).
import { Link } from "@tanstack/react-router";
import { ArrowRight, Home } from "lucide-react";
import { useHomesAccess } from "./use-homes";

export function HomesSettingsCard() {
  if (!useHomesAccess().canView) return null;
  return (
    <Link
      to="/dashboard/settings/homes"
      className="group lg:col-span-2"
      data-testid="settings-homes-card"
    >
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition hover:border-primary/40 hover:bg-[var(--hive-hover)]">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Homes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each home's kind, lead or host, address, capacity and staffing needs. Clients, the
              scheduler and Finances read them from here.
            </p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </Link>
  );
}
