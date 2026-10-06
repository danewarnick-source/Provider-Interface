import DOMPurify from "dompurify";

/** Browser-only. Call from an effect so the server render stays empty. */
export function sanitizeHtml(dirty: string): string {
  const html = typeof dirty === "string" ? dirty : "";
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html);
}
