import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Permanent redirect: caseloads live on each team member's profile
 * (Team Members → person → Caseload) and save through setStaffClientCodes.
 */
export const Route = createFileRoute("/dashboard/assignments")({
  beforeLoad: ({ location: { hash } }) => {
    throw redirect({ to: "/dashboard/team-members", hash, replace: true });
  },
});
