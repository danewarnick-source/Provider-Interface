// Where a Nectar answer's source chips open (N6, Decision 8). Pure: no
// Supabase, no aliases, so node --test can import it.
//
// Admins (the admin view): library documents and state rules open in the
// Knowledge base; agency facts open the Required policies (or Reviews) tab;
// client facts open the client's profile.
// Team members (the staff view) can't open the Knowledge base, so a policy or
// a state rule section opens read-only inside their own Nectar screen, a
// client's plan or medications open in the client workspace they already use,
// and their shifts open their schedule.

import type { NectarSource } from "./engine/ask-types.ts";
import { knowledgeHref } from "./library/knowledge-nav.ts";
import { staffNectarHref, type StaffNectarTab } from "./nectar-nav.ts";

/** A chip's words: "Emergency procedures · Falls · v2". Client facts carry no version. */
export function sourceLabel(source: NectarSource): string {
  return [source.documentTitle, source.heading, source.version ? `v${source.version}` : null]
    .filter((part) => !!part && String(part).trim())
    .join(" · ");
}

function clientHref(path: string, clientId: string, tab: string): string {
  return `${path}/${encodeURIComponent(clientId)}?tab=${tab}`;
}

/** Where an admin opens a source, or null when it has nowhere to go. */
export function adminSourceHref(source: NectarSource): string | null {
  switch (source.kind) {
    case "library":
      return source.documentId ? knowledgeHref({ doc: source.documentId }) : null;
    case "state_rule":
      return source.stateRuleId ? knowledgeHref({ rule: source.stateRuleId }) : null;
    case "agency":
      return knowledgeHref({ tab: source.id === "agency:reviews" ? "reviews" : "required" });
    case "client_plan":
    case "medications":
      return source.clientId
        ? clientHref("/dashboard/clients", source.clientId, "care-plan")
        : null;
    case "schedule":
      return "/dashboard/schedule";
    default:
      return null;
  }
}

/** Where a team member opens a source; `from` is the tab they are on, so Back returns there. */
export function staffSourceHref(source: NectarSource, from: StaffNectarTab = "ask"): string | null {
  switch (source.kind) {
    case "library":
      return source.documentId ? staffNectarHref({ tab: from, doc: source.documentId }) : null;
    case "state_rule":
      return staffNectarHref({ tab: from, section: source.id });
    case "client_plan":
      return source.clientId ? clientHref("/dashboard/workspace", source.clientId, "about") : null;
    case "medications":
      return source.clientId ? clientHref("/dashboard/workspace", source.clientId, "emar") : null;
    case "schedule":
      return "/dashboard/schedule";
    default:
      // Agency facts are only ever in admin answers.
      return null;
  }
}
