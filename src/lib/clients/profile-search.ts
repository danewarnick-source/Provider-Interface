// The client profile's search params (`/dashboard/clients/$clientId?…`).
// Pure: no React, no Supabase, importable by node --test.

import { z } from "zod";
import { CLIENT_PROFILE_SECTIONS } from "./profile-sections.ts";

/** The editors a list shortcut can open on arrival (`?edit=`). */
export const CLIENT_EDIT_TARGETS = ["home", "codes", "units", "team"] as const;
export type ClientEditTarget = (typeof CLIENT_EDIT_TARGETS)[number];

export const profileSearch = z.object({
  section: z.enum(CLIENT_PROFILE_SECTIONS).optional().catch(undefined),
  tab: z.string().max(40).optional().catch(undefined),
  /** "draft": start Nectar's About draft for a person to approve (after a PCSP is used). */
  about: z.enum(["draft"]).optional().catch(undefined),
  /** "open": open the "Finish setting up" steps (after Add client). */
  setup: z.enum(["open"]).optional().catch(undefined),
  /** Open this editor and focus its first field (list "+ Set home" etc.); dropped after save or cancel. */
  edit: z.enum(CLIENT_EDIT_TARGETS).optional().catch(undefined),
});
export type ProfileSearch = z.infer<typeof profileSearch>;
