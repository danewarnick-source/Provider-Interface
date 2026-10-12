import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthCaptcha, authCaptchaBlocked, readAuthCaptchaToken, resetAuthCaptcha } from "@/components/auth-captcha";
import { AUTH_CAPTCHA_REQUIRED } from "@/lib/auth-captcha";
import { supabase } from "@/integrations/supabase/client";
import { completeClientSignOut } from "@/lib/client-sign-out";
import { toast } from "sonner";
import { AuthShell } from "./login";
import { levelInvitePhrase } from "@/lib/access/levels";
import {
  extractInviteToken,
  humanizeInviteError,
  inviteFailureMessage,
  isValidExistingJoinPassword,
  isValidJoinPassword,
  isValidJoinUsername,
  JOIN_PASSWORD_HINT,
  JOIN_PASSWORD_MIN_LENGTH,
  JOIN_PASSWORD_TOO_SHORT,
  JOIN_USERNAME_HINT,
  JOIN_USERNAME_INVALID,
  joinConfirmLiveMessage,
  joinHomeForLevel,
  joinPasswordLiveMessage,
  joinSetsAuthPassword,
  joinUsernameLiveMessage,
  suggestJoinUsername,
} from "@/lib/join-invite";
import {
  previewInvitation,
  prepareInviteAccount,
  type InvitePreview,
} from "@/lib/join-invite.functions";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join your provider — Provider Interface" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { invite?: string; token?: string } => {
    const invite = typeof s.invite === "string" && s.invite.trim() ? s.invite : undefined;
    const token = typeof s.token === "string" && s.token.trim() ? s.token : undefined;
    return { ...(invite ? { invite } : {}), ...(token ? { token } : {}) };
  },
  component: JoinPage,
});

const fieldClass =
  "flex h-12 w-full rounded-xl border border-line bg-paper px-3 py-2 text-base text-ink outline-none transition-[border-color,box-shadow] duration-200 ease-denim placeholder:text-muted-foreground focus:border-pri focus:ring-[3px] focus:ring-pri/15";

function JoinPage() {
  const search = Route.useSearch();
  const token = extractInviteToken(search);
  const previewFn = useServerFn(previewInvitation);
  const prepareFn = useServerFn(prepareInviteAccount);

  const [preview, setPreview] = useState<InvitePreview | null>(
    token ? null : { ok: false, reason: "missing", message: inviteFailureMessage("missing") },
  );
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await previewFn({ data: { token } });
        if (!cancelled) setPreview(r);
      } catch (e) {
        if (!cancelled) {
          setPreview({
            ok: false,
            reason: "unknown",
            message: humanizeInviteError(e),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // previewFn is a stable server-fn wrapper; token is the only input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!preview || preview.ok !== true || preview.has_username || usernameTouched) return;
    const suggested = suggestJoinUsername(preview.email);
    if (suggested) setUsername(suggested);
  }, [preview, usernameTouched]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token || !preview || preview.ok !== true) return;
    if (preview.needs_name && !fullName.trim()) {
      return toast.error("Please enter your name.");
    }
    if (!preview.has_username && !isValidJoinUsername(username)) {
      return toast.error(JOIN_USERNAME_INVALID);
    }
    if (
      joinSetsAuthPassword(preview.account_exists, {
        mustChangePassword: preview.must_change_password,
      })
    ) {
      if (!isValidJoinPassword(password)) {
        return toast.error(JOIN_PASSWORD_TOO_SHORT);
      }
    } else if (!isValidExistingJoinPassword(password)) {
      return toast.error("Enter the password you already use to sign in.");
    }
    if (password !== confirm) return toast.error("Passwords don't match.");
    if (authCaptchaBlocked()) return toast.error(AUTH_CAPTCHA_REQUIRED);
    const captchaToken = readAuthCaptchaToken();

    setBusy(true);
    try {
      const { data: existingSession } = await supabase.auth.getSession();
      const signedInEmail = existingSession.session?.user?.email?.toLowerCase() ?? "";
      if (signedInEmail && signedInEmail !== preview.email.toLowerCase()) {
        await completeClientSignOut(() => supabase.auth.signOut(), { markSignedOut: false });
      }

      const prepared = await prepareFn({
        data: {
          token,
          password,
          username: preview.has_username ? undefined : username.trim(),
          full_name: preview.needs_name ? fullName.trim() : undefined,
        },
      });

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: prepared.email,
        password,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });
      if (signErr) throw new Error(humanizeInviteError(signErr.message));

      const { error: rpcErr } = await supabase.rpc("accept_invitation", { _token: token });
      if (rpcErr) throw new Error(humanizeInviteError(rpcErr.message));

      toast.success(`You're in — welcome to ${prepared.org_name}.`);
      window.location.replace(joinHomeForLevel(prepared.level, prepared.home));
    } catch (err) {
      resetAuthCaptcha();
      toast.error(humanizeInviteError(err));
    } finally {
      setBusy(false);
    }
  };

  if (!preview) {
    return (
      <AuthShell title="Checking your invitation…" subtitle="Hang tight for a moment.">
        <div className="flex justify-center py-6" data-testid="join-loading">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AuthShell>
    );
  }

  if (preview.ok === false) {
    return (
      <AuthShell
        title="This invitation can't be used"
        subtitle="You were not sent to start a new company."
      >
        <div
          className="rounded-[var(--denim-r)] border border-line bg-pt0 p-4 text-sm text-ink"
          data-testid="join-error"
        >
          <p>{preview.message}</p>
          <p className="mt-3 text-muted-foreground">
            If you already have a login, you can{" "}
            <Link to="/login" className="font-medium text-pri hover:underline">
              sign in
            </Link>
            . Don't create a new agency from this link.
          </p>
        </div>
      </AuthShell>
    );
  }

  const rolePhrase = levelInvitePhrase(preview.level);
  const setsNewPassword = joinSetsAuthPassword(preview.account_exists, {
    mustChangePassword: preview.must_change_password,
  });
  const suggestedUsername = preview.has_username ? "" : suggestJoinUsername(preview.email);
  const usernameLive = joinUsernameLiveMessage(username);
  const passwordLive = setsNewPassword
    ? joinPasswordLiveMessage(password)
    : password.length > 0
      ? { ok: true, text: "Ready to check this password against your existing sign-in." }
      : null;
  const confirmLive = joinConfirmLiveMessage(password, confirm);
  const usernameOk = preview.has_username || isValidJoinUsername(username);
  const passwordOk = setsNewPassword
    ? isValidJoinPassword(password)
    : isValidExistingJoinPassword(password);
  const matchOk = password.length > 0 && password === confirm;
  const nameOk = !preview.needs_name || !!fullName.trim();
  const canJoin = nameOk && usernameOk && passwordOk && matchOk && !busy;

  return (
    <AuthShell
      title={`Join ${preview.org_name}`}
      subtitle={
        setsNewPassword
          ? `You've been invited as ${rolePhrase}. Set how you'll sign in — this is not a new company.`
          : `You've been invited as ${rolePhrase}. Use the password you already sign in with — this is not a new company.`
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" data-testid="join-form">
        <div className="grid gap-2">
          <Label htmlFor="join-email" className="text-ink">
            Email
          </Label>
          <input
            id="join-email"
            name="email"
            type="email"
            value={preview.email}
            readOnly
            autoComplete="email"
            className={`${fieldClass} bg-pt0`}
          />
        </div>
        {preview.needs_name && (
          <div className="grid gap-2">
            <Label htmlFor="join-name" className="text-ink">
              Your name
            </Label>
            <input
              id="join-name"
              name="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
              className={fieldClass}
            />
          </div>
        )}
        {!preview.has_username && (
          <div className="grid gap-2">
            <Label htmlFor="join-username" className="text-ink">
              Username
            </Label>
            <input
              id="join-username"
              name="username"
              value={username}
              onChange={(e) => {
                setUsernameTouched(true);
                setUsername(e.target.value);
              }}
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={fieldClass}
              aria-describedby="join-username-hint join-username-live"
            />
            <p
              id="join-username-hint"
              className="text-xs text-muted-foreground"
              data-testid="join-username-hint"
            >
              {JOIN_USERNAME_HINT}
            </p>
            {suggestedUsername && suggestedUsername !== username.trim().toLowerCase() && (
              <button
                type="button"
                data-testid="join-username-suggest"
                onClick={() => {
                  setUsernameTouched(true);
                  setUsername(suggestedUsername);
                }}
                className="text-left text-xs font-medium text-pri hover:text-deep hover:underline"
              >
                Use email as username: {suggestedUsername}
              </button>
            )}
            <LiveLine id="join-username-live" testId="join-username-live" status={usernameLive} />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="join-password" className="text-ink">
            {setsNewPassword ? "Password" : "Password you already use"}
          </Label>
          <PasswordInput
            id="join-password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={setsNewPassword ? JOIN_PASSWORD_MIN_LENGTH : undefined}
            autoComplete={setsNewPassword ? "new-password" : "current-password"}
            className={fieldClass}
            aria-describedby="join-password-hint join-password-live"
          />
          {setsNewPassword ? (
            <p
              id="join-password-hint"
              className="text-xs text-muted-foreground"
              data-testid="join-password-hint"
            >
              {JOIN_PASSWORD_HINT}
            </p>
          ) : (
            <p
              id="join-password-hint"
              className="text-xs text-muted-foreground"
              data-testid="join-password-hint"
            >
              This does not change your password. Use the same one you use on the sign-in page.
            </p>
          )}
          {setsNewPassword && (
            <ul
              className="grid gap-1"
              data-testid="join-password-rules"
              aria-label="Password requirements"
            >
              <JoinRule ok={isValidJoinPassword(password)} idle={password.length === 0}>
                At least {JOIN_PASSWORD_MIN_LENGTH} characters
              </JoinRule>
            </ul>
          )}
          <LiveLine id="join-password-live" testId="join-password-live" status={passwordLive} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="join-confirm" className="text-ink">
            Confirm password
          </Label>
          <PasswordInput
            id="join-confirm"
            name="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete={setsNewPassword ? "new-password" : "current-password"}
            className={fieldClass}
            aria-describedby="join-confirm-live"
          />
          <p className="text-xs text-muted-foreground" data-testid="join-confirm-hint">
            Re-enter the same password so we can check they match.
          </p>
          <LiveLine id="join-confirm-live" testId="join-confirm-live" status={confirmLive} />
        </div>
        <AuthCaptcha />
        <Button
          type="submit"
          disabled={!canJoin}
          className="h-11 rounded-full bg-pri text-white shadow-[var(--denim-btn-shadow)] hover:bg-deep disabled:opacity-50"
        >
          {busy ? "Joining…" : `Join ${preview.org_name}`}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Already on this team?{" "}
          <Link to="/login" className="text-pri hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function LiveLine({
  id,
  testId,
  status,
}: {
  id: string;
  testId: string;
  status: { ok: boolean; text: string } | null;
}) {
  if (!status) return <div id={id} data-testid={testId} className="sr-only" />;
  return (
    <div
      id={id}
      data-testid={testId}
      role="status"
      aria-live="polite"
      className={`text-xs font-medium ${status.ok ? "text-accd" : "text-danger-700"}`}
    >
      {status.text}
    </div>
  );
}

function JoinRule({ ok, idle, children }: { ok: boolean; idle: boolean; children: ReactNode }) {
  const color = idle
    ? "var(--denim-text)"
    : ok
      ? "var(--denim-accd)"
      : "var(--hive-danger-fg)";
  return (
    <li className="flex items-center gap-2 text-xs" style={{ color }}>
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
        style={{ background: ok && !idle ? "var(--denim-acct)" : "var(--denim-pt)" }}
      >
        {ok && !idle ? <Check className="h-3 w-3" /> : "•"}
      </span>
      {children}
    </li>
  );
}
