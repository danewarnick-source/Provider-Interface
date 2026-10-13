// Does a caregiver's note describe anything that happened? Draft assist uses
// this so it never writes a note from nothing (N1: never invent activities).
// Deliberately narrow: it only catches notes made of filler ("good shift",
// "n/a", "nothing to report"). The model is also told to return no draft when
// the note describes no activity.

const FILLER = new Set([
  "a", "an", "the", "and", "or", "but", "so", "to", "of", "in", "on", "at", "for", "with", "as",
  "is", "was", "were", "be", "been", "am", "are", "it", "its", "this", "that", "there", "then",
  "he", "she", "they", "them", "his", "her", "their", "we", "our", "us", "me", "my", "you", "your",
  "very", "just", "also", "too", "all", "any", "no", "not", "none", "nothing", "na", "nope",
  "went", "had", "has", "have", "did", "do", "does", "got", "seemed", "felt",
  "good", "great", "fine", "ok", "okay", "well", "normal", "usual", "typical", "same", "quiet",
  "uneventful", "shift", "day", "night", "today", "tonight", "issue", "issues", "problem",
  "problems", "concern", "concerns", "report", "note", "notes", "client", "individual", "staff",
  "everything",
]);

/** True when at least one word of the note says more than filler. */
export function describesActivity(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  return words.some((word) => word.length > 1 && !FILLER.has(word));
}
