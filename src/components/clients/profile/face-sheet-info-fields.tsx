import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Field layout for the Face Sheet Info card. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground/80">
        {title}
      </h4>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function Field({
  label, k, type = "text", multiline, full, editing, form, set,
}: {
  label: string;
  k: string;
  type?: string;
  multiline?: boolean;
  full?: boolean;
  editing: boolean;
  form: Record<string, string>;
  set: (k: string, v: string) => void;
}) {
  const val = form[k] ?? "";
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {editing ? (
        multiline ? (
          <Textarea
            className="mt-1 min-h-[68px] text-sm"
            value={val}
            onChange={(e) => set(k, e.target.value)}
          />
        ) : (
          <Input
            className="mt-1 h-9 text-sm"
            type={type}
            value={val}
            onChange={(e) => set(k, e.target.value)}
          />
        )
      ) : (
        <div className="mt-1 min-h-[36px] whitespace-pre-wrap rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-sm">
          {val || <span className="text-muted-foreground">Not on file</span>}
        </div>
      )}
    </div>
  );
}
