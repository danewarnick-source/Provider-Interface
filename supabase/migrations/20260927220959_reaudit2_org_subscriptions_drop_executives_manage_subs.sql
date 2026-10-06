-- Re-audit 2 (HELD, not applied): drop the executive FOR ALL policy on org_subscriptions. Exec reads stay via the
-- existing "executives read all subs" SELECT policy, so no replacement SELECT policy is needed.
-- HELD because createSubscriptionCheckoutFn (src/lib/stripe-checkout.functions.ts) still writes org_subscriptions
-- with the signed-in client; those writes only succeed today when the caller is a Hive exec.
DROP POLICY IF EXISTS "executives manage subs" ON public.org_subscriptions;
