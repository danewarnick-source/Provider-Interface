// Read-aloud for the training player.
// Plays a pre-generated narration clip (looked up by hash of the spoken text) when one exists;
// otherwise falls back to the browser's on-device voice (window.speechSynthesis).
import { useEffect, useRef, useState, useCallback } from "react";
import {
  DEFAULT_TRAINING_AUDIO_RATE,
  TRAINING_AUDIO_RATES,
  lookupTrainingClip,
} from "@/lib/training-audio";

const SESSION_KEY = "hive-training-autoread";
const RATE_KEY = "hive-training-speech-rate";

function readStoredRate(): number {
  if (typeof window === "undefined") return DEFAULT_TRAINING_AUDIO_RATE;
  try {
    const n = Number(window.localStorage.getItem(RATE_KEY));
    return (TRAINING_AUDIO_RATES as readonly number[]).includes(n) ? n : DEFAULT_TRAINING_AUDIO_RATE;
  } catch {
    return DEFAULT_TRAINING_AUDIO_RATE;
  }
}

export function useTrainingSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [rate, setRateState] = useState<number>(DEFAULT_TRAINING_AUDIO_RATE);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rateRef = useRef<number>(DEFAULT_TRAINING_AUDIO_RATE);
  // Bumped by every speak/stop so a slow clip lookup can't start after a newer request or a stop.
  const tokenRef = useRef(0);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        ("speechSynthesis" in window || typeof Audio !== "undefined"),
    );
    const r = readStoredRate();
    rateRef.current = r;
    setRateState(r);
  }, []);

  const halt = useCallback(() => {
    tokenRef.current++;
    const a = audioRef.current;
    if (a) {
      a.onended = null;
      a.onerror = null;
      a.pause();
      a.removeAttribute("src");
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const stop = useCallback(() => {
    halt();
    setSpeaking(false);
  }, [halt]);

  const speakWithBrowserVoice = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rateRef.current;
    u.pitch = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utterRef.current = u;
    window.speechSynthesis.speak(u);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!text || typeof window === "undefined") return;
      halt();
      const token = tokenRef.current;
      setSpeaking(true);
      void lookupTrainingClip(text).then((url) => {
        if (token !== tokenRef.current) return;
        if (!url || typeof Audio === "undefined") {
          speakWithBrowserVoice(text);
          return;
        }
        const a = new Audio(url);
        a.playbackRate = rateRef.current;
        a.onended = () => {
          if (token === tokenRef.current) setSpeaking(false);
        };
        a.onerror = () => {
          if (token !== tokenRef.current) return;
          audioRef.current = null;
          speakWithBrowserVoice(text);
        };
        audioRef.current = a;
        a.play().catch(() => {
          if (token !== tokenRef.current) return;
          audioRef.current = null;
          speakWithBrowserVoice(text);
        });
      });
    },
    [halt, speakWithBrowserVoice],
  );

  const setRate = useCallback((r: number) => {
    rateRef.current = r;
    setRateState(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
    try { window.localStorage.setItem(RATE_KEY, String(r)); } catch {}
  }, []);

  // Always cancel on unmount.
  useEffect(() => () => { halt(); }, [halt]);

  return { supported, speaking, speak, stop, rate, setRate };
}

export function getSessionAutoRead(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
}

export function setSessionAutoRead(on: boolean) {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(SESSION_KEY, on ? "1" : "0"); } catch {}
}

function stripHtml(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function buildLessonSpeech(step: any, openDropIndex: number | null): string {
  if (!step || step.type !== "lesson") return "";
  const parts: string[] = [];
  if (step.title) parts.push(step.title + ".");
  if (step.lead) parts.push(stripHtml(step.lead));
  if (step.callout) {
    if (step.callout.t) parts.push(stripHtml(step.callout.t) + ".");
    if (step.callout.b) parts.push(stripHtml(step.callout.b));
  }
  if (Array.isArray(step.facts)) {
    for (const f of step.facts) {
      parts.push(`${stripHtml(f.t)} ${stripHtml(f.b)}`);
    }
  }
  if (openDropIndex !== null && Array.isArray(step.drops) && step.drops[openDropIndex]) {
    const [t, b] = step.drops[openDropIndex];
    parts.push(`${stripHtml(t)}. ${stripHtml(b)}`);
  }
  return parts.join(" ");
}

export function buildCheckSpeech(step: any): string {
  if (!step || step.type !== "check") return "";
  const parts: string[] = [];
  if (step.stem) parts.push(stripHtml(step.stem));
  if (Array.isArray(step.options)) {
    for (const o of step.options) {
      parts.push(`Option ${o.k}. ${stripHtml(o.t)}`);
    }
  }
  return parts.join(" ");
}

export function buildScenarioSpeech(step: any, beatIndex: number): string {
  if (!step || step.type !== "scenario") return "";
  const parts: string[] = [];
  if (step.title) parts.push(step.title + ".");
  if (step.setup && beatIndex === 0) parts.push(stripHtml(step.setup));
  const beat = Array.isArray(step.beats) ? step.beats[beatIndex] : null;
  if (beat?.fact) parts.push(stripHtml(beat.fact));
  if (beat && Array.isArray(beat.options)) {
    for (const o of beat.options) {
      parts.push(stripHtml(o.t));
    }
  }
  return parts.join(" ");
}
