import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { LIBRARY_FILE_ACCEPT, type SourceValue } from "./use-library-upload";

/** Typed text (heading on its own line, blank line between sections) or a PDF, Word or text file. */
export function DocumentSourceInput({
  idPrefix,
  label,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  label: string;
  value: SourceValue;
  onChange: (next: SourceValue) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold text-[var(--hive-text)]">{label}</legend>
      <RadioGroup
        value={value.mode}
        onValueChange={(mode) => onChange({ ...value, mode: mode === "file" ? "file" : "text" })}
        className="flex flex-wrap gap-x-6 gap-y-2"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="text" id={`${idPrefix}-mode-text`} />
          <Label htmlFor={`${idPrefix}-mode-text`} className="font-normal">
            Type the text
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="file" id={`${idPrefix}-mode-file`} />
          <Label htmlFor={`${idPrefix}-mode-file`} className="font-normal">
            Upload a file
          </Label>
        </div>
      </RadioGroup>
      {value.mode === "text" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-text`} className="sr-only">
            {label}
          </Label>
          <p id={`${idPrefix}-text-help`} className="text-xs text-muted-foreground">
            Put each section's heading on its own line, with a blank line between sections.
          </p>
          <Textarea
            id={`${idPrefix}-text`}
            aria-describedby={`${idPrefix}-text-help`}
            rows={14}
            value={value.text}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            className="leading-relaxed"
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-file`}>File</Label>
          <Input
            id={`${idPrefix}-file`}
            type="file"
            accept={LIBRARY_FILE_ACCEPT}
            aria-describedby={`${idPrefix}-file-help`}
            onChange={(e) => onChange({ ...value, file: e.target.files?.[0] ?? null })}
          />
          <p id={`${idPrefix}-file-help`} className="text-xs text-muted-foreground">
            PDF, Word (.docx) or text, up to 25 MB. The text is read for you.
          </p>
        </div>
      )}
    </fieldset>
  );
}
