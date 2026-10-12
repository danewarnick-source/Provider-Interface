import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, CreditCard, Loader2, LogOut, Mail } from "lucide-react";
import { PiBrand } from "@/components/brand/pi-brand";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  confirmCheckoutSessionFn,
  createSubscriptionCheckoutFn,
  getBillingStatusFn,
} from "@/lib/stripe-checkout.functions";
import { parseCheckoutReturnSearch } from "@/lib/billing-access";
import {
  isComplimentaryMembership,
  persistActiveOrgId,
  pickUnlockedMembership,
  readStoredActiveOrgId,
  type MembershipPick,
} from "@/lib/current-org";
import { PI_LIST_MINIMUM_LINE, PI_LIST_PRICE_DISPLAY, PI_LIST_PRICE_UNIT, PI_SIGNUP_PRICE_LINE } from "@/lib/pi-landing";
import { quotePiListSubscription } from "@/lib/pi-signup-pricing";
import { completeClientSignOut } from "@/lib/client-sign-out";

export const Route = createFileRoute("/billing-locked")({
  head: () => ({ meta: [{ title: "Account locked — Provider Interface" }] }),
  validateSearch: parseCheckoutReturnSearch,
  component: BillingLockedPage,
});

function BillingLockedPage() {
  const navigate = useNavigate();
  const statusFn = useServerFn(getBillingStatusFn);
  const checkoutFn = useServerFn(createSubscriptionCheckoutFn);
  const confirmFn = useServerFn(confirmCheckoutSessionFn);
  const [busy, setBusy] = useState(false);
  const [staffCount, setStaffCount] = useState(4);
  const [clientCount, setClientCount] = useState(10);
  const [state, setState] = useState<{
    loading: boolean;
    authed: boolean;
    isAdmin: boolean;
    agencyName: string;
    orgId: string | null;
    testMode: boolean;
    paymentsConfigured: boolean;
    paymentsMessage: string | null;
    lockReason: string | null;
    confirmError: string | null;
    workspaces: Array<{ organization_id: string; organization_name: string }>;
  }>({
    loading: true,
    authed: false,
    isAdmin: false,
    agencyName: "your agency",
    orgId: null,
    testMode: false,
    paymentsConfigured: false,
    paymentsMessage: null,
    lockReason: null,
    confirmError: null,
    workspaces: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        if (!cancelled) navigate({ to: "/login" });
        return;
      }

      const returned = parseCheckoutReturnSearch(window.location.search);
      let activeOrgId: string | undefined = readStoredActiveOrgId() ?? undefined;

      // Confirm the Stripe session BEFORE reading lock state. A prior bounce
      // from /dashboard used to drop session_id; when it is present, fulfill
      // first so the next status read sees status=active.
      let confirmError: string | null = null;
      if (returned.session_id) {
        const r = await confirmFn({ data: { sessionId: returned.session_id } }).catch(() => null);
        if (r?.organizationId) {
          activeOrgId = r.organizationId;
          persistActiveOrgId(r.organizationId);
        }
        if (r?.ok && !cancelled) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        if (r && !r.ok && r.error) {
          confirmError = r.error;
        }
      }

      const { data: memberships } = await supabase
        .from("organization_members")
        .select("organization_id, access_level, organizations(name, is_demo, display_acronym)")
        .is("deleted_at", null)
        .eq("user_id", session.user.id)
        .eq("active", true);
      const ms = (memberships ?? []) as Array<{
        organization_id: string;
        access_level: string | null;
        organizations: { name: string | null; is_demo?: boolean | null; display_acronym?: string | null } | null;
      }>;
      if (ms.length === 0) {
        if (!cancelled) navigate({ to: "/login" });
        return;
      }
      const picks: MembershipPick[] = ms.map((row) => ({
        organization_id: row.organization_id,
        is_demo: row.organizations?.is_demo === true,
        access: { level: row.access_level ?? "staff" },
        display_acronym: row.organizations?.display_acronym ?? null,
        organization_name: row.organizations?.name ?? null,
      }));
      const unlocked = pickUnlockedMembership(
        picks,
        (row) => !isComplimentaryMembership(row),
        activeOrgId,
      );
      if (unlocked && isComplimentaryMembership(unlocked) && !returned.session_id) {
        persistActiveOrgId(unlocked.organization_id);
        if (!cancelled) navigate({ to: "/dashboard", replace: true });
        return;
      }

      const readStatus = async () =>
        statusFn({
          data: { organizationId: activeOrgId },
        });

      let status = await readStatus();
      if (status.billingExempt || !status.accessLocked) {
        if (!cancelled) navigate({ to: "/dashboard", replace: true });
        return;
      }

      // Webhook can land a beat after confirm. One fresh re-query, no cache.
      if (returned.session_id) {
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        if (cancelled) return;
        status = await readStatus();
        if (status.billingExempt || !status.accessLocked) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
      }

      const m = ms.find((x) => x.organization_id === (status.organizationId ?? activeOrgId)) ?? ms[0];
      if (!m) {
        if (!cancelled) navigate({ to: "/login" });
        return;
      }
      const workspaces = picks.map((row) => ({
        organization_id: row.organization_id,
        organization_name: row.organization_name || "Workspace",
      }));

      if (cancelled) return;
      setStaffCount(status.staffCount || 4);
      setClientCount(status.clientCount || 0);
      setState({
        loading: false,
        authed: true,
        isAdmin: m.access_level === "owner",
        agencyName: m.organizations?.name ?? status.orgName ?? "your agency",
        orgId: m.organization_id,
        testMode: status.testMode,
        paymentsConfigured: status.paymentsConfigured,
        paymentsMessage: status.paymentsMessage,
        lockReason: status.lockReason,
        confirmError,
        workspaces,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, statusFn, confirmFn]);

  const quote = useMemo(
    () => quotePiListSubscription({ clientCount, interval: "monthly" }),
    [clientCount],
  );

  const switchWorkspace = (orgId: string) => {
    persistActiveOrgId(orgId);
    window.location.assign("/dashboard");
  };

  const signOut = async () => {
    await completeClientSignOut(() => supabase.auth.signOut());
    navigate({ to: "/login", replace: true });
  };

  const pay = async () => {
    if (!state.orgId) return;
    setBusy(true);
    try {
      const r = await checkoutFn({
        data: {
          organizationId: state.orgId,
          staffCount,
          clientCount,
          interval: "monthly",
          pricingModel: "pi_list",
        },
      });
      if (r.exempt) {
        navigate({ to: "/dashboard" });
        return;
      }
      if (r.error || !r.url) {
        setBusy(false);
        return;
      }
      window.location.href = r.url;
    } catch {
      setBusy(false);
    }
  };

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--denim-bg)] px-4 text-ink">
        <p className="text-sm text-muted-foreground">Loading account status…</p>
      </div>
    );
  }

  const unpaid = /payment required/i.test(state.lockReason ?? "");

  return (
    <div
      className="relative min-h-screen overflow-x-clip bg-[var(--denim-bg)] px-4 py-12 text-ink"
      data-testid="billing-paywall"
    >
      <div className="denim-field" aria-hidden>
        <div className="denim-orb" />
      </div>
      <div className="relative z-[1] mx-auto flex max-w-xl flex-col items-center rounded-[20px] bg-paper px-6 py-10 text-center shadow-[var(--denim-shadow)] sm:px-10">
        <div className="mb-6">
          <PiBrand tone="on-light" size="lg" />
        </div>

        <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-deep sm:text-3xl">
          {unpaid ? "Finish payment to use Provider Interface" : "Your agency's account is currently locked"}
        </h1>
        <p className="mt-3 text-body">
          {unpaid
            ? `${state.agencyName} needs an active Provider Interface subscription before anyone can use the dashboard.`
            : `${state.agencyName}'s account is locked until billing is current.`}
        </p>

        {state.confirmError && (
          <div
            role="alert"
            data-testid="checkout-confirm-error"
            className="mt-6 w-full rounded-xl border border-danger-600/25 bg-danger-50 px-4 py-3 text-left text-sm text-danger-700"
          >
            {state.confirmError}
          </div>
        )}

        {unpaid && state.testMode && (
          <div
            className="mt-6 w-full rounded-xl border border-warning-700/25 bg-warning-50 px-4 py-3 text-left text-sm text-warning-700"
            data-testid="stripe-test-mode-hint"
          >
            <strong>TEST MODE</strong> — no real charge. Use card 4242 4242 4242 4242, any future
            expiry, any CVC, any ZIP.
          </div>
        )}

        {!unpaid ? (
          <div className="mt-8 w-full rounded-[var(--denim-r)] border border-line bg-pt0 px-6 py-5 text-left text-sm text-body">
            Contact us to reactivate.
          </div>
        ) : state.isAdmin ? (
          <div className="mt-8 w-full space-y-3 text-left">
            {!state.paymentsConfigured && (
              <div className="rounded-xl border border-danger-600/25 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                {state.paymentsMessage ??
                  "Payments are not set up yet. An Exec needs to add the Stripe test keys."}
              </div>
            )}
            <div
              className="rounded-[var(--denim-r)] border border-line bg-pt0 px-4 py-3"
              data-testid="pricing-schedule"
            >
              <div className="denim-eyebrow">List rate</div>
              <div className="mt-1 font-display text-2xl font-bold text-deep">
                {PI_LIST_PRICE_DISPLAY}
                <span className="font-sans text-base font-normal text-muted-foreground"> {PI_LIST_PRICE_UNIT}</span>
              </div>
              <p className="mt-1 text-sm text-body">{PI_LIST_MINIMUM_LINE}</p>
              <p className="mt-1 text-sm text-body">{quote.summaryLine}</p>
              <p className="mt-1 text-xs text-muted-foreground">{PI_SIGNUP_PRICE_LINE}</p>
            </div>
            <label className="text-xs font-medium text-muted-foreground">
              Clients
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-pri focus:ring-[3px] focus:ring-pri/15"
                value={clientCount}
                onChange={(e) => setClientCount(Number(e.target.value) || 0)}
              />
            </label>
            <Button
              size="lg"
              data-testid="pay-with-stripe"
              disabled={busy || !state.paymentsConfigured}
              onClick={pay}
              className="w-full rounded-full bg-pri text-white shadow-[var(--denim-btn-shadow)] hover:bg-deep"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Pay with Stripe
            </Button>
            <Button asChild variant="ghost" className="w-full rounded-full text-pri hover:bg-pt hover:text-pri">
              <Link to="/dashboard/billing/subscription">Open subscription page</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 w-full rounded-[var(--denim-r)] border border-line bg-pt0 px-6 py-5 text-left text-sm text-body">
            Please contact your agency administrator to restore access.
          </div>
        )}

        {state.workspaces.length > 1 && (
          <div className="mt-8 w-full space-y-2 text-left" data-testid="billing-lock-org-switcher">
            <p className="denim-eyebrow">Switch agency</p>
            {state.workspaces.map((w) => {
              const isCurrent = w.organization_id === state.orgId;
              return (
                <Button
                  key={w.organization_id}
                  type="button"
                  variant="outline"
                  disabled={isCurrent}
                  onClick={() => switchWorkspace(w.organization_id)}
                  className="w-full justify-start rounded-full border-pt2 bg-paper text-ink hover:bg-pt0 hover:text-ink"
                >
                  <Building2 className="mr-2 h-4 w-4 opacity-70" />
                  <span className="truncate">{w.organization_name}</span>
                  {isCurrent ? <span className="ml-auto text-xs text-muted-foreground">Current</span> : null}
                </Button>
              );
            })}
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          data-testid="billing-lock-sign-out"
          onClick={() => void signOut()}
          className="mt-6 w-full rounded-full text-pri hover:bg-pt hover:text-pri"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>

        <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <a href="mailto:support@hive.app" className="hover:text-pri">
            support@hive.app
          </a>
        </div>
      </div>
    </div>
  );
}
