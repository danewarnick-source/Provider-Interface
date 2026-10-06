import { cn } from "@/lib/utils";
import type { EvidenceSubject } from "@/lib/evidence/types.ts";

type CardDef = {
  subject: EvidenceSubject;
  title: string;
  tone: "emp" | "cli" | "com";
};

const CARDS: readonly CardDef[] = [
  { subject: "staff", title: "Team Members", tone: "emp" },
  { subject: "client", title: "Clients", tone: "cli" },
  { subject: "company", title: "Company", tone: "com" },
];

const ART: Record<CardDef["tone"], string> = {
  emp: "bg-[linear-gradient(145deg,#e8eef6,#c5d3e8)]",
  cli: "bg-[linear-gradient(145deg,#e8f4ef,#c5e4d6)]",
  com: "bg-[linear-gradient(145deg,#f6f0e4,#e8d7b0)]",
};

function EmployeesGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3d4a5c" strokeWidth="1.6">
      <circle cx="9" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
      <path d="M14 19c.3-2 1.8-3.5 4-3.8" />
    </svg>
  );
}

function ClientsGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3d6b55" strokeWidth="1.6">
      <path d="M4 20V10l8-6 8 6v10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function CompanyGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8a6d2e" strokeWidth="1.6">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function Glyph({ tone }: { tone: CardDef["tone"] }) {
  if (tone === "emp") return <EmployeesGlyph />;
  if (tone === "cli") return <ClientsGlyph />;
  return <CompanyGlyph />;
}

export function EvidenceSubjectCards({
  tab,
  employeeCount,
  clientCount,
  companyLabel,
  companyHint,
  onSelect,
}: {
  tab: EvidenceSubject;
  employeeCount: number;
  clientCount: number;
  companyLabel: string;
  companyHint: string;
  onSelect: (subject: EvidenceSubject) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {CARDS.map((card) => {
        const active = tab === card.subject;
        const stat =
          card.subject === "staff"
            ? { value: String(employeeCount), unit: "people" }
            : card.subject === "client"
              ? { value: String(clientCount), unit: "people" }
              : { value: companyLabel, unit: "" };
        const hint =
          card.subject === "company"
            ? companyHint
            : card.subject === "staff"
              ? "Selected records for team members"
              : "Selected records for clients";
        return (
          <button
            key={card.subject}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(card.subject)}
            className={cn(
              "rounded-[14px] border bg-[var(--hive-surface)] px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(36,48,64,0.04)]",
              active
                ? "border-[var(--hive-gold)] shadow-[0_0_0_1px_var(--hive-gold)]"
                : "border-[var(--hive-border)]",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-xl",
                  ART[card.tone],
                )}
              >
                <Glyph tone={card.tone} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[var(--hive-text)]">{card.title}</h3>
                <p className="mt-0.5 text-xl font-semibold leading-none text-[var(--hive-text)]">
                  {stat.value}
                  {stat.unit ? (
                    <span className="ml-1 text-xs font-medium text-[var(--hive-text-muted)]">
                      {stat.unit}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-[var(--hive-text-muted)]">{hint}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
