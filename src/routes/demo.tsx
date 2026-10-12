import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Calendar, CheckCircle2 } from "lucide-react";
import { PiBrand } from "@/components/brand/pi-brand";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Book a demo — Provider Interface" },
      {
        name: "description",
        content:
          "Talk to someone about Provider Interface. Book a 30-minute walkthrough of the office.",
      },
      { property: "og:title", content: "Book a demo — Provider Interface" },
      {
        property: "og:description",
        content: "A 30-minute walkthrough of Provider Interface.",
      },
    ],
  }),
  component: DemoPage,
});

const INPUT_CLASS =
  "w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-200 ease-denim focus:border-pri focus:ring-[3px] focus:ring-pri/15";
const PRIMARY_PILL =
  "w-full rounded-full bg-pri text-white shadow-[var(--denim-btn-shadow)] transition-[background-color,transform] duration-200 ease-denim hover:-translate-y-px hover:bg-deep";

function DemoPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", agency: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const valid =
    form.name.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
    form.agency.trim().length > 1;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    // Placeholder — real Calendly / CRM hook-up swaps in here later.
    await new Promise((r) => setTimeout(r, 600));
    setSubmitted(true);
    setBusy(false);
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-clip bg-[var(--denim-bg)] font-sans text-ink">
      <div className="denim-field" aria-hidden>
        <div className="denim-orb" />
      </div>
      <header className="denim-glass sticky top-[14px] z-50 mx-auto mt-[14px] flex h-[58px] max-w-[1180px] items-center justify-between rounded-full px-4 max-[1219px]:mx-3 sm:max-[1219px]:mx-5">
        <PiBrand to="/" tone="on-light" size="sm" />
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link to="/pricing" className="text-muted-foreground transition-colors hover:text-pri">
            Pricing
          </Link>
          <Link to="/signup">
            <Button
              size="sm"
              className="h-9 rounded-full bg-pri px-4 text-white shadow-[var(--denim-btn-shadow)] hover:bg-deep"
            >
              Get started
            </Button>
          </Link>
        </nav>
      </header>

      <main className="relative z-[1] mx-auto max-w-2xl px-5 pb-24 pt-14">
        <div className="rounded-[20px] bg-paper p-7 shadow-[var(--denim-shadow)] sm:p-10">
          {submitted ? (
            <div className="text-center">
              <div
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-acct ring-1 ring-acctb"
              >
                <CheckCircle2 className="h-7 w-7 text-acc" />
              </div>
              <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-deep sm:text-3xl">
                Demo request received
              </h1>
              <p className="mt-3 text-body">
                We&apos;ll be in touch within one business day to schedule your 30-minute walkthrough.
                Check your email for a confirmation.
              </p>
              <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link to="/signup" className="w-full sm:w-auto">
                  <Button className={`${PRIMARY_PILL} sm:w-auto`} style={{ minHeight: 44 }}>
                    Get started now <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    className="w-full rounded-full border-pt2 bg-paper text-pri hover:bg-pt0 hover:text-pri sm:w-auto"
                    style={{ minHeight: 44 }}
                  >
                    Back to home
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="denim-eyebrow mb-5 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                Book a demo
              </div>
              <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-deep sm:text-3xl">
                Talk to someone who has actually billed a Medicaid waiver.
              </h1>
              <p className="mt-3 text-body">
                Tell us a little about your agency and we&apos;ll set up a 30-minute walkthrough — no
                sales script, just the parts of Provider Interface that matter for your services.
              </p>

              <form onSubmit={submit} className="mt-7 grid gap-4">
                <Field label="Your name">
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Work email">
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Agency name">
                  <input
                    required
                    value={form.agency}
                    onChange={(e) => setForm({ ...form, agency: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="What do you want to see? (optional)">
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </Field>

                <Button
                  type="submit"
                  disabled={!valid || busy}
                  className={`mt-2 ${PRIMARY_PILL}`}
                  style={{ minHeight: 44 }}
                >
                  {busy ? "Sending…" : "Request demo"}
                  {!busy && <ArrowRight className="ml-1 h-4 w-4" />}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Prefer to dive in? <Link to="/signup" className="font-medium text-pri underline hover:text-deep">Get started now</Link>.
                </p>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-[13px] font-semibold text-ink">
        {label}
      </Label>
      {children}
    </div>
  );
}
