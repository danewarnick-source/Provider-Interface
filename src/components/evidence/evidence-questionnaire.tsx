import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  cadenceLabel,
  chipsForRequirementKey,
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
  type EvidenceType,
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
    typeOverrides: Record<string, EvidenceType>;
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
  const [typeByKey, setTypeByKey] = useState<Record<string, EvidenceType>>({});
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

  const typeOverrides = useMemo(() => {
    const out: Record<string, EvidenceType> = {};
    for (const key of checked) {
      const chosen = typeByKey[key] ?? requirementByKey(key)?.evidenceType ?? "upload";
      out[key] = chosen;
    }
    return out;
  }, [checked, typeByKey]);

  const apply = () => {
    if (!liability) return;
    onApply({
      answers,
      requirementKeys: [...checked],
      packKeys: selectedPacks.map((p) => p.key),
      suggestedKeys,
      optedOutKeys: suggestedKeys.filter((k) => !checked.has(k)),
      typeOverrides,
    });
  };

  return (
    <div
      data-evidence-quiz=""
      className="flex flex-col gap-6 pb-[max(7rem,calc(env(safe-area-inset-bottom)+5.5rem))]"
    >
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[var(--hive-text)]">
          {subject === "client"
            ? "Client pack"
            : subject === "company"
              ? "Company pack"
              : "Staff pack"}
        </h2>
      </div>

      {subject !== "company" ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-[var(--hive-text)]">Job / service codes</p>
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
        </section>
      ) : null}

      {subject === "staff" ? (
        <>
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--hive-text)]">
              Do they transport people?
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
                Yes — driving record / insurance proof
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
                No — does not transport
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--hive-text)]">Caseload</p>
            <div className="mt-4 space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                <Checkbox
                  checked={answers.worksWithAbi}
                  onCheckedChange={(v) => {
                    setAnswers((a) => ({ ...a, worksWithAbi: v === true }));
                  }}
                />
                Works with ABI / brain-injury caseload
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                <Checkbox
                  checked={answers.maySupportAggressiveBehavior}
                  onCheckedChange={(v) => {
                    setAnswers((a) => ({ ...a, maySupportAggressiveBehavior: v === true }));
                  }}
                />
                May support people with aggressive behavior
              </label>
            </div>
          </section>
        </>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-semibold text-[var(--hive-text)]">Suggested rows</p>
        <ul className="mt-4 space-y-2">
          {[...new Set([...suggestedKeys, ...checked])]
            .map((key) => requirementByKey(key))
            .filter((row): row is NonNullable<typeof row> => !!row)
            .map((row) => {
              const chips = chipsForRequirementKey(row.key, suggested);
              const evidenceType = typeByKey[row.key] ?? row.evidenceType;
              return (
                <li key={row.key} className="rounded-xl border border-border px-3 py-2.5">
                  <label className="flex min-w-0 cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={checked.has(row.key)}
                      onCheckedChange={() => toggleKey(row.key)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium">{row.title}</span>
                        {chips.map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                          >
                            {chip}
                          </span>
                        ))}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {cadenceLabel(row.cadence)}
                        {row.sowCite ? ` · ${row.sowCite}` : ""}
                      </span>
                    </span>
                  </label>
                  <div className="mt-2 pl-8">
                    <label className="sr-only" htmlFor={`ev-type-${row.key}`}>
                      Evidence type for {row.title}
                    </label>
                    <select
                      id={`ev-type-${row.key}`}
                      value={evidenceType}
                      onChange={(e) =>
                        setTypeByKey((prev) => ({
                          ...prev,
                          [row.key]: e.target.value as EvidenceType,
                        }))
                      }
                      className="h-9 w-full max-w-[11rem] rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="upload">Upload</option>
                      <option value="attestation">Attestation</option>
                    </select>
                  </div>
                </li>
              );
            })}
        </ul>
        {optOutKey ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-sm">
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

      <div
        className="sticky bottom-0 z-20 -mx-4 space-y-3 border-t border-border bg-[var(--hive-canvas)] px-4 pt-3 md:-mx-8 md:px-8"
        style={{
          paddingBottom: "max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))",
        }}
      >
        <label className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
          <Checkbox checked={liability} onCheckedChange={(v) => setLiability(v === true)} />
          <span>{EVIDENCE_LIABILITY_TEXT}</span>
        </label>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor="evidence-template-name">Save template</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="evidence-template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="min-w-[10rem] flex-1"
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
          <Button
            type="button"
            disabled={!liability || checked.size === 0 || pending}
            onClick={apply}
          >
            {pending ? "Applying…" : "Apply packs"}
          </Button>
        </div>
      </div>
    </div>
  );
}
