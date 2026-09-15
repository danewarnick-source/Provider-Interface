# HIVE Feature Inventory — Part 1
> Generated from live codebase read (read-only). All citations anchored to file:line.

---

## 1. Routes & Pages

### Public / Auth routes

- **`/`** — `src/routes/index.tsx:34` — `createFileRoute("/")` — Landing page (marketing site: hero, features, pricing, testimonials). Component: inline JSX (landing sections). confirmed-from-code.
- **`/login`** — `src/routes/login.tsx:14` — `createFileRoute("/login")` — Email/password login form + OAuth entry. Also exports `AuthShell` (line 300). confirmed-from-code.
- **`/signup`** — `src/routes/signup.tsx:15` — `createFileRoute("/signup")` — Org sign-up / invitation acceptance (search params include invite token). confirmed-from-code.
- **`/forgot-password`** — `src/routes/forgot-password.tsx:10` — `createFileRoute("/forgot-password")` — Email field for password-reset link. confirmed-from-code.
- **`/reset-password`** — `src/routes/reset-password.tsx:10` — `createFileRoute("/reset-password")` — New-password form, redirected to automatically when `must_change_password = true`. confirmed-from-code.
- **`/unauthorized`** — `src/routes/unauthorized.tsx:5` — `createFileRoute("/unauthorized")` — "Not authorized" message with link back. confirmed-from-code.
- **`/auditor`** — `src/routes/auditor.tsx:38` — `createFileRoute("/auditor")` — External auditor portal (token-gated read-only audit packet view). confirmed-from-code.
- **`/certificate.$code`** — `src/routes/certificate.$code.tsx` — Public certificate verification page keyed by verification code. confirmed-from-code.
- **`/contact`** — `src/routes/contact.tsx` — Marketing contact form. confirmed-from-code.
- **`/pricing`** — `src/routes/pricing.tsx` — Marketing pricing page. confirmed-from-code.
- **`/verify.$code`** — `src/routes/verify.$code.tsx` — Email verification handler. confirmed-from-code.
- **`/fix-admin`** — `src/routes/fix-admin.tsx` — Internal utility for fixing admin access. confirmed-from-code.

### Dashboard shell & pages
- Detailed inventory retained in HIVE repository audits.
