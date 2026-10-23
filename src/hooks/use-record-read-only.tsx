// A read-only record (e.g. a discharged client's profile). Inside the
// provider, useAccess() reports every Edit category as View, so edit
// controls hide themselves. The server enforces the same rule.

import { createContext, useContext, type ReactNode } from "react";

const RecordReadOnlyContext = createContext(false);

export function RecordReadOnlyProvider({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: ReactNode;
}) {
  return (
    <RecordReadOnlyContext.Provider value={readOnly}>{children}</RecordReadOnlyContext.Provider>
  );
}

export function useRecordReadOnly(): boolean {
  return useContext(RecordReadOnlyContext);
}
