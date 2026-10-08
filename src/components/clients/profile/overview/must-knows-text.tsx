// Must-knows text (clients.special_directions) drawn as headings and bullet
// lists. Plain text still shows as written.

import { parseMustKnows } from "@/lib/clients/must-knows";

export function MustKnowsText({ text }: { text: string }) {
  const blocks = parseMustKnows(text);
  return (
    <div className="space-y-4" data-testid="client-must-knows-text">
      {blocks.map((b, i) => (
        <div key={i} className="min-w-0">
          {b.heading ? (
            <h3 className="mb-1.5 text-sm font-semibold text-hive-ink">{b.heading}</h3>
          ) : null}
          {b.text.map((line, j) => (
            <p key={j} className="text-sm leading-relaxed break-words">
              {line}
            </p>
          ))}
          {b.bullets.length ? (
            <ul className="space-y-2">
              {b.bullets.map((bullet, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-hive-gold"
                  />
                  <span className="min-w-0 break-words">{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
