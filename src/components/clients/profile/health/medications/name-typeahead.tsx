// Medication name with suggestions from PI's built-in list (generic name,
// brands and class). Free typing is allowed; picking an entry hands it to
// the form, which fills the suggested fields.

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchMedications, type MedicationReference } from "@/lib/medications/reference";

export function NameTypeahead({
  value,
  onType,
  onPick,
}: {
  value: string;
  onType: (name: string) => void;
  onPick: (ref: MedicationReference) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => searchMedications(value, 8), [value]);
  const show = open && matches.length > 0;

  const pick = (ref: MedicationReference) => {
    onPick(ref);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        value={value}
        role="combobox"
        aria-expanded={show}
        aria-autocomplete="list"
        placeholder="Start typing a name, e.g. sertraline or Zoloft"
        data-testid="med-name-input"
        onChange={(e) => {
          onType(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {show ? (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
          data-testid="med-name-suggestions"
        >
          {matches.map((m, i) => (
            <li
              key={m.key}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer rounded px-2 py-1.5 text-sm ${i === active ? "bg-accent" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="font-medium">{m.name}</span>
              {m.brands.length ? (
                <span className="text-muted-foreground"> ({m.brands.join(", ")})</span>
              ) : null}
              <span className="block text-xs text-muted-foreground">{m.drugClass}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
