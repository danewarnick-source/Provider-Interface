import { useEffect, useState, type CSSProperties } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";

/**
 * Renders HTML only after DOMPurify runs in the browser.
 * The first paint is empty so a stored script never reaches the page.
 */
export function SafeHtml({
  html,
  className,
  style,
}: {
  html: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [clean, setClean] = useState("");
  useEffect(() => {
    setClean(sanitizeHtml(html));
  }, [html]);
  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: clean }} />;
}
