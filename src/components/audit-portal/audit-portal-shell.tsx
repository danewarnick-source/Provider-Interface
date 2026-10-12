import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { PiBrand } from "@/components/brand/pi-brand";
import { PageShell } from "@/components/layout/page-shell";
import { AuthCaptcha, authCaptchaBlocked, readAuthCaptchaToken, resetAuthCaptcha } from "@/components/auth-captcha";
import { AUTH_CAPTCHA_REQUIRED } from "@/lib/auth-captcha";
import { supabase } from "@/integrations/supabase/client";
import { completeClientSignOut } from "@/lib/client-sign-out";
import { useAuth } from "@/hooks/use-auth";
import { getAuditorContext, type AuditorContext } from "@/lib/audit-portal.functions";
import { toast } from "sonner";

interface Props {
  children: (auditor: AuditorContext) => ReactNode;
}

/**
 * Auditor-realm shell. Gates the /audit-portal/* pages behind an active
 * auditor_accounts row. State workers are NOT org users; this UI never
 * shows the org sidebar or nav.
 */
export function AuditPortalShell({ children }: Props) {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const ctxFn = useServerFn(getAuditorContext);
  const ctxQ = useQuery({
    queryKey: ["auditor-context", session?.user?.id ?? null],
    queryFn: () => ctxFn(),
    retry: false,
    enabled: !!session?.user?.id,
  });

  // Realm mutual exclusion: a signed-in user with no active auditor account
  // does NOT belong in the auditor portal — kick them to /dashboard.
  useEffect(() => {
    if (authLoading) return;
    if (!session?.user?.id) return;
    if (ctxQ.isLoading || ctxQ.isFetching) return;
    if (!ctxQ.data) navigate({ to: "/dashboard", replace: true });
  }, [authLoading, session?.user?.id, ctxQ.isLoading, ctxQ.isFetching, ctxQ.data, navigate]);

  if (authLoading || (session?.user?.id && ctxQ.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--hive-canvas)]">
        <div className="text-sm text-muted-foreground">Loading auditor portal…</div>
      </div>
    );
  }

  const auditor = ctxQ.data ?? null;
  if (!session?.user?.id) return <AuditorLoginPanel onSignedIn={() => ctxQ.refetch()} />;
  if (!auditor) {
    // Signed in but not an auditor — redirect in progress; render nothing.
    return null;
  }



  return (
    <div className="min-h-screen bg-[var(--denim-bg)]">
      <header className="denim-glass sticky top-0 z-50 border-x-0 border-t-0">
        <PageShell width="wide" className="flex items-center justify-between gap-4 py-3">
          <Link to="/audit-portal" className="flex items-center gap-3">
            <PiBrand tone="on-light" size="sm" />
            <div className="border-l border-border pl-3">
              <div className="denim-eyebrow">State audit</div>
              <div className="font-display text-base font-bold tracking-[-0.01em] text-deep">Audit portal</div>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="font-medium text-[var(--hive-text)]">{auditor.full_name}</div>
              <div className="text-xs text-muted-foreground">{auditor.agency_name}</div>
            </div>
            <button
              onClick={async () => {
                await completeClientSignOut(() => supabase.auth.signOut());
                window.location.href = "/audit-portal";
              }}
              className="inline-flex min-h-[var(--height-button)] items-center gap-1.5 rounded-full border border-pt2 bg-paper px-3 py-1.5 text-xs font-medium text-pri hover:bg-pt0"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </PageShell>
      </header>
      <PageShell width="wide">{children(auditor)}</PageShell>
    </div>
  );
}

function AuditorLoginPanel({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (authCaptchaBlocked()) {
      setError(AUTH_CAPTCHA_REQUIRED);
      return;
    }
    const captchaToken = readAuthCaptchaToken();
    setSubmitting(true);
    setError(null);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });
      if (signInErr) throw signInErr;
      // Trigger context refetch; if not an active auditor, sign out to avoid
      // stranding an org user in the auditor shell.
      const ctxRes = await fetch("/", { method: "HEAD" }).catch(() => null);
      void ctxRes;
      onSignedIn();
      toast.success("Signed in");
    } catch (err) {
      resetAuthCaptcha();
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(msg);
      await completeClientSignOut(() => supabase.auth.signOut(), { markSignedOut: false }).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-clip bg-[var(--denim-bg)] px-4">
      <div className="denim-field opacity-60" aria-hidden>
        <div className="denim-orb" />
      </div>
      <div className="relative z-[1] w-full max-w-md rounded-[20px] bg-paper p-8 text-ink shadow-[var(--denim-shadow)]">
        <div className="mb-6 flex items-center gap-3">
          <PiBrand tone="on-light" size="md" showText={false} />
          <div>
            <div className="denim-eyebrow">Provider Interface</div>
            <h1 className="font-display text-lg font-bold tracking-[-0.01em] text-deep">State Audit Portal</h1>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-pt2 bg-pt p-3 text-xs text-pri">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <div>
              This is a separate portal for state auditors. Access is provisioned by
              Provider Interface — accounts cannot self-register. If you are an agency staff member,
              use your organization's regular sign-in.
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-pri focus:outline-none focus:ring-[3px] focus:ring-pri/15"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Password</span>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="min-h-[44px] w-full rounded-xl border border-line bg-paper px-3 py-2 pr-10 text-sm text-ink focus:border-pri focus:outline-none focus:ring-[3px] focus:ring-pri/15"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          {error && (
            <div className="rounded-xl bg-danger-50 p-2 text-xs text-danger-700">
              {error}
            </div>
          )}
          <AuthCaptcha />
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full min-h-[44px] items-center justify-center rounded-full bg-pri px-4 py-2 text-sm font-semibold text-white shadow-[var(--denim-btn-shadow)] transition-colors duration-200 ease-denim hover:bg-deep disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in to State Audit Portal"}
          </button>
        </form>
      </div>
    </div>
  );
}
