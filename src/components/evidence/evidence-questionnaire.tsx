import { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultQuestionnaireAnswers,
  isSowSuggestedKey,
  quizCodesForSubject,
  requirementByKey,
  suggestPacks,
} from "@/lib/evidence/catalog.ts";
import { isAttestFullName } from "@/lib/evidence/people.ts";
import {
  EVIDENCE_LIABILITY_TEXT,
  EVIDENCE_UNCHECK_TITLE,
  EVIDENCE_UNCHECK_WARNING,
  type EvidenceRequirementDef,
  type EvidenceSubject,
  type EvidenceType,
  type QuestionnaireAnswers,
  type ServiceCodeFlag,
} from "@/lib/evidence/types.ts";

export function EvidenceQuestionnaire({
  subject,
  personName,
  initialCodes,
  onApply,
  onClose,
  pending,
}: {
  subject: EvidenceSubject;
  personName: string;
  initialCodes?: ServiceCodeFlag[];
  onApply: (args: {
    answers: QuestionnaireAnswers;
    requirementKeys: string[];
    packKeys: string[];
    suggestedKeys: string[];
    optedOutKeys: string[];
    typeOverrides: Record<string, EvidenceType>;
  }) => void;
  onClose: () => void;
  pending?: boolean;
}) {
  const [step, setStep] = useState<"quiz" | "rows">(subject === "company" ? "rows" : "quiz");
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(() => ({
    ...defaultQuestionnaireAnswers(subject),
    serviceCodes: initialCodes ?? [],
  }));
  const suggested = useMemo(() => suggestPacks(answers), [answers]);
  const suggestedKeys = useMemo(
    () => suggested.flatMap((row) => [...row.pack.requirementKeys]),
    [suggested],
  );
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [optedOut, setOptedOut] = useState<Set<string>>(() => new Set());
  const [typeByKey, setTypeByKey] = useState<Record<string, EvidenceType>>({});
  const [liability, setLiability] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [optOutKey, setOptOutKey] = useState<string | null>(null);

  useEffect(() => {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const key of suggestedKeys) {
        if (!optedOut.has(key)) next.add(key);
      }
      for (const key of [...next]) {
        if (!suggestedKeys.includes(key) && !optedOut.has(key)) next.delete(key);
      }
      return next;
    });
    setTypeByKey((prev) => {
      const next = { ...prev };
      for (const key of suggestedKeys) {
        if (next[key]) continue;
        next[key] = requirementByKey(key)?.evidenceType ?? "upload";
      }
      return next;
    });
  }, [suggestedKeys, optedOut]);

  const toggleCode = (code: ServiceCodeFlag) => {
    setAnswers((prev) => {
      const has = prev.serviceCodes.includes(code);
      return {
        ...prev,
        serviceCodes: has
          ? prev.serviceCodes.filter((c) => c !== code)
          : [...prev.serviceCodes, code],
      };
    });
  };

  const toggleKey = (key: string) => {
    if (checked.has(key) && isSowSuggestedKey(key, answers)) {
      setOptOutKey(key);
      return;
    }
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const confirmOptOut = () => {
    if (!optOutKey) return;
    setOptedOut((prev) => new Set(prev).add(optOutKey));
    setChecked((prev) => {
      const next = new Set(prev);
      next.delete(optOutKey);
      return next;
    });
    setOptOutKey(null);
  };

  const typeOverrides = useMemo(() => {
    const out: Record<string, EvidenceType> = {};
    for (const key of checked) {
      out[key] = typeByKey[key] ?? requirementByKey(key)?.evidenceType ?? "upload";
    }
    return out;
  }, [checked, typeByKey]);

  const title =
    subject === "company"
      ? "Company packs"
      : subject === "client"
        ? `Client packs · ${personName}`
        : `Employee packs · ${personName}`;
  const canApply =
    liability && isAttestFullName(firstName, lastName) && checked.size > 0 && !pending;

  const grouped = suggested.map((row) => ({
    pack: row.pack,
    rows: row.pack.requirementKeys
      .map((key) => requirementByKey(key))
      .filter((def): def is EvidenceRequirementDef => !!def),
  }));

  const apply = () => {
    if (!canApply) return;
    onApply({
      answers,
      requirementKeys: [...checked],
      packKeys: suggested
        .filter((row) => row.pack.requirementKeys.some((k) => checked.has(k)))
        .map((row) => row.pack.key),
      suggestedKeys,
      optedOutKeys: suggestedKeys.filter((k) => !checked.has(k)),
      typeOverrides,
    });
  };

  const quizCodes = quizCodesForSubject(subject);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-pack-title"
    >
      <div
        data-evidence-quiz=""
        className="flex max-h-[100dvh] w-full max-w-[680px] flex-col overflow-hidden rounded-t-2xl bg-card shadow-lg sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
      >
        <header className="border-b border-border px-5 py-4">
          <h2 id="evidence-pack-title" className="text-lg font-semibold text-[var(--hive-text)]">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === "quiz" && subject === "staff"
              ? "Employee setup — different from Client and Company."
              : step === "quiz" && subject === "client"
                ? "Client setup — services on this person, not hire flags."
                : "Each item has a short plain-English explanation. Links open in a new tab."}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === "quiz" && subject === "staff" ? (
            <div className="space-y-4">
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                Employee: hire / role questions, then personnel packs.
              </p>
              <section className="rounded-xl border border-border p-3">
                <h3 className="text-sm font-semibold">Job / service codes</h3>
                <div className="mt-3 grid gap-2">
                  {quizCodes.map((code) => (
                    <label
                      key={code}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={answers.serviceCodes.includes(code)}
                        onCheckedChange={() => toggleCode(code)}
                      />
                      {code}
                    </label>
                  ))}
                </div>
              </section>
              <section className="rounded-xl border border-border p-3">
                <h3 className="text-sm font-semibold">Transport</h3>
                <div className="mt-3 grid gap-2">
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="transport"
                      checked={answers.transportsPeople}
                      onChange={() => setAnswers((a) => ({ ...a, transportsPeople: true }))}
                    />
                    Yes
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <input
                      type="radio"
                      name="transport"
                      checked={!answers.transportsPeople}
                      onChange={() => setAnswers((a) => ({ ...a, transportsPeople: false }))}
                    />
                    Does not transport
                  </label>
                </div>
              </section>
              <section className="rounded-xl border border-border p-3">
                <h3 className="text-sm font-semibold">Caseload flags</h3>
                <div className="mt-3 grid gap-2">
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={answers.worksWithAbi}
                      onCheckedChange={(v) =>
                        setAnswers((a) => ({ ...a, worksWithAbi: v === true }))
                      }
                    />
                    ABI
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={answers.maySupportAggressiveBehavior}
                      onCheckedChange={(v) =>
                        setAnswers((a) => ({ ...a, maySupportAggressiveBehavior: v === true }))
                      }
                    />
                    Mandt / aggressive behavior
                  </label>
                </div>
              </section>
            </div>
          ) : null}

          {step === "quiz" && subject === "client" ? (
            <div className="space-y-4">
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                Client: person-file packs. No CPR / background / Mandt.
              </p>
              <section className="rounded-xl border border-border p-3">
                <h3 className="text-sm font-semibold">Services / codes for this client</h3>
                <div className="mt-3 grid gap-2">
                  {quizCodes.map((code) => (
                    <label
                      key={code}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={answers.serviceCodes.includes(code)}
                        onCheckedChange={() => toggleCode(code)}
                      />
                      {code}
                    </label>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {step === "rows" ? (
            <div className="space-y-4">
              {subject === "company" ? (
                <div className="space-y-3">
                  <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">
                    Company: agency policies and standing — not people. No hire questionnaire.
                  </p>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                    <Checkbox
                      checked={answers.includeCompanyCustoms}
                      onCheckedChange={(v) =>
                        setAnswers((a) => ({ ...a, includeCompanyCustoms: v === true }))
                      }
                    />
                    Include optional custom company slot
                  </label>
                </div>
              ) : subject === "staff" ? (
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                  Employee suggestions (personnel). Host Home Cert dual-links when HHS is selected.
                </p>
              ) : (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  Client suggestions (person file).
                </p>
              )}

              {grouped.map(({ pack, rows }) => (
                <section key={pack.key}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {pack.chip}
                  </h3>
                  <ul className="space-y-2">
                    {rows.map((row) => {
                      const evidenceType = typeByKey[row.key] ?? row.evidenceType;
                      return (
                        <li key={row.key} className="rounded-xl border border-border p-3">
                          <label className="flex items-start gap-3">
                            <Checkbox
                              checked={checked.has(row.key)}
                              onCheckedChange={() => toggleKey(row.key)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">{row.title}</span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {row.cadenceDisplay}
                                {row.dualLink ? " · same file on Employees + Client" : ""}
                              </span>
                              <span className="mt-2 block text-sm leading-snug text-slate-700">
                                {row.why}
                              </span>
                              {row.links.length > 0 ? (
                                <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                  {row.links.map((link) => (
                                    <a
                                      key={link.href + link.label}
                                      href={link.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-semibold text-[var(--hive-accent,#2f6fed)] underline-offset-2 hover:underline"
                                    >
                                      {link.label}
                                    </a>
                                  ))}
                                </span>
                              ) : null}
                              <label className="mt-2 block">
                                <span className="sr-only">Evidence type for {row.title}</span>
                                <select
                                  value={evidenceType}
                                  onChange={(e) =>
                                    setTypeByKey((prev) => ({
                                      ...prev,
                                      [row.key]: e.target.value as EvidenceType,
                                    }))
                                  }
                                  className="mt-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
                                >
                                  <option value="upload">Upload</option>
                                  <option value="attestation">Attestation</option>
                                </select>
                              </label>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              <div className="space-y-3 rounded-xl border border-border bg-muted/30 px-3 py-3">
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={liability} onCheckedChange={(v) => setLiability(v === true)} />
                  <span>{EVIDENCE_LIABILITY_TEXT}</span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="evidence-attest-first">First name</Label>
                    <Input
                      id="evidence-attest-first"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      placeholder="First"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="evidence-attest-last">Last name</Label>
                    <Input
                      id="evidence-attest-last"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                      placeholder="Last"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Type your first and last name to confirm you accept this responsibility. A
                  checkbox alone is not enough.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <footer
          className="flex items-center gap-2 border-t border-border bg-muted/30 px-5 py-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (subject !== "company" && step === "rows") {
                setStep("quiz");
                return;
              }
              onClose();
            }}
          >
            Back
          </Button>
          <div className="flex-1" />
          {step === "quiz" ? (
            <Button type="button" onClick={() => setStep("rows")}>
              {subject === "client" ? "See client suggestions" : "See employee suggestions"}
            </Button>
          ) : (
            <Button type="button" disabled={!canApply} onClick={apply}>
              {pending ? "Applying…" : "Apply packs"}
            </Button>
          )}
        </footer>
      </div>

      <AlertDialog
        open={!!optOutKey}
        onOpenChange={(open) => {
          if (!open) setOptOutKey(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{EVIDENCE_UNCHECK_TITLE}</AlertDialogTitle>
            <AlertDialogDescription>{EVIDENCE_UNCHECK_WARNING}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOptOut}>Uncheck</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
