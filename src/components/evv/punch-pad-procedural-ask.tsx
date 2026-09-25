import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NectarInfusionLock } from "@/components/nectar/nectar-infusion-lock";
import { PiMark } from "@/components/pi-landing/pi-mark";
import { answerProceduralQuestion, type ProceduralResult } from "@/lib/ai-coach.functions";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface PunchPadProceduralAskProps {
  clientFirstName: string;
  serviceCode: string;
  pcspGoals: string[];
}

export function PunchPadProceduralAsk({
  clientFirstName,
  serviceCode,
  pcspGoals,
}: PunchPadProceduralAskProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProceduralResult | null>(null);

  async function handleAsk() {
    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length < 4) {
      toast.error("Type your question first.");
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      const response = await answerProceduralQuestion({
        data: {
          question: trimmedQuestion,
          clientFirstName,
          serviceCode: serviceCode || null,
          pcspGoals,
          notes: null,
        },
      });
      setResult(response);
    } catch (error) {
      toast.error((error as Error).message || "NECTAR couldn't answer right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <NectarInfusionLock
      featureName="Ask NECTAR (procedural)"
      benefit="Plain-language answers to 'am I allowed to…?' questions, grounded in this client's plan and your company policy."
      className="mt-4"
    >
      <div className="rounded-lg border border-[color:var(--border-light)] bg-background/60 p-3">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-[color:var(--navy-900)]">
            <PiMark variant="gold" className="h-3.5 w-3.5" />
            Ask NECTAR — &quot;am I allowed to…?&quot;
          </span>
          <span className="text-[11px] text-muted-foreground">{open ? "Hide" : "Open"}</span>
        </button>

        {open && (
          <div className="mt-3 space-y-2">
            <Textarea
              rows={2}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={'e.g. "Can I take Blake out of county?" or "What if he refuses a med?"'}
              maxLength={500}
              className="text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                Grounded in {clientFirstName}&apos;s plan when available. You still take the action.
              </p>
              <Button
                size="sm"
                onClick={() => void handleAsk()}
                disabled={busy || question.trim().length < 4}
                className="bg-[color:var(--amber-500)] text-[color:var(--navy-900)] hover:bg-[color:var(--amber-600)]"
              >
                {busy ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                )}
                Ask
              </Button>
            </div>

            {result && (
              <div
                className={`rounded-md border p-3 text-[13px] leading-snug ${
                  result.escalate
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : "border-[color:var(--amber-300)] bg-[color:var(--amber-50)] text-[color:var(--navy-900)]"
                }`}
              >
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                  {result.escalate ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" /> Escalate now
                    </>
                  ) : (
                    <>
                      <PiMark className="h-3.5 w-3.5" /> NECTAR · Confidence: {result.confidence}
                    </>
                  )}
                </p>
                <p className="mt-1">{result.answer}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Guidance only — confirm against your supervisor or company policy before acting.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </NectarInfusionLock>
  );
}
