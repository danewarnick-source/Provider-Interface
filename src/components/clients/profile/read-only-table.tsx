// A read-only table shared by the profile sections that list records
// (activity, summaries, host-home certifications), whose rows can open
// their record. Wide tables scroll inside their own box.

import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "./cards/card-parts";

export type Col<R> = { header: string; cell: (row: R) => ReactNode };
export function ReadOnlyTable<R extends Record<string, unknown>>({
  rows,
  columns,
  loading,
  empty,
  onOpen,
}: {
  rows: R[];
  columns: Col<R>[];
  loading?: boolean;
  empty: string;
  /** Makes each row open its record (click or Enter). */
  onOpen?: (row: R) => void;
}) {
  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!rows.length) {
    return <EmptyState>{empty}</EmptyState>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.header}>{c.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow
              key={(r.id as string) ?? i}
              className={onOpen ? "cursor-pointer" : undefined}
              tabIndex={onOpen ? 0 : undefined}
              onClick={onOpen ? () => onOpen(r) : undefined}
              onKeyDown={
                onOpen
                  ? (e) => {
                      if (e.key === "Enter") onOpen(r);
                    }
                  : undefined
              }
            >
              {columns.map((c) => (
                <TableCell key={c.header}>{c.cell(r)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
