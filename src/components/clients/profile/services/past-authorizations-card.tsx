// Past authorizations: ended codes (each with Renew) and earlier periods of
// a code that was renewed, each with its own dates and 1056 number. Kept
// for the record; nothing here is deleted or changed.

import type { ReactNode } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/clients/profile/cards/section-card";
import { StatusTag } from "@/components/clients/profile/cards/card-parts";
import { formatDate } from "@/lib/clients/dates";
import type { AuthorizationView } from "@/lib/clients/authorizations";
import type { PastAuthorization } from "@/lib/clients/authorization-renewal";
import { codeName } from "./code-name";

function Line({
  code,
  start,
  end,
  number,
  action,
}: {
  code: string;
  start: string | null;
  end: string | null;
  number: string | null;
  action?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3" data-testid="client-past-authorization">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-semibold text-hive-ink">
          <span className="font-mono">{code}</span>
          {codeName(code) ? <span className="font-normal"> · {codeName(code)}</span> : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(start)} – {formatDate(end, undefined, "no end date")}
          {number ? ` · 1056 #${number}` : " · no 1056 number"}
        </p>
      </div>
      <StatusTag tone="neutral">Ended {formatDate(end)}</StatusTag>
      {action}
    </li>
  );
}

export function PastAuthorizationsCard({
  ended,
  earlier,
  canEdit,
  onRenew,
}: {
  ended: AuthorizationView[];
  earlier: PastAuthorization[];
  canEdit: boolean;
  onRenew: (v: AuthorizationView) => void;
}) {
  if (ended.length === 0 && earlier.length === 0) return null;
  return (
    <SectionCard
      icon={History}
      tone="neutral"
      title="Past authorizations"
      description="Ended codes and earlier periods, kept for the record. Renew a code when a new 1056 arrives."
      testId="client-past-authorizations"
    >
      <ul className="divide-y divide-hive-border">
        {ended.map((v) => (
          <Line
            key={v.row.id}
            code={v.row.service_code}
            start={v.row.service_start_date}
            end={v.row.service_end_date}
            number={v.row.authorization_number}
            action={
              canEdit ? (
                <Button variant="outline" onClick={() => onRenew(v)}>
                  Renew {v.row.service_code}
                </Button>
              ) : null
            }
          />
        ))}
        {earlier.map((p) => (
          <Line
            key={p.key}
            code={p.code}
            start={p.start}
            end={p.end}
            number={p.authorizationNumber}
          />
        ))}
      </ul>
    </SectionCard>
  );
}
