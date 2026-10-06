// Mocked Services & billing and Client file payloads for the client profile
// e2e (made-up data, no PHI). Built with the real pure helpers so the shapes
// match src/lib/clients/services-load.ts and file-required.ts.
import {
  authorizationView,
  servicesTotals,
  type AuthorizationRow,
} from "../../src/lib/clients/authorizations";
import type { ClientServices } from "../../src/lib/clients/services-load";
import type { RequiredDocRow } from "../../src/lib/clients/file-required";

const row = (over: Partial<AuthorizationRow>): AuthorizationRow => ({
  id: "00000000-0000-4000-a000-0000000009a1",
  service_code: "DSI",
  unit_type: "Q",
  rate_per_unit: 5.5,
  annual_unit_authorization: 1000,
  monthly_max_units: null,
  service_start_date: "2026-07-01",
  service_end_date: "2027-06-30",
  authorization_number: "900111",
  authorization_approved_on: "2026-06-20",
  authorization_pending: false,
  rate_source: "from 1056 900111",
  ...over,
});

export function clientServicesPayload(): ClientServices {
  const views = [
    authorizationView(row({}), 400),
    authorizationView(
      row({
        id: "00000000-0000-4000-a000-0000000009a2",
        service_code: "SEI",
        service_start_date: "2025-07-01",
        service_end_date: "2026-06-30",
      }),
      120,
    ),
  ];
  return {
    authorizations: views,
    totals: servicesTotals(views),
    history: {
      "00000000-0000-4000-a000-0000000009a1": [
        {
          id: "00000000-0000-4000-a000-0000000009b1",
          billing_code_id: "00000000-0000-4000-a000-0000000009a1",
          rate_per_unit: 5.25,
          unit_type: "Q",
          effective_start: "2025-07-01",
          effective_end: "2026-06-30",
          rate_source: "from 1056 800222",
          superseded_at: "2026-06-21T15:00:00.000Z",
        },
      ],
    },
    agencyCodes: ["DSI", "SEI", "HHS", "SLH", "SLN"],
  };
}

export function requiredDocumentsPayload(): RequiredDocRow[] {
  return [
    {
      key: "1056",
      label: "1056 (service authorization)",
      status: "on_file",
      dueOn: null,
      docType: "1056_budget",
      yearly: false,
      current: {
        id: "00000000-0000-4000-a000-0000000009c1",
        document_type: "1056_budget",
        file_name: "sample-1056.pdf",
        storage_path: "org/client/1056/sample-1056.pdf",
        uploaded_at: "2026-06-21T15:00:00.000Z",
      },
      href: null,
    },
    {
      key: "medical_exam",
      label: "Medical exam",
      status: "missing",
      dueOn: null,
      docType: "medical_exam",
      yearly: true,
      current: null,
      href: null,
    },
    {
      key: "photograph",
      label: "Photograph",
      status: "due_soon",
      dueOn: "2026-10-12",
      docType: null,
      yearly: false,
      current: null,
      href: "/dashboard/clients/x?section=profile",
    },
  ];
}
