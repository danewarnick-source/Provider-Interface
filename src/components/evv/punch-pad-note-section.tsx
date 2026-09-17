import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NectarCompletenessErrors } from "@/components/nectar/nectar-completeness-errors";
import { NectarShiftNoteDraft } from "@/components/nectar/nectar-shift-note-draft";
import { OriginalSpeechAudit } from "@/components/staff-mobile/original-speech-audit";
import { selectedPill, unselectedPill } from "@/components/evv/toggle-styles";
import {
  accumulateSpeechResults,
  beginContinuousRecognition,
  type ContinuousSpeechSession,
} from "@/lib/continuous-speech";
import { freezeOriginalTranscript } from "@/lib/original-transcript";
import { NECTAR_DRAFT_MIN_WORDS } from "@/lib/nectar-note-gate";
import type { CompletenessItem } from "@/lib/nectar-completeness";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

interface PunchPadNoteSectionProps {
  goals: string[];
  selectedGoals: string[];
  clientFirstName: string;
  narrative: string;
  originalTranscript: string;
  wordCount: number;
  narrativeOk: boolean;
  showNarrativeError: boolean;
  completenessErrors: CompletenessItem[];
  onNarrativeChange: (narrative: string) => void;
  onOriginalTranscriptChange: (transcript: string) => void;
  onClearValidationErrors: () => void;
  onDraftApplied: (draft: string) => void;
  onNectarUsed: () => void;
}

export function PunchPadNoteSection({
  goals,
  selectedGoals,
  clientFirstName,
  narrative,
  originalTranscript,
  wordCount,
  narrativeOk,
  showNarrativeError,
  completenessErrors,
  onNarrativeChange,
  onOriginalTranscriptChange,
  onClearValidationErrors,
  onDraftApplied,
  onNectarUsed,
}: PunchPadNoteSectionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const sessionRef = useRef<ContinuousSpeechSession | null>(null);
  const recordingWantedRef = useRef(false);
  const baseRef = useRef("");
  const priorFinalsRef = useRef("");
  const liveFinalsRef = useRef("");
  const narrativeRef = useRef(narrative);
  const originalTranscriptRef = useRef(originalTranscript);
  narrativeRef.current = narrative;
  originalTranscriptRef.current = originalTranscript;

  function stopRecording() {
    recordingWantedRef.current = false;
    sessionRef.current?.stop();
    sessionRef.current = null;
    setIsRecording(false);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const recognitionWindow = window as typeof window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    setSpeechSupported(
      !!(recognitionWindow.SpeechRecognition || recognitionWindow.webkitSpeechRecognition),
    );
    return () => {
      recordingWantedRef.current = false;
      sessionRef.current?.stop();
    };
  }, []);

  function startRecording() {
    if (typeof window === "undefined") return;
    stopRecording();
    recordingWantedRef.current = true;
    baseRef.current = narrativeRef.current;
    priorFinalsRef.current = "";
    liveFinalsRef.current = "";

    const session = beginContinuousRecognition({
      interimResults: true,
      shouldContinue: () => recordingWantedRef.current,
      onResult: (event) => {
        const { finals, display } = accumulateSpeechResults(priorFinalsRef.current, event.results);
        liveFinalsRef.current = finals;
        const base = baseRef.current.trim();
        onNarrativeChange(base && display ? `${base} ${display}` : display || base);
        if (display.trim()) {
          const nextTranscript = freezeOriginalTranscript(originalTranscriptRef.current, display);
          originalTranscriptRef.current = nextTranscript;
          onOriginalTranscriptChange(nextTranscript);
          onClearValidationErrors();
        }
      },
      onSessionEnd: () => {
        priorFinalsRef.current = liveFinalsRef.current;
      },
      onFatalStop: () => {
        recordingWantedRef.current = false;
        sessionRef.current = null;
        setIsRecording(false);
      },
    });

    if (!session) {
      recordingWantedRef.current = false;
      toast.error("Voice input isn't supported on this browser.");
      return;
    }
    sessionRef.current = session;
    setIsRecording(true);
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="evv-narrative">Mandatory Progress Note &amp; Narrative Log</Label>
      {goals.length > 0 && (
        <div className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] text-foreground">
          <span className="font-semibold">PCSP goals to address:</span>{" "}
          {goals.slice(0, 3).join("; ")}
          {goals.length > 3 && ` (+${goals.length - 3} more)`}
        </div>
      )}
      <OriginalSpeechAudit transcript={originalTranscript} />
      <Textarea
        id="evv-narrative"
        rows={7}
        value={narrative}
        onChange={(event) => {
          onNarrativeChange(event.target.value);
          onClearValidationErrors();
        }}
        placeholder="Describe client behaviors, choices, goal responses, and any incidents observed during this shift…"
        maxLength={5000}
        className="min-h-[160px] w-full resize-y"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={`text-xs font-medium ${
            narrativeOk ? "text-emerald-600" : "text-muted-foreground"
          }`}
        >
          Word Count: {wordCount} / {NECTAR_DRAFT_MIN_WORDS} words minimum
        </div>
        {speechSupported && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => (isRecording ? stopRecording() : startRecording())}
            className={`h-8 border ${isRecording ? selectedPill : unselectedPill}`}
          >
            {isRecording ? (
              <MicOff className="mr-2 h-3.5 w-3.5" />
            ) : (
              <Mic className="mr-2 h-3.5 w-3.5" />
            )}
            {isRecording ? "Stop voice" : "Dictate note"}
          </Button>
        )}
      </div>
      {showNarrativeError && !narrativeOk && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          Your progress note must be at least {NECTAR_DRAFT_MIN_WORDS} words and describe how you
          supported the person.
        </div>
      )}
      <NectarShiftNoteDraft
        narrative={narrative}
        goals={selectedGoals}
        clientFirstName={clientFirstName}
        onApplyDraft={(draft) => {
          onNarrativeChange(draft);
          onDraftApplied(draft);
          onClearValidationErrors();
        }}
        onUsed={onNectarUsed}
      />
      <NectarCompletenessErrors checks={completenessErrors} />
    </div>
  );
}
