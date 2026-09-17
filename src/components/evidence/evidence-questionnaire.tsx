import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  cadenceLabel,
  defaultQuestionnaireAnswers,
  packsForSubject,
  requirementByKey,
  suggestPacks,
} from "@/lib/evidence/catalog.ts";
import {
  EVIDENCE_LIABILITY_TEXT,
  EVIDENCE_UNCHECK_WARNING,
  SERVICE_CODE_FLAGS,
  type EvidenceSubject,
  type QuestionnaireAnswers,
  type ServiceCodeFlag,
} from "@/lib/evidence/types.ts";

const CODE_LABEL: Record<ServiceCodeFlag, string> = {
  HHS: "HHS — Host Home",
  SLN: "SLN — Supported Living (hourly)",
  SLH: "SLH — Supported Living (daily)",
  SEI: "SEI — Supported Employment",
  DSI: "DSI — Day Support",
  RHS: "RHS — Residential Support",
  BC1: "BC1 — Behavior Consultation 1",
  BC2: "BC2 — Behavior Consultation 2",
  BC3: "BC3 — Behavior Consultation 3",
};

export function EvidenceQuestionnaire({
  subject,
  initialCodes,
  onApply,
  onSaveTemplate,
  pending,
}: {
  subject: EvidenceSubject;
  initialCodes?: ServiceCodeFlag[];
  onApply: (args: {
    answers: QuestionnaireAnswers;
    requirementKeys: string[];
    packKeys: string[];
    suggestedKeys: string[];
    optedOutKeys: string[];
  }) => void;
  onSaveTemplate: (args: {
    name: string;
    answers: QuestionnaireAnswers;
    requirementKeys: string[];
    packKeys: string[];
  }) => void;
  pending?: boolean;
}) {
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
  const [liability, setLiability] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [optOutKey, setOptOutKey] = useState<string | null>(null);

  useEffect(() => {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const key of suggestedKeys) {
        if (!optedOut.has(key)) next.add(key);
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
    const isSuggested = suggestedKeys.includes(key);
    if (checked.has(key) && isSuggested) {
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

  const selectedPacks = packsForSubject(subject).filter((p) =>
    p.requirementKeys.every((k) => checked.has(k)),
  );

  const apply = () => {
    if (!liability) return;
    onApply({
      answers,
      requirementKeys: [...checked],
      packKeys: selectedPacks.map((p) => p.key),
      suggestedKeys,
      optedOutKeys: suggestedKeys.filter((k) => !checked.has(k)),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--hive-text)]">
          {subject === "client" ? "Add client" : subject === "company" ? "Company" : "Add staff"}{" "}
          setup questions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Branching questions drive suggested packs. Nothing is forced on.
        </p>
      </div>

      {subject !== "company" ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-[var(--hive-text)]">
            1. Job / service codes this person works under
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick all that apply. Follow-ups appear from your answers.
          </p>
          <div className="mt-4 space-y-2">
            {SERVICE_CODE_FLAGS.map((code) => (
              <label
                key={code}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm"
              >
                <Checkbox
                  checked={answers.serviceCodes.includes(code)}
                  onCheckedChange={() => toggleCode(code)}
                />
                <span>{CODE_LABEL[code]}</span>
              </label>
            ))}
          </div>
          {suggested.length > 0 ? (
            <p className="mt-4 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-950">
              Suggested: {suggested.map((s) => s.pack.title).join(" + ")}.
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No extra service pack yet. All-staff starter still applies for staff.
            </p>
          )}
        </section>
      ) : null}

      {subject === "staff" ? (
        <>
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--hive-text)]">2. Do they transport people?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Most staff do. Only turn off for rare office-only roles.
            </p>
            <div className="mt-4 space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                <input
                  type="radio"
                  name="transport"
                  checked={answers.transportsPeople}
                  onChange={() => {
                    setAnswers((a) => ({ ...a, transportsPeople: true }));
                  }}
                />
                Yes — suggest driving record / insurance proof
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                <input
                  type="radio"
                  name="transport"
                  checked={!answers.transportsPeople}
                  onChange={() => {
                    setAnswers((a) => ({ ...a, transportsPeople: false }));
                  }}
                />
                No — does not transport (opt out)
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--hive-text)]">3. Caseload flags</p>
            <div className="mt-4 space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                <Checkbox
                  checked={answers.worksWithAbi}
                  onCheckedChange={(v) => {
                    setAnswers((a) => ({ ...a, worksWithAbi: v === true }));
                  }}
                />
                Works with ABI / brain-injury caseload — suggest ABI training
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                <Checkbox
                  checked={answers.maySupportAggressiveBehavior}
                  onCheckedChange={(v) => {
                    setAnswers((a) => ({ ...a, maySupportAggressiveBehavior: v === true }));
                  }}
                />
                May support people with aggressive behavior — suggest Mandt / behavior cert
              </label>
            </div>
          </section>
        </>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-semibold text-[var(--hive-text)]">Suggested rows</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Check or uncheck. Unchecking a SOW-suggested row asks you to confirm.
        </p>
        <ul className="mt-4 space-y-2">
          {[...new Set([...suggestedKeys, ...checked])]
            .map((key) => requirementByKey(key))
            .filter((row): row is NonNullable<typeof row> => !!row)
            .map((row) => (
              <li
                key={row.key}
                className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
              >
                <label className="flex min-w-0 cursor-pointer items-start gap-3">
                  <Checkbox checked={checked.has(row.key)} onCheckedChange={() => toggleKey(row.key)} />
                  <span>
                    <span className="block text-sm font-medium">{row.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {row.evidenceType === "upload" ? "Upload" : "Attest"} · {cadenceLabel(row.cadence)} ·{" "}
                      {row.sowCite}
                    </span>
                  </span>
                </label>
              </li>
            ))}
        </ul>
        {optOutKey ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p>{EVIDENCE_UNCHECK_WARNING}</p>
            <div className="mt-3 flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setOptOutKey(null)}>
                Keep suggested
              </Button>
              <Button type="button" size="sm" onClick={confirmOptOut}>
                Uncheck anyway
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm">
        <Checkbox checked={liability} onCheckedChange={(v) => setLiability(v === true)} />
        <span>{EVIDENCE_LIABILITY_TEXT}</span>
      </label>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="evidence-template-name">Save template</Label>
          <div className="flex gap-2">
            <Input
              id="evidence-template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. HHS host starter"
              className="w-56"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!templateName.trim() || checked.size === 0 || pending}
              onClick={() =>
                onSaveTemplate({
                  name: templateName.trim(),
                  answers,
                  requirementKeys: [...checked],
                  packKeys: selectedPacks.map((p) => p.key),
                })
              }
            >
              Save template
            </Button>
          </div>
        </div>
        <Button type="button" disabled={!liability || checked.size === 0 || pending} onClick={apply}>
          {pending ? "Applying…" : "Apply packs"}
        </Button>
      </div>
    </div>
  );
}
